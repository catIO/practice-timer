
import { getStore } from "@netlify/blobs";
import type { Handler } from "@netlify/functions";
import { nanoid } from "nanoid";

import * as fs from 'fs';
import * as path from 'path';

export const handler: Handler = async (event, context) => {
    let store;

    try {
        store = getStore("reports");
    } catch (e) {
        // Check if running in Netlify production
        if (process.env.NETLIFY) {
            console.error("Netlify Blobs failed to initialize:", e);
            // Return 500 cleanly so it's not a 502 crash
            // The frontend will treat this as !response.ok and use the fallback
            store = {
                setJSON: async () => { throw new Error("Blobs not available"); },
                get: async () => { throw new Error("Blobs not available"); }
            };
            // We can't just return here because we are outside the handler's main try/catch return path
            // But we can assign a dummy store that throws, which will be caught by the main try/catch lower down.
            // OR better: we can't easily return a response from inside this catch block to the main function scope
            // without restructuring.

            // Let's restructure slightly to allow returning early.
            // Actually, simply throwing was indeed the cause of 502 if not caught.
            // Let's set a flag or just fail gracefully in the main logic.
        } else {
            console.warn("Netlify Blobs not configured. Using local file storage for development.");
            // ... (local fallback logic)
        }

        const TMP_DIR = path.resolve(process.cwd(), 'tmp');
        const DB_FILE = path.join(TMP_DIR, 'blobs.json');

        // Ensure tmp dir exists
        if (!fs.existsSync(TMP_DIR)) {
            fs.mkdirSync(TMP_DIR, { recursive: true });
        }

        const readDb = () => {
            if (!fs.existsSync(DB_FILE)) return {};
            try {
                return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
            } catch (err) {
                console.error("Error reading local DB:", err);
                return {};
            }
        };

        const writeDb = (data: any) => {
            fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
        };

        store = {
            setJSON: async (key: string, data: any) => {
                const db = readDb();
                db[key] = data;
                writeDb(db);
                console.log(`[Local Store] Saved ${key} to ${DB_FILE}`);
            },
            get: async (key: string, options?: any) => {
                const db = readDb();
                const data = db[key];
                console.log(`[Local Store] Retrieved ${key} from ${DB_FILE}: ${!!data}`);
                return data || null;
            }
        };
    }

    // CORS headers
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    };

    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 200, headers, body: "" };
    }

    try {
        // POST: Create a new report
        if (event.httpMethod === "POST") {
            if (!event.body) {
                return { statusCode: 400, headers, body: "Missing body" };
            }

            // Generate a short ID (default nanoid is URL-safe)
            const id = nanoid(10);

            await store.setJSON(id, JSON.parse(event.body));

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ id }),
            };
        }

        // GET: Retrieve a report by ID
        if (event.httpMethod === "GET") {
            const id = event.queryStringParameters?.id;

            if (!id) {
                return { statusCode: 400, headers, body: "Missing id parameter" };
            }

            const report = await store.get(id, { type: "json" });

            if (!report) {
                // For mock store in dev, we might not find it, so return 404 is correct.
                // Or we could return dummy data if needed? 
                // Let's stick to 404 if not found, as regular behavior.
                return { statusCode: 404, headers, body: "Report not found" };
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(report),
            };
        }

        return { statusCode: 405, headers, body: "Method Not Allowed" };

    } catch (error) {
        console.error("Share function error:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: "Internal Server Error" }),
        };
    }
};

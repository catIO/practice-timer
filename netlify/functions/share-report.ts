import { getStore } from "@netlify/blobs";
import type { Handler } from "@netlify/functions";
import { nanoid } from "nanoid";
import * as fs from 'fs';
import * as path from 'path';

export const handler: Handler = async (event, context) => {
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json"
    };

    // CORS preflight
    if (event.httpMethod === "OPTIONS") {
        return {
            statusCode: 200,
            headers,
            body: ""
        };
    }

    let store;
    const isLocalDev = process.env.NETLIFY_DEV === 'true';

    if (isLocalDev) {
        console.warn("Netlify Blobs not configured (Local Dev). Using local file storage.");
        try {
            const TMP_DIR = path.resolve(process.cwd(), 'tmp');
            const DB_FILE = path.join(TMP_DIR, 'blobs.json');

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
                },
                get: async (key: string, options?: any) => {
                    const db = readDb();
                    return db[key] || null;
                }
            };
        } catch (fsError) {
            console.error("Failed to initialize local file storage:", fsError);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: "Local storage failed" })
            };
        }
    } else {
        try {
            store = getStore("reports");
        } catch (e) {
            console.error("Netlify Blobs failed to initialize in production:", e);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: "Netlify Blobs not configured" })
            };
        }
    }

    try {
        if (event.httpMethod === "POST") {
            if (!event.body) {
                return { statusCode: 400, headers, body: "Missing body" };
            }

            const body = JSON.parse(event.body);
            const id = nanoid(10);
            await store.setJSON(id, body);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ id })
            };
        }

        if (event.httpMethod === "GET") {
            const id = event.queryStringParameters?.id;

            if (!id) {
                return { statusCode: 400, headers, body: "Missing id parameter" };
            }

            const report = await store.get(id, { type: "json" });

            if (!report) {
                return { statusCode: 404, headers, body: "Report not found" };
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(report)
            };
        }

        return { statusCode: 405, headers, body: "Method Not Allowed" };

    } catch (error: any) {
        console.error("Share function error:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: "Internal Server Error" })
        };
    }
};


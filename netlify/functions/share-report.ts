import { getStore } from "@netlify/blobs";
import type { Context, Config } from "@netlify/functions";
import { nanoid } from "nanoid";
import * as fs from 'fs';
import * as path from 'path';

export default async (req: Request, context: Context) => {
    // CORS headers handling for V2
    if (req.method === "OPTIONS") {
        return new Response(null, {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            }
        });
    }

    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
    };

    let store;

    try {
        // In V2, getStore() should work seamlessly with the injected context
        store = getStore("reports");
    } catch (e) {
        // Detect if we are in local development
        const isLocalDev = process.env.NETLIFY_DEV === 'true';

        if (!isLocalDev) {
            console.error("Netlify Blobs failed to initialize in production.");
            console.error("Error Details:", e);
            console.log("Debug Info:", {
                NETLIFY: process.env.NETLIFY,
                NETLIFY_DEV: process.env.NETLIFY_DEV,
                CONTEXT: process.env.CONTEXT,
                SITE_ID: process.env.SITE_ID ? 'Present' : 'Missing'
            });

            // Prepare debug info for client response
            const debugError = JSON.stringify({
                message: "Netlify Blobs failed to initialize",
                details: e instanceof Error ? e.message : String(e),
                env: {
                    NETLIFY: process.env.NETLIFY,
                    SITE_ID: process.env.SITE_ID ? 'Present' : 'Missing'
                }
            });

            // Falling back to a dummy store that throws with debug info
            store = {
                setJSON: async () => { throw new Error(debugError); },
                get: async () => { throw new Error(debugError); }
            };
        } else {
            console.warn("Netlify Blobs not configured. Using local file storage for development.");

            try {
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
            } catch (fsError) {
                console.error("Failed to initialize local file storage:", fsError);
                store = {
                    setJSON: async () => { throw new Error("Local storage failed"); },
                    get: async () => { throw new Error("Local storage failed"); }
                };
            }
        }
    }

    try {
        // POST: Create a new report
        if (req.method === "POST") {
            const body = await req.json().catch(() => null);
            if (!body) {
                return new Response("Missing body", { status: 400, headers });
            }

            const id = nanoid(10);
            await store.setJSON(id, body);

            return new Response(JSON.stringify({ id }), {
                status: 200,
                headers: { ...headers, "Content-Type": "application/json" }
            });
        }

        // GET: Retrieve a report by ID
        if (req.method === "GET") {
            const url = new URL(req.url);
            const id = url.searchParams.get("id");

            if (!id) {
                return new Response("Missing id parameter", { status: 400, headers });
            }

            const report = await store.get(id, { type: "json" });

            if (!report) {
                // For mock store in dev, we might not find it, so return 404 is correct.
                // Or we could return dummy data if needed? 
                // Let's stick to 404 if not found, as regular behavior.
                return new Response("Report not found", { status: 404, headers });
            }

            return new Response(JSON.stringify(report), {
                status: 200,
                headers: { ...headers, "Content-Type": "application/json" }
            });
        }

        return new Response("Method Not Allowed", { status: 405, headers });

    } catch (error: any) {
        console.error("Share function error:", error);

        // Try to parse if it's our structured debug error
        let errorBody = { error: "Internal Server Error" };
        try {
            const parsed = JSON.parse(error.message);
            if (parsed && parsed.message && parsed.env) {
                errorBody = parsed;
            }
        } catch (e) {
            // Not JSON, use message if available
            if (error.message) {
                errorBody = { error: error.message };
            }
        }

        return new Response(JSON.stringify(errorBody), {
            status: 500,
            headers: { ...headers, "Content-Type": "application/json" }
        });
    }
};



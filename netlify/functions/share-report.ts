import { connectLambda, getStore } from "@netlify/blobs";
import type { Handler } from "@netlify/functions";
import { nanoid } from "nanoid";
import * as fs from 'fs';
import * as path from 'path';

// --- Hardening ---------------------------------------------------------------
// This endpoint has no auth — the shared-report URL is the capability. To make
// that reasonably safe we enforce:
//   * A JSON body size cap so a malicious caller can't fill the blob store.
//   * A schema check that the body looks like a ReportSnapshot (object with an
//     `items` array). This is a light guard — we cannot fully validate every
//     nested field cheaply — but it blocks the "POST random garbage" case.
//   * A slug allow-list so caller-supplied ids can only be short URL-safe
//     tokens (matches nanoid's alphabet).
//   * REFUSE overwrites. A client-supplied id that already exists returns 409
//     instead of silently overwriting someone else's report. Legitimate share
//     flows always mint a fresh nanoid before calling us, so collisions are
//     effectively impossible.

const MAX_BODY_BYTES = 256 * 1024; // 256 KB — reports include text, no binaries.
const ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;

/** Light schema check for the ReportSnapshot shape used by the client. */
function isValidReportBody(body: unknown): body is Record<string, unknown> & { items: unknown[] } {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
    const obj = body as Record<string, unknown>;
    return Array.isArray(obj.items);
}

/** Uniform response with CORS + JSON headers. */
function respond(statusCode: number, body: string | Record<string, unknown>, headers: Record<string, string>) {
    return {
        statusCode,
        headers,
        body: typeof body === 'string' ? body : JSON.stringify(body),
    };
}

export const handler: Handler = async (event) => {
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

    let store: { setJSON: (key: string, data: unknown) => Promise<void>; get: (key: string, options?: unknown) => Promise<unknown> };
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

            const writeDb = (data: unknown) => {
                fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
            };

            store = {
                setJSON: async (key: string, data: unknown) => {
                    const db = readDb();
                    db[key] = data;
                    writeDb(db);
                },
                get: async (key: string) => {
                    const db = readDb();
                    return db[key] || null;
                }
            };
        } catch (fsError) {
            console.error("Failed to initialize local file storage:", fsError);
            return respond(500, { error: "Local storage failed" }, headers);
        }
    } else {
        try {
            // connectLambda required when Blobs context is in event (Lambda compatibility mode)
            if ((event as any).blobs) {
                connectLambda(event as any);
            }
            store = getStore("reports") as any;
        } catch (e) {
            console.error("Netlify Blobs failed to initialize in production:", e);
            return respond(500, { error: "Netlify Blobs not configured" }, headers);
        }
    }

    try {
        if (event.httpMethod === "POST") {
            if (!event.body) {
                return respond(400, "Missing body", headers);
            }

            // Enforce a byte-length cap before parsing so a huge body can't
            // exhaust memory or the blob store's per-object quota. Base64-
            // encoded bodies count post-decode length; JSON bodies use the
            // raw string length in bytes.
            const rawByteLength = event.isBase64Encoded
                ? Buffer.from(event.body, 'base64').byteLength
                : Buffer.byteLength(event.body, 'utf8');
            if (rawByteLength > MAX_BODY_BYTES) {
                return respond(413, { error: "Body too large" }, headers);
            }

            let body: unknown;
            try {
                const raw = event.isBase64Encoded
                    ? Buffer.from(event.body, 'base64').toString('utf8')
                    : event.body;
                body = JSON.parse(raw);
            } catch {
                return respond(400, { error: "Body is not valid JSON" }, headers);
            }

            if (!isValidReportBody(body)) {
                return respond(400, { error: "Body must be an object with an items array" }, headers);
            }

            // Extract caller-supplied id (optional) and validate its shape.
            const suppliedId = (body as { id?: unknown }).id;
            let id: string;
            if (typeof suppliedId === 'string' && suppliedId.length > 0) {
                if (!ID_PATTERN.test(suppliedId)) {
                    return respond(400, { error: "Invalid id format" }, headers);
                }
                // Refuse to overwrite an existing report. Legitimate flows
                // always mint a fresh nanoid client-side; collisions on
                // 10 chars of nanoid alphabet are effectively impossible, so
                // any existing hit here is either an attack or a bug.
                const existing = await store.get(suppliedId, { type: "json" });
                if (existing !== null && existing !== undefined) {
                    return respond(409, { error: "Report id already exists" }, headers);
                }
                id = suppliedId;
            } else {
                id = nanoid(10);
            }

            // Strip id from the stored payload so it isn't duplicated.
            const { id: _ignored, ...dataToStore } = body as Record<string, unknown>;
            void _ignored;

            await store.setJSON(id, dataToStore);

            return respond(200, { id }, headers);
        }

        if (event.httpMethod === "GET") {
            const id = event.queryStringParameters?.id;

            if (!id) {
                return respond(400, "Missing id parameter", headers);
            }

            if (!ID_PATTERN.test(id)) {
                return respond(400, { error: "Invalid id format" }, headers);
            }

            const report = await store.get(id, { type: "json" });

            if (!report) {
                return respond(404, "Report not found", headers);
            }

            return respond(200, report as Record<string, unknown>, headers);
        }

        return respond(405, "Method Not Allowed", headers);

    } catch (error: any) {
        console.error("Share function error:", error);
        const msg = error?.message || String(error);
        return respond(500, {
            error: "Internal Server Error",
            detail: msg.replace(/token|secret|key/gi, "[redacted]")
        }, headers);
    }
};

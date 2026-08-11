import type { Handler, HandlerResponse } from '@netlify/functions';
import ogs from 'open-graph-scraper';
import * as dns from 'dns/promises';
import * as net from 'net';

interface MetadataResponse {
    title?: string;
    description?: string;
    image?: string;
    icon?: string;
    url: string;
}

// --- SSRF hardening ----------------------------------------------------------
// The handler fetches arbitrary URLs on behalf of clients (open-graph-scraper
// under the hood does an HTTP GET on the target). Without validation this is a
// classic Server-Side Request Forgery vector — an attacker can point us at
// http://localhost, RFC1918 addresses, or cloud metadata endpoints such as
// http://169.254.169.254. Netlify Functions run in a somewhat locked-down
// environment, but we do not want to rely solely on that.
//
// Strategy: enforce http/https, DNS-resolve the hostname, and reject if any
// resolved address is in a disallowed range. Cap the request duration so a
// slow target can't tie up the function. Apply the same to the YouTube oEmbed
// fallback (its hostname is fixed to www.youtube.com, so DNS validation still
// applies but hostname pinning gives extra defense in depth).

const FETCH_TIMEOUT_MS = 6000;
const MAX_URL_LENGTH = 2048;

/** Return true when the ip string is inside private / metadata ranges we forbid. */
function isDisallowedIp(ip: string): boolean {
    const family = net.isIP(ip);
    if (family === 0) return true; // unparseable — refuse

    if (family === 4) {
        return isDisallowedIpv4(ip);
    }

    // IPv6
    const lower = ip.toLowerCase();
    // Unspecified / loopback
    if (lower === '::' || lower === '::1') return true;
    // IPv4-mapped IPv6 (::ffff:a.b.c.d) — extract the embedded v4 and re-check.
    if (lower.startsWith('::ffff:')) {
        const embedded = lower.slice('::ffff:'.length);
        if (net.isIP(embedded) === 4) return isDisallowedIpv4(embedded);
    }
    // Link-local fe80::/10
    if (/^fe[89ab][0-9a-f]:/i.test(lower)) return true;
    // Unique local fc00::/7
    if (/^f[cd][0-9a-f]{2}:/i.test(lower)) return true;
    // Multicast ff00::/8
    if (/^ff[0-9a-f]{2}:/i.test(lower)) return true;

    return false;
}

function isDisallowedIpv4(ip: string): boolean {
    const parts = ip.split('.').map((n) => Number(n));
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) {
        return true;
    }
    const [a, b, c] = parts;
    // 0.0.0.0/8 unspecified
    if (a === 0) return true;
    // 10.0.0.0/8 private
    if (a === 10) return true;
    // 127.0.0.0/8 loopback
    if (a === 127) return true;
    // 169.254.0.0/16 link-local (incl. cloud metadata 169.254.169.254)
    if (a === 169 && b === 254) return true;
    // 172.16.0.0/12 private
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.0.0.0/24 IETF protocol assignments
    if (a === 192 && b === 0 && c === 0) return true;
    // 192.168.0.0/16 private
    if (a === 192 && b === 168) return true;
    // 100.64.0.0/10 CGNAT
    if (a === 100 && b >= 64 && b <= 127) return true;
    // 224.0.0.0/4 multicast
    if (a >= 224 && a <= 239) return true;
    // 240.0.0.0/4 reserved / broadcast
    if (a >= 240) return true;
    return false;
}

/**
 * Validate a user-supplied URL:
 *  - Well-formed and http(s).
 *  - Not absurdly long.
 *  - Hostname does not resolve to a disallowed IP.
 *
 * Returns an error message when the URL should be rejected, or `null` on success.
 * Exported for test coverage.
 */
export async function assertSafeUrl(rawUrl: string): Promise<string | null> {
    if (typeof rawUrl !== 'string' || rawUrl.length === 0) return 'URL is required';
    if (rawUrl.length > MAX_URL_LENGTH) return 'URL is too long';

    let parsed: URL;
    try {
        parsed = new URL(rawUrl);
    } catch {
        return 'URL is malformed';
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return 'URL must be http(s)';
    }

    const hostname = parsed.hostname;
    if (!hostname) return 'URL must have a hostname';

    // The URL parser keeps IPv6 hostnames in bracketed form (e.g. "[::1]") but
    // net.isIP wants the bare address. Strip brackets before IP checks.
    const bareHost = hostname.startsWith('[') && hostname.endsWith(']')
        ? hostname.slice(1, -1)
        : hostname;

    // Literal IP hostnames: check directly, don't DNS.
    if (net.isIP(bareHost) !== 0) {
        if (isDisallowedIp(bareHost)) return 'URL points to a disallowed address';
        return null;
    }

    // Hostname: resolve to all addresses and reject if any are disallowed.
    // We check ALL results because DNS can return multiple A/AAAA records and
    // an attacker only needs one internal target to succeed. `all: true` gets
    // both IPv4 and IPv6 in a single call.
    let resolved: { address: string; family: number }[];
    try {
        resolved = await dns.lookup(bareHost, { all: true });
    } catch {
        return 'URL hostname could not be resolved';
    }

    if (resolved.length === 0) return 'URL hostname could not be resolved';
    for (const { address } of resolved) {
        if (isDisallowedIp(address)) return 'URL resolves to a disallowed address';
    }
    return null;
}

// --- Handler -----------------------------------------------------------------

export const handler: Handler = async (event): Promise<HandlerResponse> => {
    // Only allow GET requests
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            body: 'Method Not Allowed',
        };
    }

    const { url } = event.queryStringParameters || {};

    if (!url) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'URL is required' }),
        };
    }

    const validationError = await assertSafeUrl(url);
    if (validationError) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: validationError }),
        };
    }

    try {
        const { result } = await ogs({
            url,
            fetchOptions: {
                headers: {
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36'
                },
                // Cap total fetch time so open-graph-scraper can't hang on a slow target.
                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            }
        });

        // Extract best available metadata
        const metadata: MetadataResponse = {
            title: result.ogTitle || result.twitterTitle || result.dcTitle || (result as any).title,
            description: result.ogDescription || result.twitterDescription || result.dcDescription,
            image: (result.ogImage && result.ogImage[0]?.url) ||
                (result.twitterImage && result.twitterImage[0]?.url),
            icon: result.favicon,
            url: url
        };

        // Fallback for YouTube if title is generic. The oEmbed hostname is
        // fixed (www.youtube.com); the URL is fully constructed by us so it is
        // trivially SSRF-safe, but we keep the timeout for reliability.
        const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
        const isGenericTitle = !metadata.title || metadata.title === 'YouTube' || metadata.title === '- YouTube';

        if (isYouTube && isGenericTitle) {
            try {
                const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
                const oembedRes = await fetch(oembedUrl, {
                    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
                });
                if (oembedRes.ok) {
                    const oembedData = await oembedRes.json();
                    if (oembedData.title) {
                        metadata.title = oembedData.title;
                        // oEmbed also provides high quality thumbnails
                        if (oembedData.thumbnail_url && !metadata.image) {
                            metadata.image = oembedData.thumbnail_url;
                        }
                    }
                }
            } catch (e) {
                console.error('YouTube oEmbed fallback failed:', e);
            }
        }

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify(metadata),
        };
    } catch (error) {
        console.error('Error fetching metadata:', error);

        // Return partial data/fallback
        return {
            statusCode: 200, // Return 200 to allow client to use fallback
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                title: url,
                url: url
            }),
        };
    }
};

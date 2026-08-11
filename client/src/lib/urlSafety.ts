/**
 * URL safety helpers used at every boundary where user-authored content is
 * rendered into an anchor `href` (or any place a URL string can trigger
 * navigation / script execution).
 *
 * Blocks the well-known XSS payload protocols (`javascript:`, `data:`, `vbscript:`,
 * `file:`, etc.) while allowing the small set of protocols we actually use
 * inside the app: http(s) and mailto.
 *
 * Relative URLs are rejected on purpose: the app has no legitimate need to
 * emit user-authored relative paths, and rejecting them removes an entire
 * class of scheme-relative smuggling (e.g. `//evil.com`).
 */

const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/**
 * Return true when `url` is an absolute URL whose protocol is on the allow list.
 * Handles the sneaky variants (leading whitespace, mixed case, embedded tab/newline)
 * by pre-stripping all ASCII control characters before parsing.
 */
export function isSafeHttpUrl(url: unknown): url is string {
    if (typeof url !== "string" || url.length === 0) return false;

    // The WHATWG URL parser strips tabs/newlines, but we strip them ourselves
    // too so we can also reject strings that are *only* whitespace/controls
    // and so we don't rely on parser quirks.
    const stripped = url.replace(/[\u0000-\u001F\u007F]/g, "").trim();
    if (stripped.length === 0) return false;

    try {
        const parsed = new URL(stripped);
        return ALLOWED_PROTOCOLS.has(parsed.protocol.toLowerCase());
    } catch {
        return false;
    }
}

/**
 * Return `url` when safe, otherwise `undefined`. Callers should use the
 * result to decide whether to render an anchor at all — never fall back to
 * a "dead" `href="#"` link, since a click still runs any surrounding JS.
 */
export function sanitizeHref(url: unknown): string | undefined {
    return isSafeHttpUrl(url) ? url : undefined;
}

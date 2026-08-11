import { describe, it, expect } from "vitest";
import { isSafeHttpUrl, sanitizeHref } from "../../client/src/lib/urlSafety";

describe("isSafeHttpUrl / sanitizeHref", () => {
  describe("accepts common safe URLs", () => {
    const safe = [
      "https://example.com",
      "https://example.com/path?query=1#hash",
      "http://example.com",
      "HTTPS://EXAMPLE.COM",
      "https://sub.example.com:8443/x",
      "mailto:someone@example.com",
      "mailto:someone@example.com?subject=hi",
    ];
    for (const url of safe) {
      it(`accepts ${JSON.stringify(url)}`, () => {
        expect(isSafeHttpUrl(url)).toBe(true);
        expect(sanitizeHref(url)).toBe(url);
      });
    }
  });

  describe("rejects XSS payload schemes", () => {
    const xss = [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "JAVASCRIPT:alert(1)",
      "  javascript:alert(1)", // leading whitespace
      "\tjavascript:alert(1)", // leading tab
      "\njavascript:alert(1)", // leading newline
      "java\tscript:alert(1)", // embedded tab (WHATWG parser strips it)
      "java\nscript:alert(1)", // embedded newline
      "vbscript:msgbox(1)",
      "data:text/html,<script>alert(1)</script>",
      "data:image/svg+xml;base64,PHN2Zy8+",
      "file:///etc/passwd",
      "blob:https://evil.com/abc",
      "about:blank",
    ];
    for (const url of xss) {
      it(`rejects ${JSON.stringify(url)}`, () => {
        expect(isSafeHttpUrl(url)).toBe(false);
        expect(sanitizeHref(url)).toBeUndefined();
      });
    }
  });

  describe("rejects relative / malformed / non-string inputs", () => {
    const bad: unknown[] = [
      "",
      "   ",
      "\u0000",
      "/etc/passwd",
      "./local",
      "//evil.com/x", // scheme-relative — never emit for user content
      "not a url",
      "example.com", // missing scheme
      "https://", // no authority
      null,
      undefined,
      42,
      {},
      [],
      true,
    ];
    for (const url of bad) {
      it(`rejects ${JSON.stringify(url)}`, () => {
        expect(isSafeHttpUrl(url)).toBe(false);
        expect(sanitizeHref(url)).toBeUndefined();
      });
    }
  });

  describe("URL parsing edge cases", () => {
    it("keeps the exact input string when safe (no normalization)", () => {
      // Callers rely on the returned value being === the input so the visible
      // label stays untouched. sanitizeHref must not URL-normalize.
      const raw = "https://Example.COM/Path?a=1";
      expect(sanitizeHref(raw)).toBe(raw);
    });

    it("rejects a URL that trims to empty", () => {
      expect(isSafeHttpUrl("   \n\t   ")).toBe(false);
    });

    it("rejects userinfo-only javascript smuggling", () => {
      // Not a valid absolute URL: `javascript` becomes the scheme.
      expect(isSafeHttpUrl("javascript://%0aalert(1)")).toBe(false);
    });

    it("accepts http URL that includes user-supplied path (not XSS)", () => {
      expect(isSafeHttpUrl("https://example.com/?next=javascript:alert(1)")).toBe(true);
    });
  });
});

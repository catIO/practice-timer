---
# practice-timer-u3gd
title: Fix critical security issues from code review (SSRF, RLS, share-report)
status: completed
type: task
priority: high
created_at: 2026-08-11T15:20:36Z
updated_at: 2026-08-11T15:26:20Z
---

Address the three critical findings from the earlier code review:

**C1 - SSRF in /api/metadata** (netlify/functions/metadata.ts)
User-supplied URL is fetched without validation. Need to:
- Require http(s):// scheme.
- Resolve hostname and reject private/loopback/link-local/multicast/metadata IPs.
- Add per-fetch timeout so slow/hanging targets can't tie up the function.
- Same protections on the YouTube oEmbed fallback (or hostname-allowlist it).

**C2 - Anonymous UPDATE on shared_reports** (supabase/migrations/004_fix_rls_anonymous_upsert.sql)
Current policy allows any unauthenticated visitor to UPDATE any anonymous report. Need a new migration that makes anonymous rows append-only (drop UPDATE for user_id IS NULL). Authenticated users can still update their own rows and claim orphan/anonymous rows on login.

**C3 - share-report function is unauthenticated, unvalidated, and lets caller overwrite any id** (netlify/functions/share-report.ts)
Need to:
- Enforce body size cap (JSON <= ~256KB).
- Validate that body parses to an object with an items array (matches ReportSnapshot shape).
- If a client-supplied id already exists in the blob store, refuse (409) instead of overwriting.
- Sanity-check id format (nanoid-ish: /^[A-Za-z0-9_-]{1,32}$/).

**Tasks:**
- [x] C1: SSRF hardening in netlify/functions/metadata.ts.
- [x] C2: New migration supabase/migrations/007_shared_reports_anonymous_append_only.sql.
- [x] C3: Validation + no-overwrite in netlify/functions/share-report.ts.
- [x] Update/add tests in tests/functions/metadata.test.ts and tests/functions/share-report.test.ts.
- [x] npm run check passes.

**Constraints (must preserve):**
- Existing client flows in client/src/lib/reportShare.ts and Report/SharedPieceDetail pages continue to work (client-supplied id path still supported for first-write).
- YouTube oEmbed fallback still works for legitimate YouTube URLs.
- Anonymous share creation still works.



## Summary of Changes

**C1 — SSRF hardening** (netlify/functions/metadata.ts):
- Added assertSafeUrl(): rejects non-http(s) schemes, malformed URLs, URLs > 2 KB, literal IPs in loopback/private/link-local/CGNAT/multicast/reserved ranges, and hostnames that DNS-resolve to any such IP (all A/AAAA records checked). Handles IPv6 bracketed hostnames and IPv4-mapped IPv6.
- Added AbortSignal.timeout(6000ms) on both the open-graph-scraper fetch and the YouTube oEmbed fallback so slow targets can't hang the function.
- Handler now validates the URL before invoking open-graph-scraper; on rejection returns 400 with a specific error message.

**C2 — Anonymous shared_reports are now append-only** (supabase/migrations/007_shared_reports_anonymous_append_only.sql):
- New migration drops the permissive UPDATE policy from 004 and replaces it with two authenticated-only policies:
  1) 'Allow users to update own reports' — authenticated caller can update their own rows.
  2) 'Allow authenticated users to claim anonymous reports' — authenticated caller can transition user_id from NULL to their own auth.uid() (preserves the sign-in-and-claim flow).
- Both policies are TO authenticated, so anonymous callers can no longer UPDATE anything. Anonymous rows are effectively append-only until claimed.
- Deploy note: run this migration in Supabase before the frontend change is redeployed.

**C3 — share-report function hardened** (netlify/functions/share-report.ts):
- 256 KB body size cap (computed pre-parse from raw or base64-decoded byte length); returns 413 on overflow.
- JSON schema check: body must be an object containing an items array; returns 400 otherwise.
- Id format validation: /^[A-Za-z0-9_-]{1,32}$/ for both POST-supplied and GET-queried ids; blocks path-traversal / weird characters.
- Refuses to overwrite an existing id: if the caller supplies an id that already exists in the blob store, returns 409 instead of clobbering the previous report.
- Kept the local-dev fs-backed store path and CORS preflight untouched.

**Tests**:
- tests/functions/metadata.test.ts: added SSRF cases (file://, javascript:, literal 127.0.0.1, 169.254.169.254, RFC1918, IPv6 ::1, DNS resolving to 10.0.0.5, DNS lookup failure, over-long URL). Preserves original happy-path tests. Mocks dns/promises to control resolution.
- tests/functions/share-report.test.ts: added invalid-JSON, wrong-shape (string/array/no-items/items-not-array), invalid id characters, overwrite refusal (409 with unchanged prior data), 413 body-too-large, and invalid GET id.

**Verification**:
- npm run check passes: tsc --noEmit clean, vitest 28/28 pass (up from 13/13).

**Deployment notes**:
- Migration 007 must be applied to Supabase before deploying the frontend changes; existing anonymous rows remain in place (append-only from now on).
- No client code changes needed — client already generates a fresh nanoid client-side before calling share-report, so the no-overwrite rule doesn't affect legitimate flows.

# Storage reliability: incremental refactor validation

Date: 2026-09-16. Parent epic: `practice-timer-psf6`.

## Scope delivered

- A shared scheduling primitive coalesces edits with a five-second maximum wait while JavaScript executes. Continuous timer ticks cannot keep postponing uploads. Immediate pause/background scheduling cancels pending debounce/deadline callbacks.
- Remote plan hydration writes local storage without scheduling an echo upload of unrelated local data.
- First-user initialization now attempts an upload and reports failure truthfully. It uses insert-only semantics: a competing first writer cannot be overwritten by initialization.
- Ordinary uploads still use the legacy shared user row. No database schema, production data, or PWA cutover was performed. The shared `plans` table and per-plan revisions are the agreed next architecture, not yet active.

## Timer regressions reproduced and fixed

Five ordinary failing test cases were observed before fixes; all pass afterward:

1. Resuming work when remaining time equals the configured break duration changed the mode to break.
2. iOS helper resume counted the paused interval in work mode.
3. The same paused-interval problem occurred in break mode.
4. A second background visit reapplied recorded drift and added recovered time back.
5. Cleaned-up iOS helpers still reacted to visibility/focus/unload events.

The first slice retains the existing timer architecture, with these targeted corrections. It does not replace the worker or change segment-time attribution semantics.

## Automated verification

| Check | Result |
| --- | --- |
| Baseline full suite | 239 tests, 27 files passed |
| Final full suite | 271 tests, 29 files passed; no skipped or expected-failure regressions added |
| TypeScript (`tsc --noEmit`) | Passed |
| ESLint on all eight changed/new TypeScript files, zero-warning threshold | Passed |
| Production build | Passed; existing-style bundle warning for chunks exceeding 500 kB |
| Whitespace validation (`git diff --check`) | Passed |
| Editor diagnostics on changed TypeScript files | No errors |

Added tests exercise work/break completion and iterations, pause/resume, general-vs-segment time attribution, segment pause/completion/overtime, duplicate message handling, and catch-up applied exactly once. Shared-store consumers unmount/remount without stopping the worker. The iOS helper is tested with simulated wall-clock jumps, foreground/background events, persistence, pause/resume, and cleanup.

These are non-browser tests. Store tests mock the worker boundary, and helper tests mock time and disable audio. They do not demonstrate actual route integration, OS suspension behavior, audible alerts, or live Supabase behavior.

## Explicit release blockers

### All-surface background timing (`practice-timer-18ly`)

- `Home` currently owns `useTimer`, including iOS helper creation/cleanup. Plan pages and the sidebar invoke the shared store directly. A store-consumer unmount test is not proof that the iOS helper remains active after navigating away from Home.
- The worker main timer decrements once per interval callback; the overtime ticker emits one tick per callback. Lost callbacks require wall-clock reconciliation, not more frequent intervals.
- The helper and worker both update main countdown state. An app-level lifecycle and authoritative timeline need integration tests to prevent stale values and duplicate time attribution.
- Active segment runtime fields are not included in the main progress snapshot. Define recovery behavior for suspension, reload, and process termination separately.

Required next automated scenarios: actual worker/store integration with clock jumps, stale/duplicate deliveries, changing routes while running, sync overlap, segment pause and overtime, and idempotent completion after foreground recovery.

Required real-device matrix (not executed):

| Surface/platform | Required scenarios |
| --- | --- |
| Home, practice plan, lesson plan, repertoire, settings/sidebar | Start/pause/resume work and break; navigate without unintended timer reset; segment countdown and overtime |
| iPad/iPhone Safari and installed PWA | Background for short and long intervals; lock/unlock; foreground recovery; repeat backgrounding; paused intervals excluded |
| Desktop Chromium, Safari, Firefox | Hidden/throttled tabs, minimized windows, route changes, completion on return |
| All supported platforms | Offline sync failure, pending edits, permissions denied, alert behavior; reload/process-termination recovery according to documented contract |

Browser/OS suspension prevents a guarantee of uninterrupted JavaScript, audio, or notifications. Elapsed-time recovery and best-effort alerts must be described separately.

### Storage safety

- Durable user-scoped outbox, reload-safe dirty-draft protection, full account/local-data isolation, and atomic version checks remain unfinished. The second slice adds single-tab in-memory draft/request guards and intentional empty-plan propagation (see below).
- The second slice queues uploads behind pulls and retries pending work on reconnect/focus. No durable retry or acknowledgement tracking exists yet. A bounded scheduler is not a delivery guarantee.
- Historic totals still use max-based merging and completions use unions; independent offline additions/corrections need idempotent activity records.
- Backups/PITR, restore drills, database concurrency/RLS tests, old-PWA compatibility, and migration rollback are not verified.
- Bounded scheduling can increase legacy full-row upload frequency during active practice. Complete independent/versioned writes and measure workload before treating this as a production scaling solution.

## Release conclusion

The initial refactor and targeted timer fixes pass automated regression checks. The epic remains in progress. Full cross-device data-loss protection and all-surface background behavior are **not certified**, and no production migration or deployment has been performed.

## Second slice: remove maintenance workarounds (2026-09-16)

Child task: `practice-timer-9lni`.

### Delivered

- Removed Account's Data & Device Utilities card, including manual sync, unconfirmed report restore, and destructive cache-clearing reload handlers. Profile, password and sign-out controls remain. Report snapshot helpers, local history, and the existing automatic PWA update notification are not removed.
- Serialized single-tab pushes/pulls and coalesced overlapping requests. A push queued during a pull is no longer silently rejected.
- Track pending edit revisions in memory. Pulls do not overwrite pending edits, including edits made while a read is in flight. Upload acknowledgements cover only the captured revision; newer edits schedule another upload.
- Retry pending uploads on network reconnection or return/focus; backgrounding flushes only pending edits, not an unchanged full row.
- Apply intentional empty plan arrays; preserve existing local plans for missing/null fields.
- Keep failed first-user initialization insert-only on retry. A duplicate-key response never switches to an unconditional upsert.
- Invalidate queued requests and late responses on account changes/sign-out and recheck the session before hydration/acknowledgement. Remove lifecycle listeners and cancel debounce callbacks on provider cleanup, preserving pending revisions across an in-memory remount.
- Defer sign-in hydration outside Supabase auth notifications, remove duplicate password-sign-in hydration, and guard loading state against obsolete auth completions.

### Verification and limits

- Added 20 regression tests: 13 sync concurrency/lifecycle cases, 6 AuthProvider cases, and 1 Account UI case. Full suite: 291 tests / 31 files passing; TypeScript and production build pass.
- Build warnings: outdated Browserslist data and a chunk over 500 kB. AuthContext's existing `react-refresh/only-export-components` warning remains; it predates this slice.
- Tests use mocked Supabase and simulated browser events. No browser/device, live database, deployment, cache deletion, or production migration was performed.
- Pending revision state is **in memory**, not a durable outbox. Reload/crash recovery and cross-tab coordination are NOT delivered. Legacy local data remains stored in unscoped keys; request invalidation is NOT full account data isolation.
- Reconnect retries still use full-row legacy writes without CAS. They do NOT safely merge concurrent device edits. Automatic timed backoff is not introduced; persistent conflicts, insert acknowledgement loss, and identical-plan rejection need explicit sync/conflict status plus durable operation identity, not blind overwrite retries.
- Local storage write/parse failures, account-specific draft retention/import consent, immutable plan revisions, independent backups/restore drills, idempotent activity storage, and the background timer release blocker remain open in the parent epic. Removing recovery controls does not resolve these risks.
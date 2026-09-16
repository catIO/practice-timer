---
# practice-timer-psf6
title: Harden plan and activity storage with reliable sync and recovery
status: in-progress
type: epic
priority: high
created_at: 2026-09-16T12:11:06Z
updated_at: 2026-09-16T17:33:36Z
---

## Objective
Scale Practice Mate without silently losing edits or practice history. Keep React and Supabase/Postgres, isolate storage from the timer engine, and deliver this epic through small, independently verified child tasks.

## Agreed architecture
- Use one `plans` table: `id`, `user_id`, `kind` (`practice` or `lesson`), `content` (JSONB), server-managed `version`, and `updated_at`. Practice and lesson plans are separate rows with independent identities, revisions, and sync channels, NOT separate tables or columns in one shared user row.
- Initially enforce one active plan per user/kind; explicitly migrate that constraint if multiple plans are introduced. Keep nested editor content in JSONB; do not prematurely normalize every block.
- Use immutable `plan_revisions` tied to `plan_id`. Owner-scoped read access; clients cannot rewrite history. Update content, increment version, and capture history in one database transaction with an atomic expected-version condition. A restore creates a new revision.
- Store activity outside plan documents: individually identified practice sessions/time increments and completion records. Use idempotent writes, explicit reversal/deletion semantics, bounded checkpoints/batches, date-range queries, and derived aggregates. Never merge independent time increments with `Math.max` or write every timer tick to Postgres.
- Use transactional, user-scoped IndexedDB local documents and a durable outbox. Persist edits and pending operations atomically before indicating local save success. Browser storage is not a backup.
- Keep practice and lesson domain wrappers independent while sharing persistence/editor infrastructure. Timer runtime/progress remain device-local; cloud plan hydration must never reset, start, pause, or advance a timer.

## Non-negotiable timer contract
- Work and break timers, pause/resume, skip/reset, iterations, segment countdowns, segment pause, overtime, completions, and practice-time attribution must retain existing behavior.
- Timer state must remain shared across timer, plan, repertoire, and settings surfaces; navigating or syncing must not recreate or stop the engine.
- Verify background/foreground elapsed-time recovery, paused-time exclusion, and no duplicate time attribution/completions. Test worker/store behavior and iOS wall-clock recovery independently of cloud availability.
- Browser/OS suspension can prevent uninterrupted callbacks, audio, and notifications. Accurate recovery must not be presented as guaranteed continuous background execution. Real-device Safari/iPad/iPhone PWA and desktop/browser checks remain a release gate.

## Delivery phases and acceptance gates
### 1. Regression safety and sync boundaries
- [x] Establish a passing baseline and add focused work/break, pause/resume, segment, and background recovery regression tests.
- [x] Extract bounded upload scheduling so continuous timer ticks cannot indefinitely defer a pending upload; retain immediate pause/background flush behavior.
- [x] Separate cloud hydration from local edits so pulling a plan does not schedule an upload of unrelated stale state.
- [x] Fix first-user upload suppression and propagate initialization failures truthfully.
- [x] Protect dirty drafts from pulls, support intentional empty plans, and isolate accounts/in-flight requests before cloud cutover (`practice-timer-9lni`).

### 2. Durable local state and sync status
- [ ] Add transactional user-scoped local documents/outbox, resumable migration from legacy localStorage, and explicit guest import consent.
- [ ] Add idempotent retries/backoff, reconnection/reload recovery, bounded batch sizes, and per-plan serialization.
- [ ] Distinguish saved locally, synced, offline/pending, conflict, and failed in the UI. Surface quota/parse/write errors without replacing recoverable data with defaults.

### 3. Versioned plans and safe migration
- [ ] Implement `plans`, `plan_revisions`, constraints, RLS, and atomic conditional write/restore functions; preserve conflicting drafts rather than silently choosing a winner.
- [ ] Back up, backfill repeatably, and validate owners, counts, contents, empty-vs-missing semantics, and pending local drafts.
- [ ] Define compatibility with old installed PWA clients still writing `user_practice_data`; stage cutover and test rollback preserving post-migration writes. No production migration without this gate.
- [ ] Test concurrent writers, lost acknowledgements/retries, account switching during requests, and restore conflicts against Postgres, not mocks alone.

### 4. Incremental activity storage
- [ ] Migrate logs/completions to idempotent records; two offline devices adding 5 and 7 minutes to a shared 10-minute baseline must converge to 22 minutes exactly once.
- [ ] Verify explicit corrections/removals cannot be resurrected and segment/history identity survives plan edits/deletions.
- [ ] Use indexed owner/date queries and pagination; measure payload size, write rates, query latency, and storage growth with representative multi-year data.

### 5. Recovery and operations
- [ ] Capture content-changing revisions only, paginate history, schedule 30-day retention cleanup, and define protected checkpoint/export policy.
- [ ] Verify database backup/PITR availability, independent protected backup needs, acceptable data-loss window (RPO), recovery time (RTO), and perform a restore drill. Revision history alone is not disaster recovery.
- [ ] Monitor sync failures, oldest pending operation age, conflicts, and persistence failures without logging private plan contents.

### 6. History UI and editor maintainability
- [ ] Add in-editor Version History modal/drawer with conflict-safe restore and clear pending/success/failure states.
- [ ] Refactor PlanEditorPane into shared BlockEditor plus domain wrappers, preserving keyboard/touch behavior and segment timer integration.
- [ ] Address `practice-timer-18ly`: make background timer recovery route-independent, wall-clock based, and hosted at app-level provider.
- [ ] Complete full automated regression/build checks and the real-device foreground/background matrix before declaring the epic complete.

## Initial implementation scope (2026-09-16)
Start with phase 1 scheduling/hydration boundaries and timer regression protection. Keep the existing database schema and timer engine intact in this first slice. Durable outbox, CAS, account isolation, activity migration, and production deployment remain explicit follow-up work; this slice does not claim complete cross-device data-loss protection.

## Progress and verification (2026-09-16)
- `practice-timer-14i6`: initial scheduling/hydration refactor, with insert-only first-user initialization and race/failure tests.
- `practice-timer-w2du`: targeted pre-existing timer fixes discovered by regression tests (work-mode preservation, paused iOS time, repeated background drift, lifecycle cleanup).
- Baseline 239 tests / 27 files; updated 291 tests / 31 files pass. TypeScript, scoped zero-warning lint, production build, and whitespace checks pass.
- Global `test-setup.ts` polyfilled with standard `localStorage` mock to guarantee isolated test execution in Node 22 / jsdom across parallel workers.
- `practice-timer-18ly`: high-priority release blocker for app-wide timer lifecycle, authoritative wall-clock recovery, segment runtime persistence, integration tests, and real-device checks. Home currently owns iOS lifecycle; worker ticks alone do not compensate for suspended callbacks.
- See `docs/PLAN-storage-reliability-validation.md` for precise verified coverage and remaining gates. No production migration, browser/device verification, or claim of complete all-surface background correctness.

## Second slice (2026-09-16)
`practice-timer-9lni` completed: removed user-facing Account maintenance workarounds and hardened single-tab automatic sync/auth lifecycle. 291 tests/31 files, TypeScript and build pass. In-memory pending revisions guard dirty pulls and retry on reconnect/focus; queued/stale request handling and empty-plan propagation covered. Full account-scoped persistence, durable outbox/reload recovery, conflict-safe versioned writes, incremental activity and recovery operations remain unfinished. Next implementation gate remains phases 2-3; do not interpret this slice as full cross-device reliability.

---
# practice-timer-9lni
title: Remove account maintenance workarounds and harden automatic sync lifecycle
status: completed
type: task
priority: normal
created_at: 2026-09-16T15:01:10Z
updated_at: 2026-09-16T17:33:36Z
parent: practice-timer-psf6
---

Remove the Data & Device Utilities card and unused handlers from Account. Harden single-tab automatic sync: serialize requests, preserve pending edits across pulls, retry pending work on reconnect, discard stale account responses, and clean up lifecycle listeners. Add regression tests. This slice does not claim durable offline outbox, cross-device conflict resolution, or complete account-scoped storage; those remain gates in the parent epic.

## Summary of Changes
Removed Account maintenance UI and unused recovery/cache/manual-sync handlers. Added serialized single-tab sync, pending revision hydration guards, reconnect/focus retries, empty-plan propagation, insert-only initialization retries, stale-account response invalidation, and cleanup-safe auth/sync listeners. Deferred auth hydration outside auth callbacks and guarded stale loading state. Added 20 regression tests; 291 tests/31 files, TypeScript, scoped strict lint and build pass. AuthContext retains a pre-existing react-refresh warning; build has Browserslist/chunk-size warnings. No browser/live DB/deployment performed. Durable outbox, reload-safe drafts, account-local data isolation, CAS, incremental activity, backups and conflict/status UI remain in parent epic. See docs/PLAN-storage-reliability-validation.md.

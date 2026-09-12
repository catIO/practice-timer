---
# practice-timer-5xw7
title: Fix PWA update reload blocked by isRunning guard
status: completed
type: bug
priority: normal
created_at: 2026-09-12T12:02:18Z
updated_at: 2026-09-12T12:02:56Z
---

Allow explicit user-initiated updates to reload even if isRunning was previously flagged true, preventing silently dropped updates on iOS.

## Summary of Changes
- Removed `if (isRunning) return;` from `triggerReload` in `App.tsx` and `controllerchange` in `main.tsx`.
- When a user explicitly clicks 'Update' in the update toast, the reload now proceeds immediately rather than being silently aborted if the timer was flagged as running in state.

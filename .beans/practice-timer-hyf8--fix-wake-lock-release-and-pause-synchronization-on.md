---
# practice-timer-hyf8
title: Fix wake lock release and pause synchronization on iPad
status: completed
type: bug
priority: normal
created_at: 2026-09-12T11:30:47Z
updated_at: 2026-09-12T11:32:27Z
---

Ensure segment timer pause suspends session timer and releases wake lock; suspend AudioContext and tear down video fallback on pause.


- [x] Connect onPause / pauseTimer to segment timer pause in PlanEditorPane so isRunning is set to false
- [x] Suspend Web Audio context on stopSilenceKeepAlive to prevent iOS media session keep-alive
- [x] Call removeAttribute('src') and load() on fallback video cleanup in wakeLockManager
- [x] Verify tests and build

## Summary of Changes
- Connected `pauseTimer` to segment timer pause in `PlanEditorPane.tsx` so pausing a segment sets `isRunning: false` and stops background countdown.
- Added `!(activePieceId && isPiecePaused)` safeguard to `useGlobalWakeLock.ts` so wake lock is immediately released whenever a piece timer is paused.
- Suspended the Web Audio context in `stopSilenceKeepAlive` (`soundEffects.ts`) on pause so iOS Safari does not keep the screen awake due to a running audio session.
- Added `removeAttribute('src')` and `.load()` to `wakeLockManager.ts` fallback video cleanup so WebKit immediately tears down the video pipeline on release.

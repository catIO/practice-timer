---
# practice-timer-8u5q
title: Fix iPad screen wake lock and add keep-screen-awake user setting
status: completed
type: bug
priority: normal
created_at: 2026-08-31T09:21:02Z
updated_at: 2026-08-31T09:25:22Z
---

Ensure screen wake lock works reliably on iPad and desktop browsers by updating iPad detection, implementing modern wakeLock lifecycle with seamless fallback, adding 'keepScreenAwake' user preference, and ensuring audio playback and catch-up on completion.

## Summary of Changes
- Created [device.ts](file:///Users/catherina/Documents/apps/practice-timer/client/src/lib/device.ts) with iPadOS desktop-mode multi-touch detection.
- Created [wakeLockManager.ts](file:///Users/catherina/Documents/apps/practice-timer/client/src/lib/wakeLockManager.ts) supporting native Screen Wake Lock with seamless inline video loop fallback, visibilitychange re-acquisition, and zero-CPU footprint.
- Added 'keepScreenAwake' preference in [timerService.ts](file:///Users/catherina/Documents/apps/practice-timer/client/src/lib/timerService.ts), [schema.ts](file:///Users/catherina/Documents/apps/practice-timer/shared/schema.ts), and added a toggle switch to [Settings.tsx](file:///Users/catherina/Documents/apps/practice-timer/client/src/pages/Settings.tsx).
- Fixed the wake-lock lifecycle bug in [useTimer.ts](file:///Users/catherina/Documents/apps/practice-timer/client/src/hooks/useTimer.ts) where previous effects prematurely released the lock on render.
- Added comprehensive unit tests in [device.test.ts](file:///Users/catherina/Documents/apps/practice-timer/client/src/lib/device.test.ts) and [wakeLockManager.test.ts](file:///Users/catherina/Documents/apps/practice-timer/client/src/lib/wakeLockManager.test.ts).

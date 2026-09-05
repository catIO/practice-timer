---
# practice-timer-8onr
title: Fix screen lock prevention across all pages and harden for iPad
status: completed
type: bug
priority: high
created_at: 2026-09-05T10:19:47Z
updated_at: 2026-09-05T10:22:22Z
---

Enable screen lock prevention across all app screens (Timer, Practice Plan, Lesson Plan, etc.) when keepScreenAwake is enabled, and harden wake lock manager against WebKit releases and video fallback throttling on iPad.

## Summary of Changes
- Created useGlobalWakeLock hook mounted at root level in App.tsx to keep the screen awake across all pages (Timer, Practice Plan, Lesson Plan, Settings, etc.) whenever keepScreenAwake is enabled.
- Hardened wakeLockManager for iPadOS WebKit:
  - Repositioned video fallback from offscreen (-9999px) to in-viewport micro-dimensions (1px x 1px, 0.001 opacity, fixed bottom-right) to prevent WebKit power management throttling.
  - Added auto-recovery fallback when WebKit revokes sentinels during iPad multitasking, split-view, or dimming.
  - Added user gesture recovery queue so wake lock is immediately secured on next touch if initially blocked by Safari autoplay/gesture restrictions.
- Removed localized unmount wake lock releases in useTimer.ts and Home.tsx that previously caused screen lock prevention to terminate upon navigating away from the timer page.
- Updated Settings description to accurately reflect app-wide screen awake behavior.
- Added comprehensive unit tests for useGlobalWakeLock and hardened wakeLockManager.

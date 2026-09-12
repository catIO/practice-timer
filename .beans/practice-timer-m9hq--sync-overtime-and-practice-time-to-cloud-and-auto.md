---
# practice-timer-m9hq
title: Sync overtime and practice time to cloud and auto-pull on tab focus
status: completed
type: bug
priority: normal
created_at: 2026-09-12T21:33:57Z
updated_at: 2026-09-12T21:35:39Z
---

Overtime and segment practice time logged on iPad was not pushed to Supabase or pulled on desktop

## Summary of Changes
- **Timer Store Overtime & Segment Sync**: Added debounced cloud push (`scheduleUserDataPush(5000)`) to `attributePracticeTime` during active piece and overtime ticks. Added immediate cloud push (`scheduleUserDataPush(0)`) on `stopPieceOvertime`, `pauseTimer`, `resetTimer`, `clearPiece`, `togglePausePiece`, `COMPLETE`, and `PRACTICE_COMPLETE`.
- **Sync on Focus & Backgrounding**: Updated `initUserDataSync` in `userDataSync.ts` to immediately flush data to cloud on `visibilitychange === 'hidden'` and `pagehide`, and pull latest cloud data on `visibilitychange === 'visible'` and window `focus` (with a 10s throttle).
- **Practice Log Re-render**: Added listener for `plan-data-synced` in `PracticeLog.tsx` so views update automatically when remote sync completes.
- **Manual Cloud Sync**: Added 'Cloud Sync' action with 'Sync Now' button in Account Settings (under Data & Device Utilities).

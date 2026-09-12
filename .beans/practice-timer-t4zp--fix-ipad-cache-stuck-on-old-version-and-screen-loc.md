---
# practice-timer-t4zp
title: Fix iPad cache stuck on old version and screen lock not releasing on timer completion
status: completed
type: bug
priority: normal
created_at: 2026-09-12T14:13:38Z
updated_at: 2026-09-12T15:22:08Z
---

1. Fix ReferenceError window in sw.js activate handler which caused service worker activation to fail and cache to remain stale on iPad. 2. Call stopSilenceKeepAlive on COMPLETE and PRACTICE_COMPLETE in timerStore so audio session does not keep iPad screen awake when time finishes. 3. Add Check for Updates / Reload button in Settings for easy cache busting on iPad PWA.

## Summary of Changes
- Fixed `ReferenceError: window is not defined` in `client/public/sw.js` `registerBackgroundSync()` which caused the Service Worker `activate` event to fail, preventing new versions from activating and old caches from being purged on iPad.
- Bumped `CACHE_NAME` to `practice-timer-v4` and added `CLEAR_CACHE` message handler in `sw.js`.
- Fixed iOS screen lock prevention by calling `stopSilenceKeepAlive()` on `COMPLETE` and `PRACTICE_COMPLETE` in `timerStore.ts`, suspending the Web Audio context so iOS doesn't keep the display awake due to an active audio session.
- Added stray fallback video cleanup in `wakeLockManager.ts` on release.
- Added an 'App Updates & Cache' card in Settings with a 'Check for Updates & Reload' button that clears CacheStorage and triggers service worker updates for 1-click cache busting on iOS/iPadOS PWAs.


- Also fixed `playSoundWebAudio` in `soundEffects.ts` and `case 'PLAY_SOUND'` in `timerStore.ts`: when the timer ended and played completion chimes/beeps, `AudioContext` was resumed to play the sound and left in `running` state permanently. On iOS WebKit, an active (non-suspended) `AudioContext` holds an active media session that prevents the device from locking or sleeping. Added auto-suspension upon sound completion.


- Removed video loop fallback and base64 MP4 data URI from `wakeLockManager.ts`. The wake lock manager now relies strictly on the native W3C Screen Wake Lock API (`navigator.wakeLock`) supported natively on modern iOS/iPadOS 16.4+, Chrome, Edge, and Firefox.

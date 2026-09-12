---
# practice-timer-oxdb
title: Fix completion sound playback cut-off and premature AudioContext suspension on iPad
status: completed
type: bug
priority: normal
created_at: 2026-09-12T20:57:18Z
updated_at: 2026-09-12T20:59:36Z
---

StopSilenceKeepAlive and premature audio suspension in timer completion handler kills completion audio on iOS/iPadOS

## Summary of Changes

- Isolated silent keepalive loop teardown (`stopSilenceKeepAlive`) from AudioContext suspension (`suspendAudioContext`). Previously, `stopSilenceKeepAlive()` immediately invoked `ctx.suspend()`. When the timer finished, the worker posted `PLAY_SOUND` and `COMPLETE` back-to-back; `case 'COMPLETE'` synchronously called `stopSilenceKeepAlive()`, which suspended the `AudioContext` before the completion beeps could start or finish.
- On iOS/iPadOS Safari, resuming a suspended `AudioContext` requires a direct user gesture; because the timer finishes automatically without user interaction, iOS blocked the resume, muting the completion audio entirely.
- Added active sound tracking and awaited the decay of the final beep in `playSoundWebAudio` so the sound finishes playing before resolving.
- Automatically suspend `AudioContext` only after all sound decay has finished (when `!silentSource`), allowing iOS to enter sleep/auto-lock normally while ensuring full audio playback.
- If sound is disabled or muted in settings, `suspendAudioContext()` is called immediately so iOS screen lock is not blocked.
- Added `suspendAudioContext()` calls on manual user actions (pause, reset, skip, stopPieceOvertime).
- Bumped Service Worker cache version to `practice-timer-v5` in `sw.js` to guarantee iPad PWAs cleanly update and clear stale caches.
- Added unit test suite in `client/src/lib/soundEffects.test.ts` verifying volume normalization, iPad userAgent detection, keepalive lifecycle, and deferred AudioContext suspension.

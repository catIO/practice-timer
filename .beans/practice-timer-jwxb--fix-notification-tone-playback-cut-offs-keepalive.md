---
# practice-timer-jwxb
title: Fix notification tone playback cut-offs, keepalive lifecycle, and audio context suspension
status: completed
type: bug
priority: high
created_at: 2026-09-14T12:21:28Z
updated_at: 2026-09-14T12:25:02Z
---

Notification tones sometimes do not play or get cut off due to premature keepalive teardown, JS setTimeout throttling in background, AudioContext suspension timing, and duplicate sound triggers across pages.

## Summary of Changes

- **Timeline-based oscillator scheduling**: Replaced sequential JavaScript `setTimeout` loops in `playSoundWebAudio` with direct scheduling on the `AudioContext` hardware timeline. In background tabs or with locked/sleeping screens, browsers (especially iOS Safari) throttle or pause JS timers, which previously delayed or completely cut off beeps 2 and 3. All beeps are now scheduled up front on the audio hardware clock.
- **Deferred silence keepalive teardown**: When `stopSilenceKeepAlive()` is called upon segment or session completion, if sounds are actively playing (`activeSoundsCount > 0`), keepalive teardown is deferred until all beeps finish decaying. This prevents iOS Safari from detecting an audio gap and suspending the background audio session while notification tones are playing.
- **Overtime audio protection**: Ensured keepalive is maintained during segment overtime transitions in `COMPLETE` and initialized in `startPieceOvertime`. Added direct piece completion tone playback in `timerStore.ts` when piece time expires.
- **Removed duplicate audio triggers**: Consolidated sound playback into `timerStore.ts` as single source of truth, eliminating redundant and racing `playSound` invocations from `LessonPlan.tsx`, `PracticePlan.tsx`, `useTimer.ts`, and `PlanEditorPane.tsx`.
- **Ramp safety**: Clamped initial gain to `Math.max(0.0001, normalizedVolume)` and target to `0.0001` to prevent Web Audio `exponentialRampToValueAtTime` zero/negative value exceptions.
- **Test coverage**: Added unit test in `soundEffects.test.ts` verifying deferred keepalive teardown and AudioContext suspension during active sound decay.

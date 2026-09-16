---
# practice-timer-18ly
title: Make background timer recovery route-independent and wall-clock based
status: todo
type: feature
priority: high
created_at: 2026-09-16T14:32:41Z
updated_at: 2026-09-16T14:35:03Z
parent: practice-timer-psf6
blocked_by:
    - practice-timer-14i6
    - practice-timer-w2du
---

Release blocker discovered while validating the storage refactor. Core store and iOS-helper unit tests pass, but these are not proof of integrated route-independent background timing.

## Verified current gaps
- Home.tsx owns useTimer; useTimer initializes and cleans up the iOS helper. PracticePlan/LessonPlan/sidebar use the store directly, so the iOS lifecycle is not app-wide.
- timerWorker.ts startTimer decrements once per callback; startPieceTicks emits one second per callback. Missed/suspended callbacks are not elapsed-time checkpoints.
- Store and iOS helper both update the main countdown. Integration must use one authoritative timeline to prevent stale worker values restoring time or double-attributing catch-up.
- Timer progress persistence currently omits active segment runtime state.

## Tasks
- [ ] Move runtime lifecycle to a single persistent app-level owner, independent of route consumers and cloud hydration.
- [ ] Reconcile main and segment/overtime time using elapsed timestamps/checkpoints, explicit pause boundaries, and idempotent completion. Avoid two competing clocks.
- [ ] Define recovery across app suspension vs process termination; persist required main/segment runtime state without auto-starting a deliberately paused timer.
- [ ] Test actual worker plus store/lifecycle integration for clock jumps, duplicate/stale deliveries, route navigation/unmount, pause/resume, work/break transitions, overtime and sync overlap.
- [ ] Verify iPad/iPhone Safari and installed PWA, desktop Chromium/Safari/Firefox, lock/unlock and hidden-tab return. Sounds/notifications remain OS-permission and suspension dependent; no promise of uninterrupted JS execution.

Depends on the first safety slice; do not claim all-surface background acceptance until these gates pass.

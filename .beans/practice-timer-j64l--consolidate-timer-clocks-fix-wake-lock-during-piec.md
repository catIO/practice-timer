---
# practice-timer-j64l
title: Consolidate timer clocks & fix wake-lock during piece overtime
status: completed
type: task
priority: normal
created_at: 2026-08-11T14:57:32Z
updated_at: 2026-08-11T15:09:06Z
---

Three-part refactor to make the timer more robust while preserving all core functionality (main Pomodoro, segment/piece timer, overtime continuation, wake-lock on the timer page).

Motivation:
- Piece decrement + completion logic is duplicated in three places in client/src/stores/timerStore.ts (TICK handler, setTimeRemaining, and startPieceOvertime interval).
- Wake lock is only re-acquired/kept alive when isRunning is true; during piece-overtime after PRACTICE_COMPLETE the screen can sleep.
- Piece overtime runs on a main-thread setInterval which is heavily throttled when the tab is backgrounded; moving it into the Web Worker improves accuracy and gives a single clock source.

Scope:
- [x] Step 1: Wake-lock coverage for overtime. In client/src/hooks/useTimer.ts, key wake-lock acquisition/keepalive/visibility effects off (isRunning || pieceOvertimeRunning) instead of just isRunning.
- [x] Step 2: Extract shared piece decrement/completion helper in client/src/stores/timerStore.ts; use it from TICK handler, setTimeRemaining, and piece-overtime ticker.
- [x] Step 3: Move piece-overtime ticks into the Web Worker. Add PIECE_TICK_START / PIECE_TICK_STOP incoming messages and a PIECE_TICK outgoing message in client/src/workers/timerWorker.ts. Store handles PIECE_TICK via the shared helper. Remove the setInterval in the store.
- [x] Update tests in client/src/stores/timerStore.test.ts as needed.
- [x] npm run check passes.

Constraints (must preserve):
- Main timer, segment timer, overtime continuation, wake lock behavior on the timer page.



## Summary of Changes

**Step 1 — Wake-lock coverage** (client/src/hooks/useTimer.ts, client/src/pages/Home.tsx):
- Destructured pieceOvertimeRunning from the store.
- Visibility handler and 2-minute keepalive effect now key off (isRunning || pieceOvertimeRunning), so wake locks stay held while segment overtime continues after PRACTICE_COMPLETE.
- Keepalive effect calls ensureWakeLock() immediately when it fires (not only every 120s), so cold-start overtime from a fully-idle timer acquires a wake lock right away.
- Home.tsx wake-lock status poller extended to overtime as well.

**Step 2 — Shared piece-attribution helper** (client/src/stores/timerStore.ts):
- Added attributePracticeTime(diff) that centralizes: no active piece -> addPracticeTime; piece paused -> addPracticeTime; active + unpaused -> addDetailedPracticeTime + decrement pieceTimeRemaining + on-reach-zero completion (logSegmentCompletion, practicePlanApi.checkItem, scheduleUserDataPush, piece-timer-complete event, clear piece state).
- TICK handler and setTimeRemaining now call this helper (removed duplicated inline blocks).
- Removes ~55 lines of duplicated logic.

**Step 3 — Worker-driven piece ticks** (client/src/workers/timerWorker.ts, client/src/stores/timerStore.ts):
- Added PIECE_TICK_START / PIECE_TICK_STOP inbound messages and PIECE_TICK outbound message to the worker. Uses self.setInterval so ticks aren't throttled when the tab is backgrounded.
- startPieceOvertime now just sets pieceOvertimeRunning=true and posts PIECE_TICK_START. stopPieceOvertime posts PIECE_TICK_STOP and clears the flag.
- Removed module-level pieceOvertimeIntervalId variable and its 4 usage sites (resetTimer, skipTimer, clearPiece, shadow set); each now calls stopWorkerPieceTicks().
- Added PIECE_TICK case in message handler that guards on pieceOvertimeRunning and delegates to attributePracticeTime(1).
- Single clock source (the worker); overtime survives tab backgrounding as reliably as the main timer.

**Tests** (client/src/stores/timerStore.test.ts):
- Worker mock now captures the store's message handler and exposes an emitPieceTick() helper.
- startPieceOvertime test rewritten to drive the store via simulated PIECE_TICK messages instead of vi.advanceTimersByTime, plus asserts PIECE_TICK_START/STOP postMessage. Test also sets mode='break' so the shadow-set derivation keeps pieceOvertimeRunning=true.

**Verification**:
- npm run check (tsc --noEmit + functions vitest) passes.
- Client-side timerStore.test.ts (11 tests) passes when run with an ad-hoc jsdom config. Note: client tests aren't wired into npm run check by the repo's current vitest config; that gap is pre-existing and out of scope.

**Preserved behaviors** (per user requirements):
- Main Pomodoro timer.
- Segment (piece) timer.
- Segment timer can continue after main work-session completes (overtime).
- Screen stays awake on the timer page while either main timer or segment overtime is running.

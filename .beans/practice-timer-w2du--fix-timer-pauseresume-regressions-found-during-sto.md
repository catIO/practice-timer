---
# practice-timer-w2du
title: Fix timer pause/resume regressions found during storage safety checks
status: completed
type: bug
priority: high
created_at: 2026-09-16T14:19:47Z
updated_at: 2026-09-16T14:34:51Z
parent: practice-timer-psf6
---

Regression tests exposed pre-existing timer defects; fix before completing the first storage slice.

## Tasks
- [x] Preserve a legitimate work mode when resuming at exactly break-duration remaining.
- [x] Rebase iOS helper elapsed time on resume so paused time is excluded.
- [x] Detach iOS lifecycle listeners on cleanup and verify repeated background recovery never adds time back.
- [x] Convert expected-failure tests to ordinary passing regression tests and validate core timer suite.

No claim of uninterrupted OS background execution; real-device checks remain an epic release gate.



## Summary of Changes
Reproduced five failing cases, then fixed work-mode equality, paused-time inclusion for both modes, double-applied drift, and listener cleanup. Final result: 271 tests/29 files plus TypeScript, scoped lint, and build passed.

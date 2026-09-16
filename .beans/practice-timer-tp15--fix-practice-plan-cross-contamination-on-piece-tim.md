---
# practice-timer-tp15
title: Fix practice plan cross-contamination on piece timer complete and expand snapshot buffer
status: completed
type: bug
priority: critical
created_at: 2026-09-16T12:11:01Z
updated_at: 2026-09-16T12:13:32Z
---

## Tasks
- [x] Guard handlePieceComplete in PlanEditorPane to only run when planType === 'practice' and use planApi
- [x] Increase snapshot ring buffer limit in planStoreHelpers from 5 to 25 (expanded to 30)
- [x] Run existing tests and add unit tests verifying PlanEditorPane event listener isolation and sync collision guard

## Summary of Changes
- Guarded `handlePieceComplete` in `PlanEditorPane.tsx` so it only attaches and executes when `planType === 'practice'`, and uses injected `planApi` instead of hardcoded `practicePlanApi`.
- Increased snapshot ring-buffer limit in `planStoreHelpers.ts` from 5 to 30.
- Separated `PERMANENT_SHARE_ID_KEY` and `LAST_PUBLISHED_DATE_KEY` in `lessonPlan.ts` from practice plan keys to prevent collision.
- Added collision safety check in `pushUserDataToCloud` (`userDataSync.ts`) to block cloud sync if practice plan and lesson plan ever become identical.
- Verified test suite and added regression test for collision prevention.

---
# practice-timer-hooh
title: Capture checked date for lesson plan items and display checked status in published reports
status: completed
type: feature
priority: normal
created_at: 2026-08-15T17:08:33Z
updated_at: 2026-08-15T17:17:28Z
---

Capture date when lesson plan items are checked and display checked/unchecked status with completion date in published reports (lesson plan only).


## Tasks
- [x] 1. Update planTypes.ts and planStoreHelpers.ts to track checkedDate
- [x] 2. Update reportShare.ts to serialize checkedDate
- [x] 3. Support Tab and Shift+Tab sub-items in PlanEditorPane.tsx and display checkedDate on lesson plan items
- [x] 4. Update Report.tsx to display checked/unchecked status and dates on lesson plan tab
- [x] 5. Update unit tests in lessonPlan.test.ts and verify tests pass

## Summary of Changes

- Added `checkedDate` optional ISO timestamp tracking to `PlanItem` and `ReportSnapshotItem`.
- Updated `planStoreHelpers.ts` to automatically record `checkedDate` when checking an item and clear it when unchecking or resetting checks.
- Added Tab and Shift+Tab keyboard indentation while editing inputs in `PlanEditorPane.tsx` to seamlessly nest and organize sub-items under checkboxes and other block types in both Practice Plan and Lesson Plan while maintaining continuous focus.
- Added subtle completed date badges (`✓ Aug 15`) next to checked items in Lesson Plan (`planType === "lesson"`) without altering Practice Plan presentation.
- Updated `Report.tsx` to display checked and unchecked checkbox status and completion date badges for items on the Lesson Plan tab, while preserving Practice Plan styling.
- Added unit tests in `lessonPlan.test.ts` covering `checkedDate` tracking and report snapshot status.

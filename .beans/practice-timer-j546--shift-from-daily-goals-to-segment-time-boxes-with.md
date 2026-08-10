---
# practice-timer-j546
title: Shift from daily goals to segment time boxes with 7-day completion logging and device sync
status: completed
type: feature
priority: normal
created_at: 2026-08-10T11:36:27Z
updated_at: 2026-08-10T11:40:20Z
---

Shift practice log model from daily/weekly goals to time box segment durations. Log segment completions in rolling 7 days. Sync user plan and logs via Supabase.

## Summary of Changes
- Shifted practice logging from daily/weekly goal quotas to target segment time boxes.
- Implemented weekly segment completion tracking aligned with the user's configured week start day (weekStartsOn: monday/sunday).
- Added logSegmentCompletion, getSegmentCompletionsForThisWeek, and getSegmentCompletionsLast7Days in practiceLog.ts.
- Updated PlanEditorPane.tsx, PracticeLog.tsx, and Report.tsx to render weekly completion counts (e.g. 3x this week) and time box durations.
- Created Supabase migration 005_user_practice_data.sql and userDataSync.ts to sync user plans, detailed logs, and completions across devices.

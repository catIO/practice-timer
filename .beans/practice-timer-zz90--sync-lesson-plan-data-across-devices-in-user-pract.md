---
# practice-timer-zz90
title: Sync lesson plan data across devices in user_practice_data
status: completed
type: bug
priority: normal
created_at: 2026-08-10T19:35:35Z
updated_at: 2026-08-10T19:36:00Z
---

Ensure lesson plan data is included in cloud sync (push/pull) for authenticated users



## Summary of Changes
- Added 006_add_lesson_plan_data.sql migration to add lesson_plan_data column to user_practice_data.
- Updated pullUserDataFromCloud() and pushUserDataToCloud() in client/src/lib/userDataSync.ts to sync lesson_plan_data to/from Supabase.
- Added userDataSync.test.ts to test push and pull sync of lesson plans across devices.

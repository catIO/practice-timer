---
# practice-timer-m2c4
title: Replace sign-in plan placeholder flash with loading indicator
status: completed
type: bug
priority: normal
created_at: 2026-09-12T17:22:59Z
updated_at: 2026-09-12T17:23:46Z
---

When signing in, placeholder practice plan text flashed before remote cloud data finished syncing. Replaced with isSyncingData loading indicator in AuthContext and plan editor panes.

## Summary of Changes

- Identified root cause: When signing in, auth state resolved to logged in while asynchronous cloud data sync (`pullUserDataFromCloud`) was still in-flight over network. Local storage fallback generated and rendered default dummy blocks ('Work session 1', 'Work session 2', etc.) until the network payload arrived.
- Added `isSyncingData` flag to `AuthContext` to track initial load and sign-in remote data synchronization.
- Updated `PracticePlan.tsx`, `LessonPlan.tsx`, and `PlanEditorPane.tsx` to show a loading spinner indicator while `isSyncingData` is true.
- Dispatched `plan-data-synced` window event and added `isSyncingData` to `PlanEditorPane`'s dependency array to guarantee immediate refresh when sync completes.

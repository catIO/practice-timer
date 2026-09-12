---
# practice-timer-54ed
title: Refactor Settings page and modernize General settings layout
status: completed
type: task
priority: normal
created_at: 2026-09-12T17:34:37Z
updated_at: 2026-09-12T17:35:55Z
---

Decompose Settings.tsx monolith into reusable components (SettingCard, SettingRow, NumberStepper) and split into GeneralSettingsTab and AccountSettingsTab with modern card styling and consistent typography.

## Summary of Changes

- Modularized Settings architecture:
  - Created `SettingCard.tsx`: Reusable card wrapper with header icon, title, description, and content slots matching the app design system.
  - Created `SettingRow.tsx`: Consistent horizontal responsive row mapping icon, title, and description with right-aligned control slots.
  - Created `NumberStepper.tsx`: Generic clamped stepper component for durations, beeps, and iterations.
  - Created `GeneralSettingsTab.tsx`: Organized into 'Sound & Alerts', 'Timer & Intervals', and 'Appearance & Display' with preview sound buttons and proper slider commit handling.
  - Created `AccountSettingsTab.tsx`: Card-based account profile, password management, data recovery, and iPad/PWA cache reload utilities.
  - Refactored `Settings.tsx` from a 700+ line monolith into a clean 115-line coordinator managing URL query syncing and tab delegation.

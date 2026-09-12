---
# practice-timer-b2g1
title: Fix invisible drag handle intercepting checkbox taps on touch devices
status: completed
type: bug
priority: normal
created_at: 2026-09-12T21:03:34Z
updated_at: 2026-09-12T21:04:03Z
---

Invisible drag handle in left gutter intercepted touch taps intended for checkboxes, triggering unexpected Delete menu

## Summary of Changes

- Added `pointer-events-none` to the left gutter container in `PlanEditorPane.tsx` when `opacity-0`. The controls now only accept pointer events when hovered (`group-hover:pointer-events-auto`), focused (`group-focus-within:pointer-events-auto`), or when the menu is actively open (`dragMenuOpen`).
- Removed `after:-inset-1.5` hit target expansion from the drag handle button so its touch hitbox does not bleed into the adjacent checkbox.
- Elevated the checkbox with `relative z-10` to ensure checkbox taps take absolute priority over any adjacent gutter elements.

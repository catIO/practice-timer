---
# practice-timer-puqm
title: Improve touch responsiveness on iPad for checkboxes and segment timers
status: completed
type: bug
priority: normal
created_at: 2026-09-12T11:20:47Z
updated_at: 2026-09-12T11:22:22Z
---

Fix double-tap requirement on iPad by enabling hoverOnlyWhenSupported, expanding touch targets, isolating pointer events on controls, and separating dnd-kit mouse/touch sensors.


- [x] Enable future: { hoverOnlyWhenSupported: true } in tailwind.config.ts
- [x] Expand touch hit targets on checkboxes and segment timer play/check buttons
- [x] Isolate pointer and touch events on interactive controls to prevent row selection churn
- [x] Configure dnd-kit with separate MouseSensor and TouchSensor (delay-based touch activation)
- [x] Verify with tests and build

## Summary of Changes
- Enabled `future: { hoverOnlyWhenSupported: true }` in `tailwind.config.ts` to ensure hover states do not trap touch taps on iOS / iPadOS Safari.
- Added `after:absolute after:-inset-...` hit target expansions and `touch-manipulation` to plan checkboxes, segment time box play buttons, segment check buttons, allocation pills, and drag handles.
- Added `onTouchStart={(e) => e.stopPropagation()}` and `onPointerDown` isolation across all interactive buttons in `PlanEditorPane.tsx` to prevent row selection churn and focus theft from dropping touch click events.
- Replaced `PointerSensor` with separate `MouseSensor` (distance constraint) and `TouchSensor` (delay constraint) so finger taps and flicks are not intercepted as drag-and-drop actions.

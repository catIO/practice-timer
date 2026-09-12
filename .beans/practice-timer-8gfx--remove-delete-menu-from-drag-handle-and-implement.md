---
# practice-timer-8gfx
title: Remove delete menu from drag handle and implement focus-activated row actions
status: completed
type: task
priority: normal
created_at: 2026-09-12T21:12:20Z
updated_at: 2026-09-12T21:13:04Z
---

Remove delete dropdown from drag handle making it drag-only, and ensure controls are focus-activated

## Summary of Changes

- Removed the `DropdownMenu` delete menu from the drag handle (`drag_indicator`) in `PlanEditorPane.tsx`.
- The drag handle is now exclusively a drag-and-drop reorder handle (`title="Drag to reorder"`), eliminating accidental delete menu popups when tapping on touch devices.
- Gutter controls (Add block and Drag handle) are now focus/edit-activated (`editing ? "opacity-100 pointer-events-auto z-20" : "z-0"`), keeping checkboxes completely isolated and unobstructed during standard practice review.
- Deleting segments remains available via the dedicated red trashcan Delete button in the segment editor form, and deleting empty blocks remains available via Backspace.

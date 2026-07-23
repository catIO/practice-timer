---
# practice-timer-j1h6
title: Fix repertoire detail page editor issues
status: todo
type: bug
priority: normal
created_at: 2026-07-23T12:24:48Z
updated_at: 2026-07-23T12:25:52Z
---

Investigate and resolve editor functionality issues on the repertoire detail page.

## Identified Editor & Page Bugs

1. **Cloned Piece Block ID Collision**:
   -  in `RepertoireDetail.tsx` copies `notes` array directly, retaining original block IDs. Regenerate unique IDs for all blocks when cloning a piece to prevent React key collisions and editor state corruption.

2. **Duplicate Button Handlers for Video URL**:
   - In `RepertoireDetail.tsx`, both the "Replace URL" button and "Remove" button execute the exact same `onClick={() => updateField('video_url', '')}` handler without focusing the replacement input.

3. **Inline Toolbar & Link Popover Blur Lockout**:
   - In `RepertoireEditor.tsx`, `onBlur` on textareas sets `editing = false` when interacting with formatting tools because `onToolbarInteraction` is an empty no-op and popover open refs desync during click events.

4. **Slash Command Index Out-of-Bounds on Filter**:
   - When filtering slash commands (e.g. typing `/y`), `slashHighlight` index is not clamped when `filteredSlash` array shrinks. Pressing Enter attempts to access out-of-bounds array indices.

5. **Markdown Shortcut Prefix Cleanup**:
   - Converting a block to heading or list via markdown space shortcuts (e.g. `# ` or `- `) needs to ensure clean text stripping and caret positioning across block type conversions.

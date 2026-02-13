import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  type PracticePlanItem,
  type BlockType,
  getPracticePlan,
  savePracticePlan,
  practicePlanApi,
  generateId,
} from "@/lib/practicePlan";
import { createReportSnapshot, getReportShareUrl } from "@/lib/reportShare";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { TextWithLinks } from "./TextWithLinks";
import { InlineToolbar } from "./InlineToolbar";
import { LinkModal } from "./LinkModal";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface PracticePlanPaneProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const BLOCK_OPTIONS: { type: BlockType; label: string; icon: string }[] = [
  { type: "text", label: "Text", icon: "T" },
  { type: "heading1", label: "Heading 1", icon: "H1" },
  { type: "heading2", label: "Heading 2", icon: "H2" },
  { type: "heading3", label: "Heading 3", icon: "H3" },
  { type: "bullet", label: "Bulleted list", icon: "•" },
  { type: "number", label: "Numbered list", icon: "1." },
  { type: "todo", label: "To-do list", icon: "☐" },
];

function EmptyLineSlot({
  index,
  onInsert,
}: {
  index: number;
  onInsert: (index: number, blockType: BlockType) => void;
}) {
  return (
    <div
      className="group/empty relative h-2 -my-1 w-full z-10 flex items-center justify-center transition-opacity opacity-0 hover:opacity-100"
      role="separator"
    >
      <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-background shadow-sm border rounded px-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 rounded hover:bg-muted"
              title="Add block"
            >
              <span className="material-icons text-base">add</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel className="text-muted-foreground">Basic blocks</DropdownMenuLabel>
            {BLOCK_OPTIONS.map(({ type, label, icon }) => (
              <DropdownMenuItem
                key={type}
                onClick={() => onInsert(index, type)}
                className="flex items-center gap-2"
              >
                <span className="w-6 text-center font-semibold text-muted-foreground">{icon}</span>
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {/* visual guide line on hover */}
      <div className="h-0.5 w-full bg-primary/20 rounded-full" />
    </div>
  );
}

function AddLinePlaceholder({
  index,
  onAddLine,
}: {
  index: number;
  onAddLine: (index: number) => void;
}) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onAddLine(index);
    }
  };
  return (
    <div
      tabIndex={0}
      role="button"
      className="flex min-h-8 items-center rounded-md py-0.5 pr-10 outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-accent/50 cursor-pointer"
      onKeyDown={handleKeyDown}
      onClick={() => onAddLine(index)}
      title="Click to add a line"
    >
      <span className="material-icons text-muted-foreground mr-2 ml-1">add</span>
      <span className="text-muted-foreground text-sm">
        Add a block...
      </span>
    </div>
  );
}

function headingLevel(blockType?: BlockType): 1 | 2 | 3 {
  if (blockType === "heading1") return 1;
  if (blockType === "heading2") return 2;
  if (blockType === "heading3") return 3;
  return 1;
}

type FocusRequest = {
  id: string;
  type: "row" | "edit";
  cursorPosition?: "start" | "end" | number;
};

// Flattened item helper type
interface FlatItem {
  id: string;
  item: PracticePlanItem;
  parentId: string | null;
}

// Clone a practice plan item (and its children) with fresh IDs.
function cloneWithNewIds(item: PracticePlanItem): PracticePlanItem {
  return {
    ...item,
    id: generateId(),
    children: item.children.map(cloneWithNewIds),
  };
}

interface PlanItemProps {
  item: PracticePlanItem;
  depth: number;
  focusRequest: FocusRequest | null;
  selectedIdSet: Set<string>;
  onToggle: (id: string) => void;
  onUpdateText: (id: string, text: string) => void;
  onUpdateType: (id: string, type: BlockType) => void;
  onDelete: (id: string) => void;
  onIndent: (id: string) => void;
  onUnindent: (id: string) => void;
  onInsertBelow: (id: string, blockType: BlockType, empty?: boolean) => void;
  onInsertBefore: (id: string, blockType: BlockType, empty?: boolean) => void;
  onNavigate: (id: string, direction: "up" | "down", fromEdit: boolean) => void;
  onMergeWithPrevious: (id: string) => void;
  onInputFocus: (id: string) => void; // Notify parent that this item is focused
  selected: boolean;
  onRowClick: (id: string, e: any) => void;
  onCopySelection: () => void;
  onCutSelection: () => void;
  onPasteBelowSelection: (targetId: string) => void;
  onUndo: () => void;
}

function PlanItem({
  item,
  depth,
  focusRequest,
  selectedIdSet,
  onToggle,
  onUpdateText,
  onUpdateType,
  onDelete,
  onIndent,
  onUnindent,
  onInsertBelow,
  onInsertBefore,
  onNavigate,
  onMergeWithPrevious,
  onInputFocus,
  selected,
  onRowClick,
  onCopySelection,
  onCutSelection,
  onPasteBelowSelection,
  onUndo,
}: PlanItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : undefined, // Ensure dragged item is on top
    position: 'relative' as const, // Fix for z-index
  };

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.text);
  const [toolbarSelection, setToolbarSelection] = useState<{ start: number; end: number } | null>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const linkModalOpenRef = useRef(false);
  useEffect(() => {
    linkModalOpenRef.current = linkModalOpen;
  }, [linkModalOpen]);
  const rowRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const editTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setEditValue(item.text);
  }, [item.text]);

  useEffect(() => {
    return () => {
      if (editTimeoutRef.current) clearTimeout(editTimeoutRef.current);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // Apply pending selection when entering edit mode (from double-click with selection)
  useEffect(() => {
    if (!editing || !pendingSelectionRef.current) return;
    const pending = pendingSelectionRef.current;
    pendingSelectionRef.current = null;
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(pending.start, pending.end);
        setToolbarSelection({ start: pending.start, end: pending.end });
      }
    });
  }, [editing]);

  const blockType = item.blockType ?? "todo";
  const hasChildren = item.children.length > 0;
  const isHeader = item.isHeader === true;
  const level = headingLevel(blockType);
  const showCheckbox = blockType === "todo";

  // Handle Focus Requests
  useEffect(() => {
    if (focusRequest && focusRequest.id === item.id) {
      if (focusRequest.type === "edit") {
        setEditing(true);
        // Defer focus slightly for React to render Input
        requestAnimationFrame(() => {
          if (inputRef.current) {
            inputRef.current.focus();
            if (focusRequest.cursorPosition === "end") {
              inputRef.current.setSelectionRange(inputRef.current.value.length, inputRef.current.value.length);
            } else if (focusRequest.cursorPosition === "start") {
              inputRef.current.setSelectionRange(0, 0);
            } else if (typeof focusRequest.cursorPosition === 'number') {
              inputRef.current.setSelectionRange(focusRequest.cursorPosition, focusRequest.cursorPosition);
            }
          }
        });
      } else if (focusRequest.type === "row") {
        setEditing(false);
        // Defer focus slightly
        requestAnimationFrame(() => {
          rowRef.current?.focus();
        });
      }
    }
  }, [focusRequest, item.id]);

  const saveEdit = useCallback(() => {
    setEditing(false);
    setToolbarSelection(null);
    const trimmed = editValue.trim();
    if (trimmed !== item.text) {
      onUpdateText(item.id, trimmed);
    } else {
      setEditValue(item.text);
    }
  }, [editValue, item.id, item.text, onUpdateText]);

  const applyFormat = useCallback(
    (action: "bold" | "italic" | "link", url?: string) => {
      if (!toolbarSelection || toolbarSelection.start === toolbarSelection.end) return;
      const sel = editValue.slice(toolbarSelection.start, toolbarSelection.end);
      let newText: string;
      let newCursorStart: number;
      let newCursorEnd: number;
      if (action === "bold") {
        newText = editValue.slice(0, toolbarSelection.start) + `**${sel}**` + editValue.slice(toolbarSelection.end);
        newCursorStart = toolbarSelection.start;
        newCursorEnd = toolbarSelection.start + sel.length + 4;
      } else if (action === "italic") {
        newText = editValue.slice(0, toolbarSelection.start) + `*${sel}*` + editValue.slice(toolbarSelection.end);
        newCursorStart = toolbarSelection.start;
        newCursorEnd = toolbarSelection.start + sel.length + 2;
      } else if (action === "link" && url) {
        newText = editValue.slice(0, toolbarSelection.start) + `[${sel}](${url})` + editValue.slice(toolbarSelection.end);
        newCursorStart = toolbarSelection.start;
        newCursorEnd = toolbarSelection.start + sel.length + url.length + 4;
      } else return;
      setEditValue(newText);
      onUpdateText(item.id, newText);
      setToolbarSelection(null);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.setSelectionRange(newCursorStart, newCursorEnd);
      });
    },
    [editValue, item.id, onUpdateText, toolbarSelection]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Clipboard-style operations work on the current selection (managed by parent).
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c") {
        e.preventDefault();
        onCopySelection();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "x") {
        e.preventDefault();
        onCutSelection();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v") {
        e.preventDefault();
        onPasteBelowSelection(item.id);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        onUndo();
        return;
      }

      if (editing) return;
      if (e.key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) onUnindent(item.id);
        else onIndent(item.id);
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) {
          // Shift+Enter in row mode triggers insert before
          onInsertBefore(item.id, "text", true);
        } else {
          // Enter in row mode triggers insert after
          onInsertBelow(item.id, blockType, true);
        }
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        onDelete(item.id);
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        onNavigate(item.id, "up", false);
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        onNavigate(item.id, "down", false);
      }
    },
    [
      editing,
      item.id,
      blockType,
      onIndent,
      onUnindent,
      onInsertBelow,
      onInsertBefore,
      onDelete,
      onNavigate,
      onCopySelection,
      onCutSelection,
      onPasteBelowSelection,
      onUndo,
    ]
  );

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Standard interactions
      if (e.key === "Enter") {
        e.preventDefault();

        const isListType = blockType === "bullet" || blockType === "number" || blockType === "todo";
        const isEmpty = editValue.trim() === "";

        // Priority 1: Handle empty items (Break list / Unindent)
        if (isEmpty) {
          // If indented, unindent first (move out of nested list)
          if (depth > 0) {
            onUnindent(item.id);
            return;
          }
          // If at root and is a list type, convert to text (break out of list mode)
          if (isListType) {
            onUpdateType(item.id, "text");
            return;
          }
        }

        // Priority 2: Insert before if at start (and not empty handled above)
        // (If it was empty and NOT a list type, e.g. text, it will fall through to insert below or we could insert before also?)
        // Standard text editors: Enter on empty text line -> Insert new line below.
        // Enter at start of text line -> Insert new line before.
        if (e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 0) {
          saveEdit();
          onInsertBefore(item.id, "text", true);
          return;
        }

        // Priority 3: Standard insert below
        saveEdit();
        onInsertBelow(item.id, blockType, true);
      }
      if (e.key === "Escape") {
        setEditValue(item.text);
        setEditing(false);
        // Focus back on row
        requestAnimationFrame(() => rowRef.current?.focus());
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        onNavigate(item.id, "up", true);
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        onNavigate(item.id, "down", true);
      }
      if (e.key === "Backspace") {
        // If cursor is at start
        if (e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 0) {
          e.preventDefault();

          // Notion-like Backspace:
          // 1. If it's a list item (bullet, number, todo) and at start -> Convert to text
          // This allows "deleting the checkbox" to make it a text line
          const isListType = blockType === "bullet" || blockType === "number" || blockType === "todo";
          if (isListType) {
            onUpdateType(item.id, "text");
            // If we convert to text, we might lose focus if visual structure changes heavily. 
            // But usually this works.
            return;
          }

          // 2. If it is already text (or header), try to merge with previous
          onMergeWithPrevious(item.id);
        }
      }
    },
    [item.id, blockType, depth, editValue, saveEdit, onUpdateType, onInsertBelow, onInsertBefore, onNavigate, onMergeWithPrevious, onUnindent]
  );

  const focusRow = useCallback(() => {
    rowRef.current?.focus();
    onInputFocus(item.id);
  }, [item.id, onInputFocus]);

  return (
    <div ref={setNodeRef} style={style}>
      <div
        ref={rowRef}
        tabIndex={0}
        role="group"
        aria-label="Plan item"
        className={cn(
          "group relative flex items-start gap-2 rounded-md py-0.5 pr-10 outline-none",
          depth !== 0 && !isHeader && "ml-4",
          isHeader && "first:mt-0 ml-0",
          "my-0.5", // Minimal vertical margin
          selected && "bg-accent/40"
        )}
        onKeyDown={handleKeyDown}
        onClick={(e) => {
          onRowClick(item.id, e);

          // Triple-click: let browser select line, then enter edit mode with that selection.
          if (editTimeoutRef.current && !editing) {
            clearTimeout(editTimeoutRef.current);
            editTimeoutRef.current = null;
            requestAnimationFrame(() => {
              const sel = window.getSelection();
              if (
                contentRef.current &&
                sel &&
                sel.toString().length > 0
              ) {
                // Check if the selection covers the whole text content (approximate triple click)
                const textContent = contentRef.current.textContent || "";
                const isFullSelection = sel.toString().trim() === textContent.trim();

                if (isFullSelection) {
                  pendingSelectionRef.current = { start: 0, end: item.text.length };
                } else if (
                  contentRef.current.contains(sel.anchorNode) &&
                  contentRef.current.contains(sel.focusNode)
                ) {
                  const range = sel.getRangeAt(0);
                  const preRange = document.createRange();
                  preRange.setStart(contentRef.current, 0);
                  preRange.setEnd(range.startContainer, range.startOffset);
                  const start = preRange.toString().length;
                  const end = start + sel.toString().length;
                  pendingSelectionRef.current = { start, end };
                }
              }
              setEditing(true);
            });
            return;
          }

          if (!editing) focusRow();
        }}
        onFocus={(e) => {
          if (e.target === rowRef.current) {
            onInputFocus(item.id);
          }
        }}
        onDoubleClick={() => {
          if (!editing) {
            // Delay edit so triple-click can select text; cancel if third click arrives.
            // Tripple click detection logic:
            // If the browser selection covers the whole text, it's likely a triple click.
            editTimeoutRef.current = setTimeout(() => {
              editTimeoutRef.current = null;
              // Capture selection from span before we replace it with Input
              const sel = window.getSelection();
              if (
                contentRef.current &&
                sel &&
                sel.toString().length > 0
              ) {
                // Check if the selection covers the whole text content (approximate triple click)
                const textContent = contentRef.current.textContent || "";
                const isFullSelection = sel.toString().trim() === textContent.trim();

                if (isFullSelection) {
                  pendingSelectionRef.current = { start: 0, end: item.text.length };
                } else if (
                  contentRef.current.contains(sel.anchorNode) &&
                  contentRef.current.contains(sel.focusNode)
                ) {
                  const range = sel.getRangeAt(0);
                  const preRange = document.createRange();
                  preRange.setStart(contentRef.current, 0);
                  preRange.setEnd(range.startContainer, range.startOffset);
                  const start = preRange.toString().length;
                  const end = start + sel.toString().length;
                  pendingSelectionRef.current = { start, end };
                }
              }
              setEditing(true);
            }, 250); // Increased timeout to catch triple clicks better
          }
        }}
      >
        <div className={cn(
          "flex shrink-0 items-center gap-0.1 opacity-0 group-hover:opacity-100 group-focus:opacity-100 group-focus-within:opacity-100 text-muted-foreground relative -left-0 top-0 z-10"
        )}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded hover:bg-muted"
                title="Add block"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="material-icons text-lg">add</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel className="text-muted-foreground">Basic blocks</DropdownMenuLabel>
              {BLOCK_OPTIONS.map(({ type, label, icon }) => (
                <DropdownMenuItem
                  key={type}
                  onClick={() => onInsertBelow(item.id, type)}
                  className="flex items-center gap-2"
                >
                  <span className="w-6 text-center font-semibold text-muted-foreground">{icon}</span>
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 rounded hover:bg-muted cursor-grab active:cursor-grabbing"
            title="Drag handle"
            // Start of drag handle configuration
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => {
              // Prevent drag when clicking menu... handled by preventDefault in menu?
              // DND-Kit handles this via sensors if configured correctly.
              // But we need to make sure we don't block other clicks.
              listeners?.onPointerDown?.(e);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') return; // Don't trigger drag on Enter if it conflicts
              listeners?.onKeyDown?.(e);
            }}
          >
            <span className="material-icons text-base">drag_indicator</span>
          </Button>
        </div>
        {showCheckbox ? (
          <Checkbox
            id={item.id}
            checked={item.checked}
            onCheckedChange={() => onToggle(item.id)}
            className="mt-1 shrink-0"
          />
        ) : blockType === "bullet" && item.text.trim() ? (
          <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-foreground/70" aria-hidden />
        ) : blockType === "number" && item.text.trim() ? (
          <span className="mt-2 shrink-0 text-sm text-muted-foreground" aria-hidden />
        ) : !isHeader ? (
          <span className="w-0 shrink-0" aria-hidden />
        ) : null}
        <div
          ref={contentRef}
          className={cn("min-w-0 flex-1 overflow-x-auto select-text", isHeader && "flex items-center -ml-1", "cursor-text")}
        >
          {editing ? (
            <>
              <Input
                ref={inputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onSelect={(e) => {
                  const { selectionStart, selectionEnd } = e.currentTarget;
                  if (selectionStart != null && selectionEnd != null && selectionStart !== selectionEnd) {
                    setToolbarSelection({ start: selectionStart, end: selectionEnd });
                  } else {
                    setToolbarSelection(null);
                  }
                }}
                onBlur={() => {
                  if (linkModalOpenRef.current) return;
                  if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                  saveTimeoutRef.current = setTimeout(() => {
                    saveTimeoutRef.current = null;
                    saveEdit();
                  }, 150);
                }}
                onKeyDown={handleInputKeyDown}
                onPaste={(e) => {
                  const pastedText = e.clipboardData.getData("text");
                  // Check if pasted text is a URL
                  if (/^https?:\/\/[^\s]+$/.test(pastedText)) {
                    // Check if we have a selection
                    const start = e.currentTarget.selectionStart;
                    const end = e.currentTarget.selectionEnd;
                    if (start !== null && end !== null && start !== end) {
                      e.preventDefault();
                      const selectedText = editValue.slice(start, end);
                      const newText = editValue.slice(0, start) + `[${selectedText}](${pastedText})` + editValue.slice(end);
                      setEditValue(newText);
                      onUpdateText(item.id, newText);

                      // Restore cursor after the link
                      const newCursorPos = start + selectedText.length + pastedText.length + 4; // [ + ] + ( + )
                      requestAnimationFrame(() => {
                        if (inputRef.current) {
                          inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
                        }
                      });
                    }
                  }
                }}
                className={cn(
                  "h-auto py-0 px-0 border-none shadow-none focus-visible:ring-0 text-sm bg-transparent",
                  blockType === "heading1" && "text-xl font-semibold",
                  blockType === "heading2" && "text-lg font-semibold",
                  blockType === "heading3" && "text-base font-semibold"
                )}
                autoFocus
              />
              <InlineToolbar
                anchorRef={inputRef}
                visible={!!toolbarSelection && !linkModalOpen}
                selectedText={toolbarSelection ? editValue.slice(toolbarSelection.start, toolbarSelection.end) : ""}
                onToolbarInteraction={() => {
                  if (saveTimeoutRef.current) {
                    clearTimeout(saveTimeoutRef.current);
                    saveTimeoutRef.current = null;
                  }
                }}
                onFormat={(action) => {
                  if (action === "link") {
                    linkModalOpenRef.current = true;
                    setLinkModalOpen(true);
                  } else {
                    applyFormat(action);
                  }
                }}
                onLinkClick={() => {
                  linkModalOpenRef.current = true;
                  setLinkModalOpen(true);
                }}
              />
              <LinkModal
                open={linkModalOpen}
                onOpenChange={(open) => {
                  setLinkModalOpen(open);
                  if (!open) setToolbarSelection(null);
                }}
                selectedText={toolbarSelection ? editValue.slice(toolbarSelection.start, toolbarSelection.end) : ""}
                onConfirm={(url) => {
                  applyFormat("link", url);
                  setLinkModalOpen(false);
                }}
              />
            </>
          ) : isHeader ? (
            <span
              role="heading"
              aria-level={level}
              className={cn(
                "cursor-text text-foreground block min-h-[1.5rem] flex items-center select-text",
                blockType === "heading1" && "text-xl font-semibold",
                blockType === "heading2" && "text-lg font-semibold",
                blockType === "heading3" && "text-base font-semibold"
              )}
            >
              <TextWithLinks text={item.text} />
            </span>
          ) : (
            <span
              className={cn(
                "cursor-text text-sm block min-h-[1.5rem] flex items-center select-text",
                item.checked && "text-muted-foreground line-through"
              )}
            >
              <TextWithLinks text={item.text} />
            </span>
          )}
        </div>
      </div>
      {hasChildren && (
        <div className="border-l border-border/60 pl-2 ml-2 mt-0">
          <SortableContext
            items={item.children.map(c => c.id)}
            strategy={verticalListSortingStrategy}
          >
            {item.children.map((child) => (
              <PlanItem
                key={child.id}
                item={child}
                depth={depth + 1}
                focusRequest={focusRequest}
                selectedIdSet={selectedIdSet}
                onToggle={onToggle}
                onUpdateText={onUpdateText}
                onUpdateType={onUpdateType}
                onDelete={onDelete}
                onIndent={onIndent}
                onUnindent={onUnindent}
                onInsertBelow={onInsertBelow}
                onInsertBefore={onInsertBefore}
                onNavigate={onNavigate}
                onMergeWithPrevious={onMergeWithPrevious}
                onInputFocus={onInputFocus}
                selected={selectedIdSet.has(child.id)}
                onRowClick={onRowClick}
                onCopySelection={onCopySelection}
                onCutSelection={onCutSelection}
                onPasteBelowSelection={onPasteBelowSelection}
                onUndo={onUndo}
              />
            ))}
          </SortableContext>
        </div>
      )}
    </div>
  );
}

// Helper to flatten the tree for navigation
function flattenItems(items: PracticePlanItem[], parentId: string | null = null): FlatItem[] {
  let result: FlatItem[] = [];
  for (const item of items) {
    result.push({ id: item.id, item, parentId });
    if (item.children.length > 0) {
      result = result.concat(flattenItems(item.children, item.id));
    }
  }
  return result;
}



// Helper to count todos
function countTodos(items: PracticePlanItem[]): { total: number; checked: number } {
  let total = 0;
  let checked = 0;
  for (const item of items) {
    if (item.blockType === "todo") {
      total++;
      if (item.checked) checked++;
    }
    if (item.children.length > 0) {
      const childrenCount = countTodos(item.children);
      total += childrenCount.total;
      checked += childrenCount.checked;
    }
  }
  return { total, checked };
}

export function PracticePlanPane({ open, onOpenChange }: PracticePlanPaneProps) {
  const [items, setItems] = useState<PracticePlanItem[]>([]);
  const { toast } = useToast();
  // Dismissed slots concept removed for cleaner UI
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);

  // Maintain a flat list of IDs for navigation
  const flatList = useMemo(() => flattenItems(items), [items]);

  // Calculate progress
  const { totalTodos, checkedTodos } = useMemo(() => {
    const { total, checked } = countTodos(items);
    return { totalTodos: total, checkedTodos: checked };
  }, [items]);

  const progressPercentage = totalTodos === 0 ? 0 : Math.round((checkedTodos / totalTodos) * 100);

  // Multi-selection and clipboard state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<PracticePlanItem[] | null>(null);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // One-level undo: snapshot before each mutation, restore on Cmd/Ctrl+Z
  const [undoSnapshot, setUndoSnapshot] = useState<PracticePlanItem[] | null>(null);
  const itemsRef = useRef<PracticePlanItem[]>(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const applyChange = useCallback((updater: (prev: PracticePlanItem[]) => PracticePlanItem[]) => {
    setUndoSnapshot(JSON.parse(JSON.stringify(itemsRef.current)));
    setItems(updater);
  }, []);

  const handleUndo = useCallback(() => {
    if (!undoSnapshot) return;
    setItems(undoSnapshot);
    savePracticePlan(undoSnapshot);
    setUndoSnapshot(null);
  }, [undoSnapshot]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts to prevent accidental drags on click
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (open) {
      setItems(getPracticePlan());
    }
  }, [open]);

  const handleRowClick = useCallback(
    (id: string, e: React.MouseEvent<HTMLDivElement>) => {
      // Selection logic with support for multi-select (meta/ctrl) and range (shift).
      if (e.metaKey || e.ctrlKey) {
        setSelectedIds((prev) => {
          if (prev.includes(id)) {
            return prev.filter((x) => x !== id);
          }
          return [...prev, id];
        });
        setLastSelectedId(id);
      } else if (e.shiftKey && lastSelectedId) {
        const idsInOrder = flatList.map((f) => f.id);
        const fromIndex = idsInOrder.indexOf(lastSelectedId);
        const toIndex = idsInOrder.indexOf(id);
        if (fromIndex === -1 || toIndex === -1) {
          setSelectedIds([id]);
          setLastSelectedId(id);
        } else {
          const start = Math.min(fromIndex, toIndex);
          const end = Math.max(fromIndex, toIndex);
          setSelectedIds(idsInOrder.slice(start, end + 1));
        }
      } else {
        setSelectedIds([id]);
        setLastSelectedId(id);
      }

      // Ensure the row gets focus for keyboard operations.
      setFocusRequest({ id, type: "row" });
    },
    [flatList, lastSelectedId]
  );

  const handleCopySelection = useCallback(() => {
    if (selectedIds.length === 0) return;
    const idsInOrder = flatList.map((f) => f.id);
    const ordered = [...selectedIds].sort(
      (a, b) => idsInOrder.indexOf(a) - idsInOrder.indexOf(b)
    );
    const copies: PracticePlanItem[] = [];
    for (const id of ordered) {
      const flat = flatList.find((f) => f.id === id);
      if (flat) {
        // Deep clone to detach from current tree
        copies.push(JSON.parse(JSON.stringify(flat.item)));
      }
    }
    if (copies.length > 0) {
      setClipboard(copies);
    }
  }, [selectedIds, flatList]);

  const handleCutSelection = useCallback(() => {
    if (selectedIds.length === 0) return;
    handleCopySelection();
    const idsInOrder = flatList.map((f) => f.id);
    const orderedDesc = [...selectedIds].sort(
      (a, b) => idsInOrder.indexOf(b) - idsInOrder.indexOf(a)
    );
    applyChange((prev) => {
      let result = prev;
      for (const id of orderedDesc) {
        result = practicePlanApi.delete(result, id);
      }
      return result;
    });
    setSelectedIds([]);
    setLastSelectedId(null);
  }, [selectedIds, flatList, handleCopySelection, applyChange]);

  const handlePasteBelowSelection = useCallback(
    (targetId: string) => {
      if (!clipboard || clipboard.length === 0) return;
      const newIds: string[] = [];
      applyChange((prev) => {
        let result = prev;
        let insertAfterId = targetId;
        for (const snippet of clipboard) {
          const cloned = cloneWithNewIds(snippet);
          result = practicePlanApi.insertExistingAfter(result, insertAfterId, cloned);
          insertAfterId = cloned.id;
          newIds.push(cloned.id);
        }
        return result;
      });
      if (newIds.length > 0) {
        setSelectedIds(newIds);
        setLastSelectedId(newIds[newIds.length - 1] ?? null);
        setFocusRequest({
          id: newIds[newIds.length - 1],
          type: "row",
        });
      }
    },
    [clipboard, applyChange]
  );

  const handleToggle = useCallback((id: string) => {
    applyChange((prev) => practicePlanApi.toggleCheck(prev, id));
  }, [applyChange]);

  const handleUpdateText = useCallback((id: string, text: string) => {
    applyChange((prev) => practicePlanApi.updateText(prev, id, text));
  }, [applyChange]);

  const handleUpdateType = useCallback((id: string, type: BlockType) => {
    applyChange((prev) => practicePlanApi.updateBlockType(prev, id, type));
    // Request focus back to ensure editing continues smoothly
    setFocusRequest({ id, type: "edit", cursorPosition: "start" }); // Or keep current? Start is safe for "just deleted bullet".
  }, [applyChange]);

  const handleDelete = useCallback((id: string) => {
    const index = flatList.findIndex((x) => x.id === id);
    let nextFocusId: string | null = null;
    if (index > 0) {
      nextFocusId = flatList[index - 1].id;
    } else if (index >= 0 && index < flatList.length - 1) {
      nextFocusId = flatList[index + 1].id;
    }

    applyChange((prev) => practicePlanApi.delete(prev, id));
    if (nextFocusId) {
      setFocusRequest({ id: nextFocusId, type: "row" });
    }
  }, [flatList, applyChange]);

  const handleInsertBlock = useCallback(
    (index: number, blockType: BlockType, initialText?: string) => {
      const newId = generateId();
      applyChange((prev) =>
        practicePlanApi.insertRootAt(prev, index, blockType, initialText, newId)
      );
      setFocusRequest({ id: newId, type: "edit", cursorPosition: "end" });
    },
    [applyChange]
  );

  const handleInsertBelow = useCallback(
    (afterId: string, blockType: BlockType, empty?: boolean) => {
      const newId = generateId();
      applyChange((prev) =>
        practicePlanApi.insertBlockAfter(
          prev,
          afterId,
          blockType,
          empty ? "" : undefined,
          newId
        )
      );
      setFocusRequest({ id: newId, type: "edit", cursorPosition: "end" });
    },
    [applyChange]
  );

  const handleInsertBefore = useCallback(
    (beforeId: string, blockType: BlockType, empty?: boolean) => {
      const newId = generateId();
      applyChange((prev) =>
        practicePlanApi.insertBlockBefore(
          prev,
          beforeId,
          blockType,
          empty ? "" : undefined,
          newId
        )
      );
      setFocusRequest({ id: newId, type: "edit", cursorPosition: "end" });
    },
    [applyChange]
  );

  const handleAddLineAtSlot = useCallback((index: number) => {
    const newId = generateId();
    applyChange((prev) =>
      practicePlanApi.insertRootAt(prev, index, "text", "", newId)
    );
    setFocusRequest({ id: newId, type: "edit", cursorPosition: "end" });
  }, [applyChange]);

  const handleIndent = useCallback((id: string) => {
    applyChange((prev) => practicePlanApi.indent(prev, id));
  }, [applyChange]);

  const handleUnindent = useCallback((id: string) => {
    applyChange((prev) => practicePlanApi.unindent(prev, id));
  }, [applyChange]);

  const handleReset = useCallback(() => {
    applyChange((prev) => practicePlanApi.resetChecks(prev));
  }, [applyChange]);

  const handleShareProgress = useCallback(() => {
    const snapshot = createReportSnapshot(items);
    const url = getReportShareUrl(snapshot);
    navigator.clipboard
      .writeText(url)
      .then(() => {
        toast({
          title: "Link copied",
          description: "Share this link so others can view your practice plan progress. The page is not indexed by search engines.",
        });
      })
      .catch(() => {
        toast({
          variant: "destructive",
          title: "Could not copy",
          description: "Copy the link manually from the address bar after opening the report.",
        });
        window.open(url, "_blank", "noopener");
      });
  }, [items, toast]);

  // Navigation Logic
  const handleNavigate = useCallback(
    (id: string, direction: "up" | "down", fromEdit: boolean) => {
      const index = flatList.findIndex((x) => x.id === id);
      if (index === -1) return;

      let targetIndex = index;
      if (direction === "up") targetIndex = index - 1;
      if (direction === "down") targetIndex = index + 1;

      if (targetIndex >= 0 && targetIndex < flatList.length) {
        setFocusRequest({
          id: flatList[targetIndex].id,
          type: fromEdit ? "edit" : "row",
          cursorPosition: "end"
        });
      }
    },
    [flatList]
  );

  // Merge / Backspace Logic
  const handleMergeWithPrevious = useCallback((id: string) => {
    const index = flatList.findIndex((x) => x.id === id);
    if (index === -1) return;

    const current = flatList[index].item;

    // If first item and empty, allow delete
    if (index === 0) {
      if (!current.text) {
        handleDelete(id);
      }
      return;
    }

    // If > 0
    const prev = flatList[index - 1].item;

    // If current is empty, just delete and focus previous
    if (!current.text) {
      handleDelete(id);
      setFocusRequest({
        id: prev.id,
        type: "edit",
        cursorPosition: "end"
      });
      return;
    }

    // Merge: Append text to previous, delete current.
    const newText = prev.text + current.text;
    const cursorAt = prev.text.length;

    // Update previous text
    applyChange((items) => {
      let step1 = practicePlanApi.updateText(items, prev.id, newText);
      let step2 = practicePlanApi.delete(step1, id);
      return step2;
    });

    setFocusRequest({
      id: prev.id,
      type: "edit",
      cursorPosition: cursorAt
    });

  }, [flatList, handleDelete, applyChange]);

  const handleInputFocus = useCallback((id: string) => {
    // no-op or tracking
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      applyChange((prev) => practicePlanApi.reorder(prev, active.id as string, over.id as string));
    }
  }, [applyChange]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent id="practice-sheet-content" side="right" className="w-full sm:max-w-xl flex flex-col" closeIcon="back">
        <SheetHeader className="space-y-4 pb-4">
          <div className="flex items-center gap-2">
            <SheetTitle className="text-2xl font-bold text-primary">Practice plan</SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
              onClick={handleShareProgress}
              title="Copy sharable report link"
            >
              <span className="material-icons text-lg">content_copy</span>
            </Button>
          </div>

          {/* Progress Bar Row */}
          {totalTodos > 0 && (
            <div className="flex flex-col gap-1 w-full">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Progress</span>
                <span>{Math.round(progressPercentage)}% ({checkedTodos}/{totalTodos})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500 ease-in-out"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0"
                  onClick={handleReset}
                  title="Reset all checks"
                >
                  <span className="material-icons text-base">refresh</span>
                </Button>
              </div>
            </div>
          )}
        </SheetHeader>
        <div className="mt-4 flex flex-col flex-1 min-h-0">
          <ScrollArea className="flex-1 pr-4 -mr-4">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <ul className="space-y-0 pr-2">
                <SortableContext
                  items={items.map(i => i.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {items.map((item, index) => (
                    <li key={item.id}>
                      <EmptyLineSlot
                        index={index}
                        onInsert={handleInsertBlock}
                      />
                      <PlanItem
                        item={item}
                        depth={0}
                        focusRequest={focusRequest}
                        selectedIdSet={selectedIdSet}
                        onToggle={handleToggle}
                        onUpdateText={handleUpdateText}
                        onUpdateType={handleUpdateType}
                        onDelete={handleDelete}
                        onIndent={handleIndent}
                        onUnindent={handleUnindent}
                        onInsertBelow={handleInsertBelow}
                        onInsertBefore={handleInsertBefore}
                        onNavigate={handleNavigate}
                        onMergeWithPrevious={handleMergeWithPrevious}
                        onInputFocus={handleInputFocus}
                        selected={selectedIdSet.has(item.id)}
                        onRowClick={handleRowClick}
                        onCopySelection={handleCopySelection}
                        onCutSelection={handleCutSelection}
                        onPasteBelowSelection={handlePasteBelowSelection}
                        onUndo={handleUndo}
                      />
                    </li>
                  ))}
                </SortableContext>
                <li>
                  {/* Keep placeholder at bottom for easy adding */}
                  <AddLinePlaceholder
                    index={items.length}
                    onAddLine={handleAddLineAtSlot}
                  />
                </li>
              </ul>
            </DndContext>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet >
  );
}

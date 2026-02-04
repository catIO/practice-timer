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
  practicePlanApi,
} from "@/lib/practicePlan";
import { cn } from "@/lib/utils";

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

interface PlanItemProps {
  item: PracticePlanItem;
  depth: number;
  focusRequest: FocusRequest | null;
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
}

function PlanItem({
  item,
  depth,
  focusRequest,
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
}: PlanItemProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.text);
  const rowRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(item.text);
  }, [item.text]);

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
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== item.text) {
      onUpdateText(item.id, trimmed);
    } else {
      setEditValue(item.text);
    }
  }, [editValue, item.id, item.text, onUpdateText]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
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
    [editing, item.id, blockType, onIndent, onUnindent, onInsertBelow, onInsertBefore, onDelete, onNavigate]
  );

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Standard interactions
      if (e.key === "Enter") {
        e.preventDefault();

        const isListType = blockType === "bullet" || blockType === "number" || blockType === "todo";
        const isEmpty = editValue.trim() === "";

        // Priority 1: Break list on empty list item (highest priority)
        // This converts the current empty list item to text, allowing "space" creation
        if (isEmpty && isListType) {
          onUpdateType(item.id, "text");
          // DO NOT insert new line. Just transform this one.
          return;
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
          // Attempt merge or delete
          onMergeWithPrevious(item.id);
        }
      }
    },
    [item.id, blockType, editValue, saveEdit, onUpdateType, onInsertBelow, onInsertBefore, onNavigate, onMergeWithPrevious]
  );

  const focusRow = useCallback(() => {
    rowRef.current?.focus();
    onInputFocus(item.id);
  }, [item.id, onInputFocus]);

  return (
    <div>
      <div
        ref={rowRef}
        tabIndex={0}
        role="button"
        className={cn(
          "group flex items-start gap-2 rounded-md py-0.5 pr-10 outline-none focus-visible:ring-2 focus-visible:ring-ring",
          depth !== 0 && !isHeader && "ml-4",
          isHeader && "first:mt-0 ml-0",
          "my-0.5" // Minimal vertical margin
        )}
        onKeyDown={handleKeyDown}
        onClick={(e) => {
          // Click behavior: 
          // If clicking interactable elements (checkbox/buttons), don't set editing.
          // If clicking row background, just focus row. Editing requires double click.
          if (!editing && e.target === rowRef.current) focusRow();
        }}
        onFocus={(e) => {
          if (e.target === rowRef.current) {
            onInputFocus(item.id);
          }
        }}
        onDoubleClick={() => {
          if (!editing) setEditing(true);
        }}
      >
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus:opacity-100 group-focus-within:opacity-100 text-muted-foreground">
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 rounded hover:bg-muted"
                title="Line options"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="material-icons text-base">drag_indicator</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(item.id)}
              >
                <span className="material-icons mr-2 text-base">delete_outline</span>
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {showCheckbox ? (
          <Checkbox
            id={item.id}
            checked={item.checked}
            onCheckedChange={() => onToggle(item.id)}
            className="mt-0.5 shrink-0"
          />
        ) : blockType === "bullet" ? (
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/70" aria-hidden />
        ) : blockType === "number" ? (
          <span className="mt-1 shrink-0 text-sm text-muted-foreground" aria-hidden />
        ) : (
          <span className="w-0 shrink-0" aria-hidden />
        )}
        <div
          className={cn("min-w-0 flex-1", isHeader && "flex items-center", "cursor-text")}
          onClick={(e) => {
            // Single click does NOT enter edit mode anymore (user requested double click)
            // But we should stop propagation so row doesn't lose focus or anything weird?
            // Actually, standard behavior: click focuses row.
            if (!editing) {
              e.stopPropagation();
              focusRow();
            }
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
        >
          {editing ? (
            <Input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={handleInputKeyDown}
              className={cn(
                "h-8 text-sm",
                blockType === "heading1" && "text-xl font-semibold",
                blockType === "heading2" && "text-lg font-semibold",
                blockType === "heading3" && "text-base font-semibold"
              )}
              autoFocus
            />
          ) : isHeader ? (
            <span
              role="heading"
              aria-level={level}
              className={cn(
                "cursor-pointer text-foreground block min-h-[1.5rem] flex items-center",
                blockType === "heading1" && "text-xl font-semibold",
                blockType === "heading2" && "text-lg font-semibold",
                blockType === "heading3" && "text-base font-semibold"
              )}
            >
              {item.text}
            </span>
          ) : (
            <label
              // Removed htmlFor to prevent selection from checking bucket (user requested)
              className={cn(
                "cursor-pointer text-sm block min-h-[1.5rem] flex items-center",
                item.checked && "text-muted-foreground line-through"
              )}
            >
              {item.text}
            </label>
          )}
        </div>
        <div className="flex shrink-0 items-center opacity-0 group-hover:opacity-100 group-focus:opacity-100 group-focus-within:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(item.id)}
            title="Remove"
          >
            <span className="material-icons text-base">close</span>
          </Button>
        </div>
      </div>
      {hasChildren && (
        <div className="border-l border-border/60 pl-2 ml-2 mt-0">
          {item.children.map((child) => (
            <PlanItem
              key={child.id}
              item={child}
              depth={depth + 1}
              focusRequest={focusRequest}
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
            />
          ))}
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

export function PracticePlanPane({ open, onOpenChange }: PracticePlanPaneProps) {
  const [items, setItems] = useState<PracticePlanItem[]>([]);
  // Dismissed slots concept removed for cleaner UI
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);

  // Maintain a flat list of IDs for navigation
  const flatList = useMemo(() => flattenItems(items), [items]);

  useEffect(() => {
    if (open) {
      setItems(getPracticePlan());
    }
  }, [open]);

  const handleToggle = useCallback((id: string) => {
    setItems((prev) => practicePlanApi.toggleCheck(prev, id));
  }, []);

  const handleUpdateText = useCallback((id: string, text: string) => {
    setItems((prev) => practicePlanApi.updateText(prev, id, text));
  }, []);

  const handleUpdateType = useCallback((id: string, type: BlockType) => {
    setItems((prev) => practicePlanApi.updateBlockType(prev, id, type));
  }, []);

  const handleDelete = useCallback((id: string) => {
    const index = flatList.findIndex((x) => x.id === id);
    let nextFocusId: string | null = null;
    if (index > 0) {
      nextFocusId = flatList[index - 1].id;
    } else if (index >= 0 && index < flatList.length - 1) {
      nextFocusId = flatList[index + 1].id;
    }

    setItems((prev) => practicePlanApi.delete(prev, id));
    if (nextFocusId) {
      setFocusRequest({ id: nextFocusId, type: "row" });
    }
  }, [flatList]);

  const handleInsertBlock = useCallback(
    (index: number, blockType: BlockType, initialText?: string) => {
      setItems((prev) =>
        practicePlanApi.insertRootAt(prev, index, blockType, initialText)
      );
    },
    []
  );

  const handleInsertBelow = useCallback(
    (afterId: string, blockType: BlockType, empty?: boolean) => {
      setItems((prev) =>
        practicePlanApi.insertBlockAfter(
          prev,
          afterId,
          blockType,
          empty ? "" : undefined
        )
      );
    },
    []
  );

  const handleInsertBefore = useCallback(
    (beforeId: string, blockType: BlockType, empty?: boolean) => {
      setItems((prev) =>
        practicePlanApi.insertBlockBefore(
          prev,
          beforeId,
          blockType,
          empty ? "" : undefined
        )
      );
    },
    []
  );

  const handleAddLineAtSlot = useCallback((index: number) => {
    setItems((prev) =>
      practicePlanApi.insertRootAt(prev, index, "text", "")
    );
  }, []);

  const handleIndent = useCallback((id: string) => {
    setItems((prev) => practicePlanApi.indent(prev, id));
  }, []);

  const handleUnindent = useCallback((id: string) => {
    setItems((prev) => practicePlanApi.unindent(prev, id));
  }, []);

  const handleReset = useCallback(() => {
    setItems((prev) => practicePlanApi.resetChecks(prev));
  }, []);

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
    setItems((items) => {
      let step1 = practicePlanApi.updateText(items, prev.id, newText);
      let step2 = practicePlanApi.delete(step1, id);
      return step2;
    });

    setFocusRequest({
      id: prev.id,
      type: "edit",
      cursorPosition: cursorAt
    });

  }, [flatList, handleDelete]);

  const handleInputFocus = useCallback((id: string) => {
    // no-op or tracking
  }, []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>Practice plan</SheetTitle>
        </SheetHeader>
        <div className="mt-4 flex flex-col flex-1 min-h-0">
          <div className="flex flex-wrap gap-2 mb-3">
            <Button variant="outline" size="sm" onClick={handleReset}>
              Reset all
            </Button>
          </div>
          <ScrollArea className="flex-1 pr-4 -mr-4">
            <ul className="space-y-0 pr-2">
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
                  />
                </li>
              ))}
              <li>
                {/* Keep placeholder at bottom for easy adding */}
                <AddLinePlaceholder
                  index={items.length}
                  onAddLine={handleAddLineAtSlot}
                />
              </li>
            </ul>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}

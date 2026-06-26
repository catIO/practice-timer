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
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  type PracticePlanItem,
  type BlockType,
  getPracticePlan,
  savePracticePlan,
  practicePlanApi,
  generateId,
} from "@/lib/practicePlan";
import {
  createReportSnapshot,
  getReportShareUrl,
  shareReport
} from "@/lib/reportShare";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { playSound, resumeAudioContext } from "@/lib/soundEffects";
import { TextWithLinks } from "./TextWithLinks";
import { InlineToolbar, type InlineToolbarProps } from "./InlineToolbar";
import { LinkPopover } from "./LinkPopover";
import { Link } from "react-router-dom";
import { formatTime } from "@/lib/formatTime";
import { useTimerStore } from "@/stores/timerStore";
import { getPiecePracticedSeconds, getLast7DaysSummary } from "@/lib/practiceLog";
import { getSettings } from "@/lib/localStorage";
import "@/assets/headerBlur.css";
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
  timeRemaining?: number;
  totalTime?: number;
  mode?: 'work' | 'break';
  isRunning?: boolean;
  isPracticeComplete?: boolean;
  onStart?: () => void;
  onPause?: () => void;
  onSkip?: () => void;
  onStartNewSession?: () => void;
}

const BASIC_BLOCK_OPTIONS: { type: BlockType; label: string; icon: string }[] = [
  { type: "text", label: "Text", icon: "T" },
  { type: "heading1", label: "Heading 1", icon: "H1" },
  { type: "heading2", label: "Heading 2", icon: "H2" },
  { type: "heading3", label: "Heading 3", icon: "H3" },
  { type: "bullet", label: "Bulleted list", icon: "•" },
  { type: "number", label: "Numbered list", icon: "1." },
  { type: "todo", label: "To-do list", icon: "☐" },
  { type: "divider", label: "Divider", icon: "—" },
];

const PRACTICE_BLOCK_OPTIONS: { type: BlockType; label: string; icon: string }[] = [
  { type: "segment", label: "Practice Segment", icon: "⏱" },
];

const ALL_BLOCK_OPTIONS = [...BASIC_BLOCK_OPTIONS, ...PRACTICE_BLOCK_OPTIONS];

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
          <DropdownMenuContent align="start" className="w-52" onCloseAutoFocus={(e) => e.preventDefault()}>
            <DropdownMenuLabel className="text-muted-foreground">Basic blocks</DropdownMenuLabel>
            {BASIC_BLOCK_OPTIONS.map(({ type, label, icon }) => (
              <DropdownMenuItem
                key={type}
                onSelect={() => onInsert(index, type)}
                className="flex items-center gap-2"
              >
                <span className="w-6 text-center font-semibold text-muted-foreground">{icon}</span>
                {label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-muted-foreground">Practice</DropdownMenuLabel>
            {PRACTICE_BLOCK_OPTIONS.map(({ type, label, icon }) => (
              <DropdownMenuItem
                key={type}
                onSelect={() => onInsert(index, type)}
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

function parseSegmentLink(text: string): { label: string; url: string; hasLink: boolean } {
  const match = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(text.trim());
  if (match) {
    return {
      label: match[1],
      url: match[2],
      hasLink: true,
    };
  }
  return {
    label: text,
    url: "",
    hasLink: false,
  };
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
  parentIsHeader?: boolean;
  numberIndex: number; // Index among preceding number-type siblings (for 1., 2., 3. display)
  focusRequest: FocusRequest | null;
  onFocusRequestFulfilled: () => void;
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
  onMergeWithPrevious: (id: string, currentText?: string) => void;
  onInputFocus: (id: string) => void; // Notify parent that this item is focused
  selected: boolean;
  onRowClick: (id: string, e: any) => void;
  onCopySelection: () => void;
  onCutSelection: () => void;
  onPasteBelowSelection: (targetId: string) => void;
  onUndo: () => void;
  onOpenAllocationDialog: (id: string, text: string, currentMinutes?: number, currentPeriod?: 'day' | 'week') => void;
  onPlayPiece: (id: string, name: string, minutes: number, period: 'day' | 'week') => void;
  onSaveSegment: (id: string, name: string, goal: string | undefined, allocatedTime: number | undefined, allocationPeriod: 'day' | 'week' | undefined) => void;
}

function PlanItem({
  item,
  depth,
  parentIsHeader = false,
  numberIndex,
  focusRequest,
  onFocusRequestFulfilled,
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
  onOpenAllocationDialog,
  onPlayPiece,
  onSaveSegment,
}: PlanItemProps) {
  const activePieceId = useTimerStore((state) => state.activePieceId);
  const pieceTimeRemaining = useTimerStore((state) => state.pieceTimeRemaining);
  const isPiecePaused = useTimerStore((state) => state.isPiecePaused);
  const isRunning = useTimerStore((state) => state.isRunning);
  const togglePausePiece = useTimerStore((state) => state.togglePausePiece);
  const startTimer = useTimerStore((state) => state.startTimer);
  const clearPiece = useTimerStore((state) => state.clearPiece);
  const isActivePiece = item.id === activePieceId;
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

  const [editing, setEditing] = useState(() => {
    // If this item is born with a focus request, start in editing mode immediately.
    // This allows autoFocus to work on the Input without waiting for useEffect.
    return !!(focusRequest && focusRequest.id === item.id && focusRequest.type === "edit");
  });
  const [segmentLinkUrl, setSegmentLinkUrl] = useState("");
  const [hasSegmentLink, setHasSegmentLink] = useState(false);
  const [editValue, setEditValue] = useState(() => {
    if (item.blockType === "segment") {
      const parsed = parseSegmentLink(item.text);
      return parsed.label;
    }
    return item.text;
  });

  useEffect(() => {
    if (item.blockType === "segment") {
      const parsed = parseSegmentLink(item.text);
      setEditValue(parsed.label);
      setSegmentLinkUrl(parsed.url);
      setHasSegmentLink(parsed.hasLink);
    } else {
      setEditValue(item.text);
      setSegmentLinkUrl("");
      setHasSegmentLink(false);
    }
  }, [item.text, item.blockType]);

  const [toolbarSelection, setToolbarSelection] = useState<{ start: number; end: number } | null>(null);
  const [turnIntoOpen, setTurnIntoOpen] = useState(false);

  // Segment-specific editing state
  const [segmentGoalValue, setSegmentGoalValue] = useState(item.segmentGoal ?? "");
  const [segmentDurationValue, setSegmentDurationValue] = useState(
    item.allocatedTime ? String(item.allocatedTime) : ""
  );
  const [segmentPeriodValue, setSegmentPeriodValue] = useState<'day' | 'week'>(item.allocationPeriod ?? 'day');
  useEffect(() => { setSegmentGoalValue(item.segmentGoal ?? ""); }, [item.segmentGoal]);
  useEffect(() => {
    setSegmentDurationValue(item.allocatedTime ? String(item.allocatedTime) : "");
    setSegmentPeriodValue(item.allocationPeriod ?? 'day');
  }, [item.allocatedTime, item.allocationPeriod]);

  // Slash command state
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [slashHighlight, setSlashHighlight] = useState(0);
  const isSlashMenuOpenRef = useRef(false);

  // Ref for segment form (used to detect focus leaving the form)
  const segmentFormRef = useRef<HTMLDivElement>(null);

  const rowRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const editTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLinkPopoverOpenRef = useRef(false);

  // ... (lines 261-267 are omitted in replacement context, assuming they are okay to implicitly include or skip if not touching them)
  // Actually, I need to match valid context.

  useEffect(() => {
    return () => {
      if (editTimeoutRef.current) clearTimeout(editTimeoutRef.current);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // ...

  const saveSegment = useCallback(() => {
    setEditing(false);
    const plainName = editValue.trim();
    const name = (hasSegmentLink && segmentLinkUrl.trim())
      ? `[${plainName}](${segmentLinkUrl.trim()})`
      : plainName;
    const goal = segmentGoalValue.trim() || undefined;
    const mins = parseInt(segmentDurationValue, 10);
    const duration = isNaN(mins) || mins <= 0 ? undefined : mins;
    onSaveSegment(item.id, name, goal, duration, segmentPeriodValue);
  }, [editValue, hasSegmentLink, segmentLinkUrl, segmentGoalValue, segmentDurationValue, segmentPeriodValue, item.id, onSaveSegment]);

  const saveEdit = useCallback(() => {
    // If popover is open, don't exit edit mode on blur
    if (isLinkPopoverOpenRef.current) return;
    // If slash menu is open, don't exit edit mode on blur
    if (isSlashMenuOpenRef.current) return;
    // Segment blocks use saveSegment instead
    if (item.blockType === 'segment') { saveSegment(); return; }

    setEditing(false);
    setToolbarSelection(null);
    const trimmed = editValue.trim();
    if (trimmed !== item.text) {
      onUpdateText(item.id, trimmed);
    } else {
      setEditValue(item.text);
    }
  }, [editValue, item.id, item.text, item.blockType, saveSegment, onUpdateText]);

  // ... (lines 402+ applyFormat)

  // ... lines 808+ for InlineToolbar and LinkPopover

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

  // Filtered slash command options based on current filter text
  const filteredSlashOptions = useMemo(() => {
    if (!slashFilter) return ALL_BLOCK_OPTIONS;
    const f = slashFilter.toLowerCase();
    return ALL_BLOCK_OPTIONS.filter(
      (o) => o.label.toLowerCase().includes(f) || o.type.toLowerCase().includes(f)
    );
  }, [slashFilter]);

  // Auto-resize textarea for text blocks when content changes (deferred to avoid resetting cursor)
  useEffect(() => {
    if (blockType === "text" && editing && inputRef.current && "scrollHeight" in inputRef.current) {
      const ta = inputRef.current as HTMLTextAreaElement;
      const raf = requestAnimationFrame(() => {
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        ta.style.height = "auto";
        ta.style.height = ta.scrollHeight + "px";
        ta.setSelectionRange(start, end);
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [blockType, editing, editValue]);
  const hasChildren = item.children.length > 0;
  const isHeader = item.isHeader === true;
  const level = headingLevel(blockType);
  const showCheckbox = blockType === "todo";

  // Handle Focus Requests
  useEffect(() => {
    if (focusRequest && focusRequest.id === item.id) {
      if (focusRequest.type === "edit") {
        setEditing(true);
        const cursorPos = focusRequest.cursorPosition;
        const doFocus = () => {
          if (inputRef.current) {
            inputRef.current.focus();
            if (cursorPos === "end") {
              inputRef.current.setSelectionRange(inputRef.current.value.length, inputRef.current.value.length);
            } else if (cursorPos === "start") {
              inputRef.current.setSelectionRange(0, 0);
            } else if (typeof cursorPos === "number") {
              inputRef.current.setSelectionRange(cursorPos, cursorPos);
            }
            onFocusRequestFulfilled();
          }
        };
        // Defer to next tick so input is in DOM; double rAF for layout
        queueMicrotask(() => {
          requestAnimationFrame(() => {
            doFocus();
          });
        });
      } else if (focusRequest.type === "row") {
        setEditing(false);
        requestAnimationFrame(() => {
          rowRef.current?.focus();
          onFocusRequestFulfilled();
        });
      }
    }
  }, [focusRequest, item.id, onFocusRequestFulfilled]);

  const [linkPopoverAnchor, setLinkPopoverAnchor] = useState<HTMLElement | null>(null);

  const handleEditLink = useCallback(
    (linkText: string, linkUrl: string, start: number, end: number, anchor: HTMLElement | null) => {
      setEditing(true);
      // Defer selection until input is rendered
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.setSelectionRange(start, end);
        }
      });
    },
    []
  );

  const handleRemoveLink = useCallback(
    (start: number, end: number) => {
      // The range includes [text](url)
      // We want to extract "text" and replace the range with it.

      const currentText = item.text;
      const part = currentText.slice(start, end);

      // Match [text](url)
      const match = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
      let newText = "";

      if (match) {
        const linkText = match[1];
        newText = currentText.slice(0, start) + linkText + currentText.slice(end);
      } else {
        // If we can't parse it as markdown, assume it's just text or bare URL?
        // If it's a bare URL being "removed", maybe user wants to delete it?
        // But let's be safe and just return for now as we only support "unwrap" for markdown.
        return;
      }

      onUpdateText(item.id, newText);
      setEditValue(newText);
    },
    [item.text, item.id, onUpdateText]
  );

  const handleUpdateLink = useCallback(
    (start: number, end: number, newUrl: string) => {
      const currentText = item.text;
      const linkMarkdown = currentText.slice(start, end);
      const match = /^\[(.*?)\]\(.*?\)$/.exec(linkMarkdown);
      const plainMatch = /^(https?:\/\/[^\s]+)$/.exec(linkMarkdown);

      let newLinkMarkdown = linkMarkdown;
      if (match) {
        newLinkMarkdown = `[${match[1]}](${newUrl})`;
      } else if (plainMatch) {
        newLinkMarkdown = newUrl;
      }

      const newText = currentText.slice(0, start) + newLinkMarkdown + currentText.slice(end);
      setEditValue(newText);
      onUpdateText(item.id, newText);
    },
    [item.text, item.id, onUpdateText]
  );

  // Slash command: apply selected block type
  const applySlashCommand = useCallback((type: BlockType) => {
    setSlashMenuOpen(false);
    setSlashFilter('');
    setSlashHighlight(0);
    isSlashMenuOpenRef.current = false;
    setEditValue('');
    onUpdateText(item.id, '');
    onUpdateType(item.id, type);
  }, [item.id, onUpdateText, onUpdateType]);

  const applyFormat = useCallback(
    (action: "bold" | "italic" | "link", url?: string, opts?: { linkText?: string }) => {
      if (!toolbarSelection || toolbarSelection.start === toolbarSelection.end) return;
      const sel = opts?.linkText ?? editValue.slice(toolbarSelection.start, toolbarSelection.end);
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
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.setSelectionRange(newCursorStart, newCursorEnd);
      }, 10);
    },
    [editValue, item.id, onUpdateText, toolbarSelection]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (editing) return;

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

      if (e.key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) onUnindent(item.id);
        else onIndent(item.id);
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (blockType === "segment") {
          // Enter on a segment in row mode → open editing form
          setEditing(true);
          return;
        }
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
    (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const target = e.currentTarget;
      const isTextBlock = blockType === "text";

      // Slash command keyboard navigation
      if (slashMenuOpen) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSlashHighlight((h) => Math.min(h + 1, filteredSlashOptions.length - 1));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSlashHighlight((h) => Math.max(h - 1, 0));
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          if (filteredSlashOptions[slashHighlight]) {
            applySlashCommand(filteredSlashOptions[slashHighlight].type);
          }
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setSlashMenuOpen(false);
          setSlashFilter('');
          isSlashMenuOpenRef.current = false;
          return;
        }
        if (e.key === 'Backspace' && editValue === '/') {
          setSlashMenuOpen(false);
          setSlashFilter('');
          isSlashMenuOpenRef.current = false;
          // Let default backspace remove the slash
        }
      }

      // Markdown shortcut: convert block type on Space key
      if (e.key === ' ') {
        const cursorPos = target.selectionStart ?? 0;
        // Only trigger when cursor is at the very end (text IS the prefix)
        if (cursorPos === editValue.length) {
          const textBefore = editValue;
          let newMdType: BlockType | null = null;
          let stripLen = 0;

          if (textBefore === '#') { newMdType = 'heading1'; stripLen = 1; }
          else if (textBefore === '##') { newMdType = 'heading2'; stripLen = 2; }
          else if (textBefore === '###') { newMdType = 'heading3'; stripLen = 3; }
          else if (textBefore === '-' || textBefore === '*') { newMdType = 'bullet'; stripLen = 1; }
          else if (/^\d+\.$/.test(textBefore)) { newMdType = 'number'; stripLen = textBefore.length; }
          else if (textBefore === '[]') { newMdType = 'todo'; stripLen = 2; }
          else if (textBefore === '---') { newMdType = 'divider'; stripLen = 3; }

          if (newMdType) {
            e.preventDefault();
            const remaining = editValue.slice(stripLen);
            setEditValue(remaining);
            onUpdateText(item.id, remaining);
            onUpdateType(item.id, newMdType);
            return;
          }
        }
      }

      // Standard interactions
      if (e.key === "Enter") {
        const isListType = blockType === "bullet" || blockType === "number" || blockType === "todo";
        const isEmpty = editValue.trim() === "";

        // Text block: Enter = newline, Shift+Enter = new block below
        if (isTextBlock) {
          if (e.shiftKey) {
            e.preventDefault();
            saveEdit();
            onInsertBelow(item.id, "text", true);
          }
          // Enter without shift: allow default (newline)
          return;
        }

        e.preventDefault();

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
        if (target.selectionStart === 0 && target.selectionEnd === 0) {
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
        if (target.selectionStart === 0 && target.selectionEnd === 0) {
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
          onMergeWithPrevious(item.id, editValue);
        }
      }
    },
    [item.id, blockType, depth, editValue, saveEdit, onUpdateType, onInsertBelow, onInsertBefore, onNavigate, onMergeWithPrevious, onUnindent, slashMenuOpen, slashHighlight, filteredSlashOptions, applySlashCommand]
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
          "group relative flex rounded-md py-0.5 pr-10 outline-none",
          blockType === "text" ? "gap-0" : "gap-2",
          blockType === "number" ? "items-baseline" : "items-start",
          depth !== 0 && !isHeader && !parentIsHeader && "ml-4",
          isHeader && !parentIsHeader && "ml-0",
          isHeader && "first:mt-0",
          blockType === "segment" ? "my-1" : "my-0.5",
          blockType === "text" && "mb-2",
          selected && blockType !== "segment" && "bg-accent/40"
        )}
        onKeyDown={handleKeyDown}
        onClick={(e) => {
          // When clicking inside the input/textarea, let the browser handle cursor placement
          if (editing && inputRef.current && (e.target === inputRef.current || inputRef.current.contains(e.target as Node))) {
            return;
          }
          onRowClick(item.id, e);

          // Triple-click: let browser select line, then enter edit mode with that selection
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
              if (blockType !== "divider") {
                setEditing(true);
              }
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
              if (blockType !== "divider") {
                setEditing(true);
              }
            }, 250); // Increased timeout to catch triple clicks better
          }
        }}
      >
        <div className={cn(
          "flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus:opacity-100 group-focus-within:opacity-100 text-muted-foreground z-10",
          "absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full"
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
            <DropdownMenuContent align="start" className="w-52" onCloseAutoFocus={(e) => e.preventDefault()}>
              <DropdownMenuLabel className="text-muted-foreground">Basic blocks</DropdownMenuLabel>
              {BASIC_BLOCK_OPTIONS.map(({ type, label, icon }) => (
                <DropdownMenuItem
                  key={type}
                  onSelect={() => onInsertBelow(item.id, type)}
                  className="flex items-center gap-2"
                >
                  <span className="w-6 text-center font-semibold text-muted-foreground">{icon}</span>
                  {label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-muted-foreground">Practice</DropdownMenuLabel>
              {PRACTICE_BLOCK_OPTIONS.map(({ type, label, icon }) => (
                <DropdownMenuItem
                  key={type}
                  onSelect={() => onInsertBelow(item.id, type)}
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
                className="h-7 w-7 shrink-0 rounded hover:bg-muted cursor-grab active:cursor-grabbing"
                title="Drag to move · Click to open menu"
                {...attributes}
                {...listeners}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => { listeners?.onPointerDown?.(e); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') return;
                  listeners?.onKeyDown?.(e);
                }}
              >
                <span className="material-icons text-base">drag_indicator</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52" onCloseAutoFocus={(e) => e.preventDefault()}>
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                {BASIC_BLOCK_OPTIONS.find(o => o.type === blockType)?.label ||
                  PRACTICE_BLOCK_OPTIONS.find(o => o.type === blockType)?.label ||
                  blockType}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {blockType !== "divider" && blockType !== "segment" && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <span className="material-icons mr-2 text-base">transform</span>
                    Turn into
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-52">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Basic blocks</DropdownMenuLabel>
                    {BASIC_BLOCK_OPTIONS.map(({ type, label, icon }) => (
                      <DropdownMenuItem
                        key={type}
                        className={cn(type === blockType && "bg-accent text-accent-foreground")}
                        onSelect={() => { onUpdateType(item.id, type); }}
                      >
                        <span className="material-icons mr-2 text-base text-muted-foreground">{icon}</span>
                        {label}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Practice</DropdownMenuLabel>
                    {PRACTICE_BLOCK_OPTIONS.map(({ type, label, icon }) => (
                      <DropdownMenuItem
                        key={type}
                        className={cn(type === blockType && "bg-accent text-accent-foreground")}
                        onSelect={() => { onUpdateType(item.id, type); }}
                      >
                        <span className="mr-2">{icon}</span>
                        {label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => onDelete(item.id)}
              >
                <span className="material-icons mr-2 text-base">delete</span>
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {showCheckbox ? (
          <Checkbox
            id={item.id}
            checked={item.checked}
            onCheckedChange={() => onToggle(item.id)}
            className="mt-1 shrink-0"
          />
        ) : blockType === "bullet" ? (
          <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-foreground/70" aria-hidden />
        ) : blockType === "number" ? (
          <span className="w-7 shrink-0 text-right text-sm text-muted-foreground tabular-nums select-none pr-1.5" aria-hidden>
            {numberIndex + 1}.
          </span>
        ) : isHeader || blockType === "text" || blockType === "segment" ? null : (
          <span className="w-0 shrink-0" aria-hidden />
        )}
        <div
          ref={contentRef}
          className={cn("min-w-0 flex-1 break-words select-text outline-none border-0", isHeader && "flex items-center", "cursor-text")}
        >
          {blockType === "segment" ? (
            editing ? (
              /* Segment editing form */
              <div
                ref={segmentFormRef}
                className="flex-1 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2.5 space-y-2"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-2">
                  <span className="material-icons text-primary text-base shrink-0 select-none">timer</span>
                  <Input
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    ref={(el) => { (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = el; }}
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
                    onBlur={(e) => {
                      const relatedTarget = e.relatedTarget as Node | null;
                      if (relatedTarget && segmentFormRef.current?.contains(relatedTarget)) return;
                      if (isLinkPopoverOpenRef.current) return;
                      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                      saveTimeoutRef.current = setTimeout(() => { saveTimeoutRef.current = null; saveSegment(); }, 150);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); saveSegment(); }
                      if (e.key === 'Escape') {
                        const parsed = parseSegmentLink(item.text);
                        setEditValue(parsed.label);
                        setSegmentLinkUrl(parsed.url);
                        setHasSegmentLink(parsed.hasLink);
                        setSegmentGoalValue(item.segmentGoal ?? '');
                        setSegmentDurationValue(item.allocatedTime ? String(item.allocatedTime) : '');
                        setSegmentPeriodValue(item.allocationPeriod ?? 'day');
                        setEditing(false);
                        requestAnimationFrame(() => rowRef.current?.focus());
                      }
                    }}
                    onPaste={(e) => {
                      const rawText = e.clipboardData.getData("text");
                      const pastedText = rawText.trim();
                      let isUrl = false;
                      try {
                        const url = new URL(pastedText);
                        if (url.protocol === "http:" || url.protocol === "https:") {
                          isUrl = true;
                        }
                      } catch {}

                      if (isUrl) {
                        const start = e.currentTarget.selectionStart;
                        const end = e.currentTarget.selectionEnd;
                        if (start !== null && end !== null && start !== end) {
                          e.preventDefault();
                          setSegmentLinkUrl(pastedText);
                          setHasSegmentLink(true);
                          setToolbarSelection(null);
                        }
                      }
                    }}
                    placeholder="Segment name..."
                    className="flex-1 h-7 text-sm font-semibold border-none shadow-none bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    autoFocus
                  />
                  {/* Link icon — always visible; click opens LinkPopover to add/edit */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-7 w-7 shrink-0",
                      hasSegmentLink ? "text-primary hover:text-primary/80" : "text-muted-foreground hover:text-foreground"
                    )}
                    title={hasSegmentLink ? "Edit link" : "Add link"}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.stopPropagation();
                      isLinkPopoverOpenRef.current = true;
                      setLinkPopoverAnchor(e.currentTarget);
                    }}
                  >
                    <span className="material-icons text-base">link</span>
                  </Button>
                  {hasSegmentLink && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      title="Remove link"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setHasSegmentLink(false);
                        setSegmentLinkUrl("");
                      }}
                    >
                      <span className="material-icons text-sm">close</span>
                    </Button>
                  )}
                </div>
                <div className="pl-6 space-y-1.5">
                  <textarea
                    value={segmentGoalValue}
                    onChange={(e) => {
                      setSegmentGoalValue(e.target.value);
                      // Auto-resize
                      e.target.style.height = 'auto';
                      e.target.style.height = `${e.target.scrollHeight}px`;
                    }}
                    onBlur={(e) => {
                      const relatedTarget = e.relatedTarget as Node | null;
                      if (relatedTarget && segmentFormRef.current?.contains(relatedTarget)) return;
                      if (isLinkPopoverOpenRef.current) return;
                      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                      saveTimeoutRef.current = setTimeout(() => { saveTimeoutRef.current = null; saveSegment(); }, 150);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') { setEditing(false); requestAnimationFrame(() => rowRef.current?.focus()); }
                    }}
                    placeholder="Goal — what do you want to achieve?"
                    rows={1}
                    className="w-full text-xs bg-transparent border-none outline-none text-muted-foreground placeholder:text-muted-foreground/50 focus:outline-none resize-none overflow-hidden"
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <Input
                      type="number"
                      min="1"
                      value={segmentDurationValue}
                      onChange={(e) => setSegmentDurationValue(e.target.value)}
                      onBlur={(e) => {
                        const relatedTarget = e.relatedTarget as Node | null;
                        if (relatedTarget && segmentFormRef.current?.contains(relatedTarget)) return;
                        if (isLinkPopoverOpenRef.current) return;
                        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                        saveTimeoutRef.current = setTimeout(() => { saveTimeoutRef.current = null; saveSegment(); }, 150);
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveSegment(); } }}
                      placeholder="Min"
                      className="w-20 h-7 text-xs"
                    />
                    <span className="text-xs text-muted-foreground">min /</span>
                    <select
                      value={segmentPeriodValue}
                      onChange={(e) => setSegmentPeriodValue(e.target.value as 'day' | 'week')}
                      className="h-7 text-xs bg-background border border-input rounded px-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="day">day</option>
                      <option value="week">week</option>
                    </select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 ml-auto text-xs text-muted-foreground hover:text-foreground"
                      onMouseDown={(e) => { e.preventDefault(); saveSegment(); }}
                    >
                      Done
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              /* Segment card view */
              <div
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2 space-y-1.5 transition-colors",
                  selected 
                    ? item.checked
                      ? "border-muted-foreground/30 bg-muted/40"
                      : "border-primary/40 bg-primary/10"
                    : item.checked
                      ? "border-muted bg-muted/20"
                      : "border-primary/20 bg-primary/5 hover:border-primary/40"
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "material-icons text-sm shrink-0 cursor-pointer select-none",
                      item.checked ? "text-green-500" : "text-primary"
                    )}
                    onClick={(e) => { e.stopPropagation(); onToggle(item.id); }}
                    title={item.checked ? "Mark incomplete" : "Mark complete"}
                  >
                    {item.checked ? "task_alt" : "timer"}
                  </span>
                  <span className={cn(
                    "font-semibold text-sm flex-1 truncate",
                    item.checked && "text-muted-foreground"
                  )}>
                    {item.text ? (
                      <TextWithLinks
                        text={item.text}
                        onEditLink={handleEditLink}
                        onUpdateLink={(start, end, newUrl) => handleUpdateLink(start, end, newUrl)}
                        onRemoveLink={handleRemoveLink}
                      />
                    ) : (
                      <span className="text-muted-foreground/40 italic font-normal">Untitled segment</span>
                    )}
                  </span>
                  {/* Timer controls */}
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {isActivePiece ? (
                      <>
                        <span className={cn(
                          "font-mono text-xs tabular-nums px-1.5 py-0.5 rounded bg-muted/40 border border-amber-500/40",
                          pieceTimeRemaining < 60 ? "text-red-400" : "text-amber-300"
                        )}>
                          {formatTime(pieceTimeRemaining)}
                        </span>
                        <Button
                          variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            if (!isRunning) { startTimer(); if (isPiecePaused) togglePausePiece(); }
                            else { togglePausePiece(); }
                          }}
                          title={(isPiecePaused || !isRunning) ? 'Resume' : 'Pause'}
                        >
                          <span className="material-icons text-sm">{(isPiecePaused || !isRunning) ? 'play_arrow' : 'pause'}</span>
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          onClick={clearPiece} title="Stop"
                        >
                          <span className="material-icons text-sm">close</span>
                        </Button>
                      </>
                    ) : (
                      <>
                        {item.allocatedTime ? (
                          <Button
                            variant="ghost" size="sm"
                            className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground font-mono rounded bg-muted/40 border border-border/40"
                            onClick={() => onOpenAllocationDialog(item.id, item.text, item.allocatedTime, item.allocationPeriod)}
                            title="Edit duration"
                          >
                            {item.allocatedTime}m/{item.allocationPeriod === 'week' ? 'wk' : 'day'}
                          </Button>
                        ) : (
                          <Button
                            variant="ghost" size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground opacity-60 hover:opacity-100"
                            onClick={(e) => { e.stopPropagation(); setEditing(true); }}
                            title="Set duration"
                          >
                            <span className="material-icons text-xs">schedule</span>
                          </Button>
                        )}
                        {item.allocatedTime && (
                          <Button
                            variant="ghost" size="icon"
                            className="h-6 w-6 text-primary hover:text-primary/80"
                            onClick={() => onPlayPiece(item.id, item.text, item.allocatedTime!, item.allocationPeriod!)}
                            title="Start segment timer"
                          >
                            <span className="material-icons text-sm">play_arrow</span>
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {item.segmentGoal && (
                  <p className="text-xs text-muted-foreground pl-6 leading-relaxed whitespace-pre-wrap">{item.segmentGoal}</p>
                )}
                {!item.segmentGoal && !item.allocatedTime && !item.text && (
                  <p className="text-xs text-muted-foreground/40 italic pl-6">Double-click to add name, goal & time...</p>
                )}
              </div>
            )
          ) : editing ? (
            <>
              {blockType === "divider" ? (
                <div className="flex-1 flex items-center h-8" onMouseDown={(e) => e.stopPropagation()}>
                  <div className="w-full h-0.5 bg-muted-foreground/30 rounded-full" />
                </div>
              ) : blockType === "text" ? (
                <Textarea
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  ref={(el) => {
                    (inputRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
                    if (el) {
                      el.style.height = "auto";
                      el.style.height = el.scrollHeight + "px";
                    }
                  }}
                  value={editValue}
                  onChange={(e) => {
                    const ta = e.target;
                    const start = ta.selectionStart;
                    const end = ta.selectionEnd;
                    setEditValue(ta.value);
                    ta.style.height = "auto";
                    ta.style.height = ta.scrollHeight + "px";
                    ta.setSelectionRange(start, end);
                  }}
                  onSelect={(e) => {
                    const { selectionStart, selectionEnd } = e.currentTarget;
                    if (selectionStart != null && selectionEnd != null && selectionStart !== selectionEnd) {
                      setToolbarSelection({ start: selectionStart, end: selectionEnd });
                    } else {
                      setToolbarSelection(null);
                    }
                  }}
                  onBlur={() => {
                    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                    saveTimeoutRef.current = setTimeout(() => {
                      saveTimeoutRef.current = null;
                      saveEdit();
                    }, 150);
                  }}
                  onKeyDown={handleInputKeyDown}
                  onPaste={(e) => {
                    const rawText = e.clipboardData.getData("text");
                    const pastedText = rawText.trim();
                    let isUrl = false;
                    try {
                      const url = new URL(pastedText);
                      if (url.protocol === "http:" || url.protocol === "https:") isUrl = true;
                    } catch { }
                    if (isUrl) {
                      const start = e.currentTarget.selectionStart;
                      const end = e.currentTarget.selectionEnd;
                      if (start !== null && end !== null && start !== end) {
                        e.preventDefault();
                        const selectedText = editValue.slice(start, end);
                        const newText = editValue.slice(0, start) + `[${selectedText}](${pastedText})` + editValue.slice(end);
                        setEditValue(newText);
                        onUpdateText(item.id, newText);
                        requestAnimationFrame(() => {
                          if (inputRef.current) {
                            inputRef.current.setSelectionRange(start + selectedText.length + pastedText.length + 4, start + selectedText.length + pastedText.length + 4);
                          }
                        });
                      }
                    }
                  }}
                  className="block min-h-[1.5rem] leading-[1.25rem] py-0 px-0 border-none shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0 text-sm bg-transparent resize-none overflow-y-auto"
                  placeholder="Type '/' for commands"
                  rows={1}
                  autoFocus
                />
              ) : (
                <Input
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  ref={(el) => { (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = el; }}
                  value={editValue}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditValue(val);
                    // Slash command detection
                    if (val === '/') {
                      setSlashMenuOpen(true);
                      setSlashFilter('');
                      setSlashHighlight(0);
                      isSlashMenuOpenRef.current = true;
                    } else if (slashMenuOpen) {
                      if (val.startsWith('/')) {
                        setSlashFilter(val.slice(1));
                        setSlashHighlight(0);
                      } else {
                        setSlashMenuOpen(false);
                        setSlashFilter('');
                        isSlashMenuOpenRef.current = false;
                      }
                    }
                  }}
                  onSelect={(e) => {
                    const { selectionStart, selectionEnd } = e.currentTarget;
                    if (selectionStart != null && selectionEnd != null && selectionStart !== selectionEnd) {
                      setToolbarSelection({ start: selectionStart, end: selectionEnd });
                    } else {
                      setToolbarSelection(null);
                    }
                  }}
                  onBlur={() => {
                    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                    saveTimeoutRef.current = setTimeout(() => {
                      saveTimeoutRef.current = null;
                      saveEdit();
                    }, 150);
                  }}
                  onKeyDown={handleInputKeyDown}
                  onPaste={(e) => {
                    const rawText = e.clipboardData.getData("text");
                    const pastedText = rawText.trim();

                    let isUrl = false;
                    try {
                      // Try constructing a URL. We require a protocol to be considered a "link paste" event.
                      // Otherwise "Apple" would be valid (relative URL).
                      const url = new URL(pastedText);
                      if (url.protocol === "http:" || url.protocol === "https:") {
                        isUrl = true;
                      }
                    } catch (e) {
                      // Not a valid URL
                    }

                    if (isUrl) {
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
                    "block min-h-[1.5rem] leading-[1.25rem] h-auto py-0 px-0 border-none shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0 text-sm bg-transparent",
                    blockType === "heading1" && "text-xl font-semibold",
                    blockType === "heading2" && "text-lg font-semibold",
                    blockType === "heading3" && "text-base font-semibold"
                  )}
                  placeholder={
                    blockType === "heading1" ? "Heading 1" :
                      blockType === "heading2" ? "Heading 2" :
                        blockType === "heading3" ? "Heading 3" :
                          "Type '/' for commands"
                  }
                  autoFocus
                />
              )}
              {/* Slash command menu */}
              {slashMenuOpen && (
                <div className="absolute left-0 top-full z-[200] mt-1 w-56 rounded-md border bg-popover text-popover-foreground shadow-md overflow-hidden">
                  {filteredSlashOptions.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">No results</div>
                  ) : (
                    filteredSlashOptions.map((opt, i) => (
                      <div
                        key={opt.type}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 text-sm cursor-pointer",
                          i === slashHighlight ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground"
                        )}
                        onMouseDown={(e) => {
                          e.preventDefault(); // Prevent blur
                          e.stopPropagation();
                          applySlashCommand(opt.type);
                        }}
                      >
                        <span className="w-6 text-center font-semibold text-muted-foreground">{opt.icon}</span>
                        <span>{opt.label}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          ) : isHeader ? (
            <span
              role="heading"
              aria-level={level}
              className={cn(
                "cursor-text text-foreground block min-h-[1.5rem] leading-[1.25rem] flex items-center select-text outline-none border-0",
                blockType === "heading1" && "text-xl font-semibold",
                blockType === "heading2" && "text-lg font-semibold",
                blockType === "heading3" && "text-base font-semibold"
              )}
            >
              <TextWithLinks
                text={item.text}
                onEditLink={handleEditLink}
                onUpdateLink={(start, end, newUrl) => handleUpdateLink(start, end, newUrl)}
                onRemoveLink={handleRemoveLink}
              />
            </span>
          ) : blockType === "divider" ? (
            <div className="flex items-center h-6 py-1">
              <div className="w-full h-0.5 bg-muted-foreground/20 rounded-full" />
            </div>
          ) : (
            <span
              className={cn(
                "cursor-text text-sm block min-h-[1.5rem] leading-[1.25rem] select-text outline-none border-0",
                blockType === "text" && "whitespace-pre-wrap",
                !isHeader && blockType !== "text" && "flex items-center",
                item.checked && "text-muted-foreground",
                !item.text && "text-muted-foreground/40 italic"
              )}
            >
              {item.text ? (
                <TextWithLinks
                  text={item.text}
                  onEditLink={handleEditLink}
                  onUpdateLink={(start, end, newUrl) => handleUpdateLink(start, end, newUrl)}
                  onRemoveLink={handleRemoveLink}
                />
              ) : blockType === "text" ? "Type '/' for commands..." : ""}
            </span>
          )}
        </div>
      </div>

      {editing && (
        <>
          <InlineToolbar
            anchorRef={inputRef}
            visible={blockType !== "segment" && (!!toolbarSelection || turnIntoOpen) && !linkPopoverAnchor}
            selectedText={toolbarSelection ? editValue.slice(toolbarSelection.start, toolbarSelection.end) : ""}
            currentBlockType={blockType}
            onToolbarInteraction={() => {
              if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
                saveTimeoutRef.current = null;
              }
            }}
            onFormat={(action) => {
              if (action === "link") {
                isLinkPopoverOpenRef.current = true;
                setLinkPopoverAnchor(inputRef.current);
              } else {
                applyFormat(action);
              }
            }}
            onLinkClick={() => {
              isLinkPopoverOpenRef.current = true;
              setLinkPopoverAnchor(inputRef.current);
            }}
            onConvertType={blockType !== "segment" ? (type) => {
              setTurnIntoOpen(false);
              saveEdit();
              onUpdateType(item.id, type);
            } : undefined}
            turnIntoOpen={turnIntoOpen}
            onTurnIntoOpenChange={setTurnIntoOpen}
          />
          <LinkPopover
            open={!!linkPopoverAnchor}
            onOpenChange={(open) => {
              if (!open) {
                isLinkPopoverOpenRef.current = false;
                setLinkPopoverAnchor(null);
                
                const activeEl = document.activeElement;
                const isInside = blockType === "segment"
                  ? (segmentFormRef.current?.contains(activeEl) || activeEl === inputRef.current)
                  : (inputRef.current === activeEl);
                
                if (isInside) return;

                if (blockType === "segment") {
                  saveSegment();
                } else {
                  saveEdit();
                }
              }
            }}
            anchor={linkPopoverAnchor}
            selectedText={
              blockType === "segment" && linkPopoverAnchor !== inputRef.current
                ? editValue
                : (toolbarSelection ? editValue.slice(toolbarSelection.start, toolbarSelection.end) : "")
            }
            initialUrl={
              blockType === "segment"
                ? segmentLinkUrl
                : ""
            }
            onConfirm={(url) => {
              isLinkPopoverOpenRef.current = false;
              if (blockType === "segment") {
                setSegmentLinkUrl(url);
                setHasSegmentLink(true);
                setLinkPopoverAnchor(null);
                requestAnimationFrame(() => inputRef.current?.focus());
              } else {
                applyFormat("link", url);
                setLinkPopoverAnchor(null);
              }
            }}
            onCancel={() => {
              isLinkPopoverOpenRef.current = false;
              setLinkPopoverAnchor(null);
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
            onRemove={
              blockType === "segment"
                ? () => {
                    setHasSegmentLink(false);
                    setSegmentLinkUrl("");
                  }
                : undefined
            }
          />
        </>
      )}

      {hasChildren && (
        <div className={cn("mt-0", isHeader ? "" : "border-l border-border/60 pl-2 ml-2")}>
          <SortableContext
            items={item.children.map(c => c.id)}
            strategy={verticalListSortingStrategy}
          >
            {item.children.map((child, idx) => (
              <PlanItem
                key={child.id}
                item={child}
                depth={depth + 1}
                parentIsHeader={isHeader}
                numberIndex={item.children.slice(0, idx).filter((c) => c.blockType === "number").length}
                focusRequest={focusRequest}
                onFocusRequestFulfilled={onFocusRequestFulfilled}
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
                onOpenAllocationDialog={onOpenAllocationDialog}
                onPlayPiece={onPlayPiece}
                onSaveSegment={onSaveSegment}
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

export function PracticePlanPane({
  open,
  onOpenChange,
  timeRemaining,
  totalTime,
  mode,
  isRunning,
  isPracticeComplete,
  onStart,
  onPause,
  onSkip,
  onStartNewSession,
}: PracticePlanPaneProps) {


  const [items, setItems] = useState<PracticePlanItem[]>([]);
  const { toast } = useToast();
  // Dismissed slots concept removed for cleaner UI
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const onFocusRequestFulfilled = useCallback(() => setFocusRequest(null), []);

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

  // Share dialog state
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const [permalinkId, setPermalinkId] = useState<string | null>(() => practicePlanApi.getPermalinkId());
  const [isPublishing, setIsPublishing] = useState(false);

  // One-level undo: snapshot before each mutation, restore on Cmd/Ctrl+Z
  const [undoSnapshot, setUndoSnapshot] = useState<PracticePlanItem[] | null>(null);
  const itemsRef = useRef<PracticePlanItem[]>(items);
  const contentRef = useRef<HTMLDivElement>(null);
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

  const selectPiece = useTimerStore((state) => state.selectPiece);
  const activePieceName = useTimerStore((state) => state.activePieceName);
  const pieceTimeRemaining = useTimerStore((state) => state.pieceTimeRemaining);
  const pieceTotalTime = useTimerStore((state) => state.pieceTotalTime);
  const isPiecePaused = useTimerStore((state) => state.isPiecePaused);
  const togglePausePiece = useTimerStore((state) => state.togglePausePiece);
  const clearPiece = useTimerStore((state) => state.clearPiece);
  const [allocationDialogOpen, setAllocationDialogOpen] = useState(false);
  const [allocationItemId, setAllocationItemId] = useState<string | null>(null);
  const [allocationItemText, setAllocationItemText] = useState("");
  const [allocationMinutes, setAllocationMinutes] = useState("");
  const [allocationPeriod, setAllocationPeriod] = useState<'day' | 'week'>('day');

  const handleOpenAllocationDialog = useCallback((id: string, text: string, currentMinutes?: number, currentPeriod?: 'day' | 'week') => {
    setAllocationItemId(id);
    setAllocationItemText(text);
    setAllocationMinutes(currentMinutes !== undefined ? String(currentMinutes) : "");
    setAllocationPeriod(currentPeriod || 'day');
    setAllocationDialogOpen(true);
  }, []);

  const handleSaveAllocation = useCallback(() => {
    if (!allocationItemId) return;
    const mins = parseInt(allocationMinutes, 10);
    if (isNaN(mins) || mins <= 0) {
      applyChange((prev) => practicePlanApi.updateAllocation(prev, allocationItemId, undefined, undefined));
    } else {
      applyChange((prev) => practicePlanApi.updateAllocation(prev, allocationItemId, mins, allocationPeriod));
    }
    setAllocationDialogOpen(false);
    setAllocationItemId(null);
  }, [allocationItemId, allocationMinutes, allocationPeriod, applyChange]);

  const handleRemoveAllocation = useCallback(() => {
    if (!allocationItemId) return;
    applyChange((prev) => practicePlanApi.updateAllocation(prev, allocationItemId, undefined, undefined));
    setAllocationDialogOpen(false);
    setAllocationItemId(null);
  }, [allocationItemId, applyChange]);

  const handlePlayPiece = useCallback((id: string, name: string, minutes: number, period: 'day' | 'week') => {
    // Select the piece independently
    selectPiece(id, name, minutes, period);

    // If the main session is not running, start it
    if (!isRunning && onStart) {
      onStart();
    }

    toast({
      title: "Piece timer active",
      description: `Practicing: ${name}`,
    });
  }, [selectPiece, isRunning, onStart, toast]);

  const handleSaveSegment = useCallback((
    id: string,
    name: string,
    goal: string | undefined,
    allocatedTime: number | undefined,
    allocationPeriod: 'day' | 'week' | undefined
  ) => {
    applyChange((prev) => practicePlanApi.updateSegment(prev, id, name, goal, allocatedTime, allocationPeriod));
  }, [applyChange]);

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

  useEffect(() => {
    const handlePieceComplete = async (event: Event) => {
      const { name, id } = (event as CustomEvent).detail;
      // Auto-check the piece item when its goal time is met
      if (id) {
        applyChange((prev) => practicePlanApi.checkItem(prev, id));
      }
      const store = useTimerStore.getState();
      if (store.settings.soundEnabled) {
        try {
          await resumeAudioContext();
          let volume = store.settings.volume;
          if (volume <= 1) volume = volume * 100;
          volume = Math.min(100, Math.max(0, volume));
          if (volume > 0) {
            await playSound('end', 1, volume, store.settings.soundType as any);
          }
        } catch (e) {
          console.error('Error playing piece completion sound:', e);
        }
      }
      toast({
        title: "Piece timer complete",
        description: `You have completed your allocated time for ${name}.`,
      });
    };

    window.addEventListener('piece-timer-complete', handlePieceComplete);
    return () => window.removeEventListener('piece-timer-complete', handlePieceComplete);
  }, [toast, applyChange]);

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
    setFocusRequest({ id, type: type === "divider" ? "row" : "edit", cursorPosition: "start" });
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
      setFocusRequest({ id: newId, type: blockType === "divider" ? "row" : "edit", cursorPosition: "end" });
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
      setFocusRequest({ id: newId, type: blockType === "divider" ? "row" : "edit", cursorPosition: "end" });
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
      setFocusRequest({ id: newId, type: blockType === "divider" ? "row" : "edit", cursorPosition: "end" });
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

  const [isSharing, setIsSharing] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importText, setImportText] = useState("");

  const handleExportPlan = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(items, null, 2)).then(() => {
      toast({
        title: "Exported",
        description: "Plan copied to clipboard. Paste into Import on another tab/port.",
        duration: 3000,
      });
    });
  }, [items, toast]);

  const normalizeImportedItem = useCallback((item: PracticePlanItem): PracticePlanItem => ({
    ...item,
    id: item.id || generateId(),
    text: item.text ?? "",
    checked: item.checked ?? false,
    blockType: item.blockType || (item.isHeader ? "heading1" : "todo"),
    isHeader: item.isHeader ?? (item.blockType === "heading1" || item.blockType === "heading2" || item.blockType === "heading3"),
    children: (item.children ?? []).map(normalizeImportedItem),
  }), []);

  const handleImportPlan = useCallback(() => {
    try {
      const parsed = JSON.parse(importText);
      if (!Array.isArray(parsed)) {
        toast({ title: "Invalid format", description: "Must be a JSON array.", variant: "destructive" });
        return;
      }
      const normalized = parsed.map((item: PracticePlanItem) => normalizeImportedItem(item));
      setItems(normalized);
      savePracticePlan(normalized);
      setImportDialogOpen(false);
      setImportText("");
      toast({ title: "Imported", description: "Plan loaded successfully." });
    } catch (e) {
      toast({
        title: "Invalid JSON",
        description: e instanceof Error ? e.message : "Could not parse. Check for truncated data.",
        variant: "destructive",
      });
    }
  }, [importText, normalizeImportedItem, toast]);

  const handleShareClick = useCallback(() => {
    setShareDialogOpen(true);
  }, []);

  const handlePublishUpdate = useCallback(async () => {
    setIsPublishing(true);
    try {
      const snapshot = createReportSnapshot(items, undefined, getLast7DaysSummary(items));
      // If we already have a permalinkId, update it. Otherwise create a new one.
      const url = await shareReport(snapshot, permalinkId || undefined);

      // If it was a new ID, save it
      if (!permalinkId) {
        const newId = url.split('/').pop() || "";
        setPermalinkId(newId);
        practicePlanApi.savePermalinkId(newId);
        setShareUrl(url);
      } else {
        setShareUrl(url);
      }

      toast({
        title: "Link Updated",
        description: "Your practice plan has been published to the permalink.",
      });
    } catch (e) {
      toast({
        title: "Error",
        description: "Failed to publish update. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPublishing(false);
    }
  }, [items, permalinkId, toast]);

  const handleCreateVersion = useCallback(async () => {
    setIsSharing(true);
    try {
      const snapshot = createReportSnapshot(items, undefined, getLast7DaysSummary(items));
      // Create a new unique version by not passing an ID
      const url = await shareReport(snapshot);
      setShareUrl(url);
      toast({
        title: "Version Created",
        description: "A new snapshot link has been generated.",
      });
    } catch (e) {
      toast({
        title: "Error",
        description: "Failed to create version. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSharing(false);
    }
  }, [items, toast]);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast({
        title: "Copied!",
        description: "Link copied to clipboard.",
        duration: 2000,
      });
    });
  }, [shareUrl, toast]);

  const handleOpenLink = useCallback(() => {
    window.open(shareUrl, "_blank", "noopener");
    setShareDialogOpen(false);
  }, [shareUrl]);

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
  const handleMergeWithPrevious = useCallback((id: string, currentTextOverride?: string) => {
    const index = flatList.findIndex((x) => x.id === id);
    if (index === -1) return;

    const current = flatList[index].item;
    const textToMerge = typeof currentTextOverride === 'string' ? currentTextOverride : current.text;

    // If first item and empty, allow delete
    if (index === 0) {
      if (!textToMerge) {
        handleDelete(id);
      }
      return;
    }

    // If > 0
    const prev = flatList[index - 1].item;

    // If current is empty, just delete and focus previous
    if (!textToMerge) {
      handleDelete(id);
      setFocusRequest({
        id: prev.id,
        type: "edit",
        cursorPosition: "end"
      });
      return;
    }

    // Merge: Append text to previous, delete current.
    // Fix: Add a space if both have text to avoid "Word1Word2"
    const separator = (prev.text && textToMerge && !prev.text.endsWith(" ") && !textToMerge.startsWith(" ")) ? " " : "";
    const newText = prev.text + separator + textToMerge;
    const cursorAt = prev.text.length + separator.length;

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

  if (!open) return null;

  return (
    <div className="text-foreground font-sans min-h-screen w-full">
      <div className="max-w-2xl mx-auto pt-8 pb-32 px-4 sm:px-0">
        <div className="rounded-2xl bg-gradient-to-t from-gray-800/40 to-black bg-[length:100%_200%] bg-[position:90%_100%] backdrop-blur-sm min-h-[500px]">
          <header className="sticky top-0 z-20 p-4 flex items-center justify-between border-b border-border/40 bg-background/50 backdrop-blur-md rounded-t-2xl">
            <div className="relative z-10 flex items-center justify-between w-full">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-bold text-foreground">Practice Plan</h2>
              </div>
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <Link to="/practice-log">
                          <span className="material-icons text-muted-foreground">history</span>
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Practice Log</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={handleReset} className="h-8 w-8">
                        <span className="material-icons text-muted-foreground">refresh</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Reset Checks</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <span className="material-icons text-muted-foreground">more_vert</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem onClick={handleShareClick} disabled={isSharing}>
                      {isSharing ? (
                        <span className="material-icons text-sm mr-2 animate-spin">refresh</span>
                      ) : (
                        <span className="material-icons text-sm mr-2">share</span>
                      )}
                      {isSharing ? "Generating Link..." : "Share Report"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setImportDialogOpen(true)}>
                      <span className="material-icons text-sm mr-2">content_paste</span>
                      Import Plan
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportPlan}>
                      <span className="material-icons text-sm mr-2">content_copy</span>
                      Export Plan
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onOpenChange(false)}
                  className="rounded-full hover:bg-white/10"
                >
                  <span className="material-icons text-primary hover:text-primary/80">arrow_back</span>
                </Button>
              </div>
            </div>
          </header>

          <div
            ref={contentRef}
            className="w-full p-4"
          >
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={items.map(item => item.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1 pb-20 pl-14">
                  {items.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground animate-in fade-in duration-300">
                      <p className="mb-4">Your practice plan is empty.</p>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="gap-2">
                            <span className="material-icons text-base">add</span>
                            Create First Item
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="center" className="w-56" onCloseAutoFocus={(e) => e.preventDefault()}>
                          <DropdownMenuLabel>Choose first block</DropdownMenuLabel>
                          {BASIC_BLOCK_OPTIONS.map(({ type, label, icon }) => (
                            <DropdownMenuItem
                              key={type}
                              onSelect={() => handleInsertBlock(0, type)}
                              className="flex items-center gap-2"
                            >
                              <span className="w-6 text-center font-semibold text-muted-foreground">{icon}</span>
                              {label}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel>Practice</DropdownMenuLabel>
                          {PRACTICE_BLOCK_OPTIONS.map(({ type, label, icon }) => (
                            <DropdownMenuItem
                              key={type}
                              onSelect={() => handleInsertBlock(0, type)}
                              className="flex items-center gap-2"
                            >
                              <span className="w-6 text-center font-semibold text-muted-foreground">{icon}</span>
                              {label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                  {items.map((item, idx) => (
                    <PlanItem
                      key={item.id}
                      item={item}
                      depth={0}
                      numberIndex={items.slice(0, idx).filter((i) => i.blockType === "number").length}
                      focusRequest={focusRequest}
                      onFocusRequestFulfilled={onFocusRequestFulfilled}
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
                      onOpenAllocationDialog={handleOpenAllocationDialog}
                      onPlayPiece={handlePlayPiece}
                      onSaveSegment={handleSaveSegment}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
          {/* Link Popover Portal Target */}
          <div id="practice-sheet-content" className="relative" />

          <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Share Practice Plan</DialogTitle>
                <DialogDescription>
                  Anyone with this link can view your progress.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Permalink Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-foreground">Permalink</h4>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Always latest</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="grid flex-1 gap-2">
                      <Input
                        id="permalink"
                        value={permalinkId ? window.location.origin + "/r/" + permalinkId : "Not published yet"}
                        readOnly
                        className="w-full h-9 bg-muted/50 text-xs"
                      />
                    </div>
                    {permalinkId && (
                      <>
                        <Button type="button" size="sm" variant="ghost" className="h-9 w-9 p-0" onClick={() => {
                          navigator.clipboard.writeText(window.location.origin + "/r/" + permalinkId);
                          toast({ title: "Copied!", duration: 1000 });
                        }} title="Copy permalink">
                          <span className="material-icons text-base">content_copy</span>
                        </Button>
                        <Button type="button" size="sm" variant="ghost" className="h-9 w-9 p-0" onClick={() => window.open(window.location.origin + "/r/" + permalinkId, "_blank")} title="Open link">
                          <span className="material-icons text-base">open_in_new</span>
                        </Button>
                      </>
                    )}
                  </div>
                  <Button
                    className="w-full gap-2 h-9"
                    onClick={handlePublishUpdate}
                    disabled={isPublishing}
                  >
                    <span className={cn("material-icons text-sm", isPublishing && "animate-spin")}>
                      {isPublishing ? "sync" : "cloud_upload"}
                    </span>
                    {permalinkId ? "Publish Update" : "Create Permalink"}
                  </Button>
                </div>

                <div className="relative h-px bg-border">
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-popover px-2 text-[10px] text-muted-foreground font-bold uppercase tracking-widest">or</span>
                </div>

                {/* Snapshot Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-foreground">Snapshot version</h4>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Static backup</span>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full gap-2 h-9 border-dashed"
                    onClick={handleCreateVersion}
                    disabled={isSharing}
                  >
                    <span className={cn("material-icons text-sm", isSharing && "animate-spin")}>
                      {isSharing ? "sync" : "history"}
                    </span>
                    Create Snapshot Version
                  </Button>
                  {shareUrl && !shareUrl.includes(permalinkId || "___") && (
                    <div className="flex items-center space-x-2 animate-in fade-in slide-in-from-top-2 duration-300">
                      <Input
                        value={shareUrl}
                        readOnly
                        className="flex-1 h-8 bg-muted/30 text-[11px] font-mono"
                      />
                      <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleCopyLink}>
                        <span className="material-icons text-sm">content_copy</span>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Import Plan</DialogTitle>
                <DialogDescription>
                  Paste exported plan JSON below. Use Export Plan on another tab/port to copy it.
                </DialogDescription>
              </DialogHeader>
              <textarea
                className="w-full min-h-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                placeholder='[{"id":"...","text":"Item 1","checked":false,"children":[]},...]'
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleImportPlan}>Import</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={allocationDialogOpen} onOpenChange={setAllocationDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Set Allocation</DialogTitle>
                <DialogDescription>
                  Allocate practice time for "{allocationItemText}".
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="allocation-minutes">Minutes</Label>
                  <Input
                    id="allocation-minutes"
                    type="number"
                    min="1"
                    placeholder="e.g. 20"
                    value={allocationMinutes}
                    onChange={(e) => setAllocationMinutes(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="allocation-period">Period</Label>
                  <select
                    id="allocation-period"
                    value={allocationPeriod}
                    onChange={(e) => setAllocationPeriod(e.target.value as 'day' | 'week')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="day">Daily</option>
                    <option value="week">Weekly</option>
                  </select>
                </div>
              </div>
              <DialogFooter className="flex sm:justify-between gap-2">
                <div>
                  <Button type="button" variant="destructive" onClick={handleRemoveAllocation}>
                    Remove
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setAllocationDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={handleSaveAllocation}>
                    Save
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Sticky bottom timer bar */}
      {typeof timeRemaining === 'number' && !isPracticeComplete && (
        <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center px-4 pb-4 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-2xl rounded-2xl border border-white/10 bg-background/80 backdrop-blur-md shadow-2xl overflow-hidden">
            {/* Session timer row */}
            {typeof timeRemaining === 'number' && !isPracticeComplete && (
              <>
                {/* Progress bar */}
                <div className="h-1 w-full bg-muted">
                  <div
                    className={cn(
                      "h-full transition-all duration-1000 ease-linear",
                      mode === 'break' ? "bg-green-500" : "bg-red-500"
                    )}
                    style={{ width: `${totalTime ? Math.max(0, (timeRemaining / totalTime) * 100) : 0}%` }}
                  />
                </div>
                <div className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "text-[10px] uppercase tracking-widest font-bold",
                      mode === 'break' ? "text-green-500" : "text-primary"
                    )}>
                      {mode === 'break' ? 'Break' : 'Work'}
                    </span>
                    <span className={cn(
                      "font-mono text-3xl font-semibold tabular-nums",
                      mode === 'break' ? "text-green-400" : (timeRemaining < 60 ? "text-red-400" : "text-foreground")
                    )}>
                      {formatTime(timeRemaining)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-foreground hover:text-foreground/80"
                      onClick={isRunning ? onPause : onStart}
                      title={isRunning ? 'Pause' : 'Play'}
                    >
                      <span className="material-icons">{isRunning ? 'pause' : 'play_arrow'}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground hover:text-foreground"
                      onClick={onSkip}
                      title="Skip"
                    >
                      <span className="material-icons">skip_next</span>
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

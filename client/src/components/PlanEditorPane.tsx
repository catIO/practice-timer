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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ToastAction } from "@/components/ui/toast";
import {
  type PlanItem as PracticePlanItem,
  type BlockType,
  type PlanSnapshot,
  generateId,
} from "@/lib/planTypes";
import { type PlanStoreApi } from "@/lib/planStoreHelpers";
import {
  practicePlanApi,
  getSnapshots as defaultGetSnapshots,
  saveSnapshot as defaultSaveSnapshot,
} from "@/lib/practicePlan";
import {
  createReportSnapshot,
  getReportShareUrl,
  shareReport
} from "@/lib/reportShare";
import { ScoreUrlTooltip } from "@/components/ScoreUrlTooltip";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { repertoireService } from "@/lib/repertoireService";
import { useAuth } from "@/contexts/AuthContext";
import type { RepertoirePiece } from "@/lib/repertoire.types";
import { cn } from "@/lib/utils";
import { playSound, resumeAudioContext } from "@/lib/soundEffects";
import { TextWithLinks } from "./TextWithLinks";
import { RichLink } from "./RichLink";
import { InlineToolbar, type InlineToolbarProps } from "./InlineToolbar";
import { LinkPopover } from "./LinkPopover";
import { Link } from "react-router-dom";
import { formatTime } from "@/lib/formatTime";
import { useTextSelection } from "@/hooks/useTextSelection";
import { applyTextFormat, stripMarkdownLinks } from "@/lib/richText";
import { useTimerStore } from "@/stores/timerStore";
import { getPiecePracticedSeconds, getLast7DaysSummary, getSegmentCompletionsForThisWeek, hasCompletedSegmentToday, formatDuration } from "@/lib/practiceLog";
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

export interface PlanEditorPaneProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planTitle?: string;
  planType?: "practice" | "lesson";
  planApi?: PlanStoreApi;
  getSnapshots?: () => PlanSnapshot[];
  saveSnapshot?: (items: PracticePlanItem[]) => void;
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

const BASIC_BLOCK_OPTIONS: { type: BlockType | "repertoire-piece"; label: string; icon: string }[] = [
  { type: "text", label: "Text", icon: "T" },
  { type: "heading1", label: "Heading 1", icon: "H1" },
  { type: "heading2", label: "Heading 2", icon: "H2" },
  { type: "heading3", label: "Heading 3", icon: "H3" },
  { type: "bullet", label: "Bulleted list", icon: "•" },
  { type: "number", label: "Numbered list", icon: "1." },
  { type: "todo", label: "To-do list", icon: "☐" },
  { type: "divider", label: "Divider", icon: "—" },
];

const PRACTICE_BLOCK_OPTIONS: { type: BlockType | "repertoire-piece"; label: string; icon: string }[] = [
  { type: "segment", label: "Practice Segment", icon: "timer" },
  { type: "repertoire-piece", label: "Repertoire Piece", icon: "music_note" },
];

const ALL_BLOCK_OPTIONS = [...BASIC_BLOCK_OPTIONS, ...PRACTICE_BLOCK_OPTIONS];

function formatCheckedDate(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    const isSameYear = d.getFullYear() === now.getFullYear();
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      ...(isSameYear ? {} : { year: "numeric" }),
    });
  } catch {
    return "";
  }
}

function EmptyLineSlot({
  index,
  onInsert,
  allowSegments = true,
}: {
  index: number;
  onInsert: (index: number, blockType: BlockType | "repertoire-piece") => void;
  allowSegments?: boolean;
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
            {allowSegments && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-muted-foreground">Practice</DropdownMenuLabel>
                {PRACTICE_BLOCK_OPTIONS.map(({ type, label, icon }) => (
                  <DropdownMenuItem
                    key={type}
                    onSelect={() => onInsert(index, type)}
                    className="flex items-center gap-2"
                  >
                    <span className="w-6 text-center font-semibold text-muted-foreground flex items-center justify-center">
                      <span className="material-icons text-base">{icon}</span>
                    </span>
                    {label}
                  </DropdownMenuItem>
                ))}
              </>
            )}
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
  const trimmed = text.trim();
  const match = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(trimmed);
  if (match) {
    return {
      label: match[1],
      url: match[2],
      hasLink: true,
    };
  }
  if (/^https?:\/\/[^\s]+$/.test(trimmed)) {
    return {
      label: trimmed,
      url: trimmed,
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

function cloneWithNewIds(item: PracticePlanItem): PracticePlanItem {
  return {
    ...item,
    id: generateId(),
    children: item.children ? item.children.map(cloneWithNewIds) : [],
  };
}

function isAncestorSelected(id: string, selectedSet: Set<string>, flatList: FlatItem[]): boolean {
  const flat = flatList.find((f) => f.id === id);
  if (!flat || !flat.parentId) return false;
  if (selectedSet.has(flat.parentId)) return true;
  return isAncestorSelected(flat.parentId, selectedSet, flatList);
}

function countTotalNodesInForest(items: PracticePlanItem[]): number {
  let count = 0;
  for (const item of items) {
    count += 1;
    if (item.children && item.children.length > 0) {
      count += countTotalNodesInForest(item.children);
    }
  }
  return count;
}

function formatItemAsOutlineText(item: PracticePlanItem, indentLevel = 0): string {
  const indent = "  ".repeat(indentLevel);
  let prefix = "";
  if (item.blockType === "bullet") prefix = "- ";
  else if (item.blockType === "number") prefix = "1. ";
  else if (item.blockType === "todo") prefix = item.checked ? "[x] " : "[ ] ";
  else if (item.blockType === "heading1") prefix = "# ";
  else if (item.blockType === "heading2") prefix = "## ";
  else if (item.blockType === "heading3") prefix = "### ";

  let line = `${indent}${prefix}${item.text}`;
  if (item.children && item.children.length > 0) {
    const childrenText = item.children.map((c) => formatItemAsOutlineText(c, indentLevel + 1)).join("\n");
    line += "\n" + childrenText;
  }
  return line;
}

export function parseTextToPlanItems(text: string): PracticePlanItem[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  interface RawNode {
    text: string;
    blockType: BlockType;
    depth: number;
    children: RawNode[];
  }

  const nodes: RawNode[] = [];

  for (const line of lines) {
    const leadingMatch = line.match(/^[ \t]*/);
    const leadingSpaces = leadingMatch ? leadingMatch[0] : "";
    let depth = 0;
    for (const char of leadingSpaces) {
      if (char === "\t") depth += 1;
      else depth += 0.5;
    }
    depth = Math.floor(depth);

    let trimmed = line.trim();
    let blockType: BlockType = "text";

    if (trimmed.startsWith("# ")) {
      blockType = "heading1";
      trimmed = trimmed.slice(2).trim();
    } else if (trimmed.startsWith("## ")) {
      blockType = "heading2";
      trimmed = trimmed.slice(3).trim();
    } else if (trimmed.startsWith("### ")) {
      blockType = "heading3";
      trimmed = trimmed.slice(4).trim();
    } else if (/^[-*•]\s+/.test(trimmed)) {
      blockType = "bullet";
      trimmed = trimmed.replace(/^[-*•]\s+/, "").trim();
    } else if (/^\d+\.\s+/.test(trimmed)) {
      blockType = "number";
      trimmed = trimmed.replace(/^\d+\.\s+/, "").trim();
    } else if (/^\[[ xX]\]\s+/.test(trimmed)) {
      blockType = "todo";
      trimmed = trimmed.replace(/^\[[ xX]\]\s+/, "").trim();
    } else if (depth === 0 && lines.length > 1) {
      blockType = "heading1";
    } else if (depth === 1 && lines.length > 1) {
      blockType = "heading2";
    }

    nodes.push({
      text: trimmed,
      blockType,
      depth,
      children: [],
    });
  }

  const rootNodes: RawNode[] = [];
  const stack: RawNode[] = [];

  for (const node of nodes) {
    while (stack.length > 0 && stack[stack.length - 1].depth >= node.depth) {
      stack.pop();
    }

    if (stack.length === 0) {
      rootNodes.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }

    stack.push(node);
  }

  function convertNode(n: RawNode): PracticePlanItem {
    return {
      id: generateId(),
      text: n.text,
      blockType: n.blockType,
      checked: false,
      children: n.children.map(convertNode),
    };
  }

  return rootNodes.map(convertNode);
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
  onUpdateType: (id: string, type: BlockType | "repertoire-piece") => void;
  onDelete: (id: string) => void;
  onIndent: (id: string, cursorPosition?: number | "start" | "end") => void;
  onUnindent: (id: string, cursorPosition?: number | "start" | "end") => void;
  onInsertBelow: (id: string, blockType: BlockType | "repertoire-piece", empty?: boolean) => void;
  onInsertBefore: (id: string, blockType: BlockType | "repertoire-piece", empty?: boolean) => void;
  onNavigate: (id: string, direction: "up" | "down", fromEdit: boolean) => void;
  onMergeWithPrevious: (id: string, currentText?: string) => void;
  onInputFocus: (id: string) => void; // Notify parent that this item is focused
  selected: boolean;
  onRowClick: (id: string, e: any, requestType?: "row" | "edit") => void;
  onCopySelection: (targetItem?: PracticePlanItem) => void;
  onCutSelection: (targetItem?: PracticePlanItem) => void;
  onPasteBelowSelection: (targetId?: string) => void;
  onPasteMultiLineText: (targetId: string, rawText: string) => void;
  onUndo: () => void;
  onOpenAllocationDialog: (id: string, text: string, currentMinutes?: number, currentPeriod?: 'day' | 'week') => void;
  onPlayPiece: (id: string, name: string, minutes: number, period: 'day' | 'week') => void;
  onSaveSegment: (id: string, name: string, goal: string | undefined, allocatedTime: number | undefined, allocationPeriod: 'day' | 'week' | undefined, repertoirePieceId: string | undefined, videoUrl: string | undefined) => void;
  repertoirePieces?: RepertoirePiece[];
  allowSegments?: boolean;
  onSelectAllBlocks: () => void;
  planType?: "practice" | "lesson";
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
  onPasteMultiLineText,
  onUndo,
  onOpenAllocationDialog,
  onPlayPiece,
  onSaveSegment,
  repertoirePieces,
  allowSegments = true,
  onSelectAllBlocks,
  planType,
}: PlanItemProps & { repertoirePieces?: RepertoirePiece[] }) {
  const activePieceId = useTimerStore((state) => state.activePieceId);
  const pieceTimeRemaining = useTimerStore((state) => state.pieceTimeRemaining);
  const isPiecePaused = useTimerStore((state) => state.isPiecePaused);
  const isRunning = useTimerStore((state) => state.isRunning);
  const togglePausePiece = useTimerStore((state) => state.togglePausePiece);
  const startTimer = useTimerStore((state) => state.startTimer);
  const clearPiece = useTimerStore((state) => state.clearPiece);
  const isPieceOvertime = useTimerStore((state) => state.isPieceOvertime);
  const isPracticeComplete = useTimerStore((state) => state.isPracticeComplete);
  const pieceOvertimeRunning = useTimerStore((state) => state.pieceOvertimeRunning);
  const startPieceOvertime = useTimerStore((state) => state.startPieceOvertime);
  const stopPieceOvertime = useTimerStore((state) => state.stopPieceOvertime);
  const isActivePiece = item.id === activePieceId;
  const linkedPiece = useMemo(() => {
    if (!item.repertoirePieceId || !repertoirePieces) return null;
    return repertoirePieces.find((p) => p.id === item.repertoirePieceId) || null;
  }, [item.repertoirePieceId, repertoirePieces]);
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
      // Don't overwrite in-progress edits while the form is open
      if (!editing) {
        const parsed = parseSegmentLink(item.text);
        setEditValue(parsed.label);
        setSegmentLinkUrl(parsed.url);
        setHasSegmentLink(parsed.hasLink);
      }
    } else {
      setEditValue(item.text);
      setSegmentLinkUrl("");
      setHasSegmentLink(false);
    }
  }, [item.text, item.blockType, editing]);

  const {
    selection: toolbarSelection,
    setSelection: setToolbarSelection,
    linkPopoverOpenRef: isLinkPopoverOpenRef,
  } = useTextSelection();
  const [turnIntoOpen, setTurnIntoOpen] = useState(false);
  const [dragMenuOpen, setDragMenuOpen] = useState(false);

  // Segment-specific editing state
  const [segmentGoalValue, setSegmentGoalValue] = useState(item.segmentGoal ?? "");
  const [segmentDurationValue, setSegmentDurationValue] = useState(
    item.allocatedTime ? String(item.allocatedTime) : ""
  );
  const [segmentPeriodValue, setSegmentPeriodValue] = useState<'day' | 'week'>(item.allocationPeriod ?? 'day');
  const [segmentPieceId, setSegmentPieceId] = useState(item.repertoirePieceId ?? "");
  const [segmentVideoUrlValue, setSegmentVideoUrlValue] = useState(item.videoUrl ?? "");
  // Guard: don't clobber in-progress edits while the segment form is open
  useEffect(() => { if (!editing) setSegmentGoalValue(item.segmentGoal ?? ""); }, [item.segmentGoal, editing]);
  useEffect(() => {
    if (!editing) {
      setSegmentDurationValue(item.allocatedTime ? String(item.allocatedTime) : "");
      setSegmentPeriodValue(item.allocationPeriod ?? 'day');
      setSegmentPieceId(item.repertoirePieceId ?? "");
      setSegmentVideoUrlValue(item.videoUrl ?? "");
    }
  }, [item.allocatedTime, item.allocationPeriod, item.repertoirePieceId, item.videoUrl, editing]);

  // Slash command state
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [slashHighlight, setSlashHighlight] = useState(0);
  const isSlashMenuOpenRef = useRef(false);

  // Ref for segment form (used to detect focus leaving the form)
  const segmentFormRef = useRef<HTMLDivElement>(null);
  // Ref for goal textarea — used to auto-resize to content height when the form opens
  const goalTextareaRef = useRef<HTMLTextAreaElement>(null);

  const rowRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const editTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSegmentEditRef = useRef(false); // true while a segment dblclick edit is scheduled
  // isLinkPopoverOpenRef is provided by useTextSelection hook above
  const isVideoPopoverOpenRef = useRef(false);
  const [videoPopoverAnchor, setVideoPopoverAnchor] = useState<HTMLElement | null>(null);

  useEffect(() => {
    return () => {
      if (editTimeoutRef.current) clearTimeout(editTimeoutRef.current);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // saveSegment: persists segment data only — does NOT close the form.
  // Separating data-save from form-close prevents premature collapse on blur.
  const saveSegment = useCallback(() => {
    const plainName = editValue.trim();
    const name = (hasSegmentLink && segmentLinkUrl.trim())
      ? `[${plainName}](${segmentLinkUrl.trim()})`
      : plainName;
    const goal = segmentGoalValue.trim() || undefined;
    const mins = parseInt(segmentDurationValue, 10);
    const duration = isNaN(mins) || mins <= 0 ? undefined : mins;
    const videoUrl = segmentVideoUrlValue.trim() || undefined;
    onSaveSegment(item.id, name, goal, duration, segmentPeriodValue, segmentPieceId || undefined, videoUrl);
  }, [editValue, hasSegmentLink, segmentLinkUrl, segmentGoalValue, segmentDurationValue, segmentPeriodValue, segmentPieceId, segmentVideoUrlValue, item.id, onSaveSegment]);

  // closeSegment: saves data AND closes the form. Called by Enter, Done button,
  // and the form-container blur handler (when focus truly leaves the form).
  const closeSegment = useCallback(() => {
    saveSegment();
    setEditing(false);
    requestAnimationFrame(() => rowRef.current?.focus());
  }, [saveSegment]);

  const saveEdit = useCallback(() => {
    // If popover is open, don't exit edit mode on blur
    if (isLinkPopoverOpenRef.current) return;
    // If slash menu is open, don't exit edit mode on blur
    if (isSlashMenuOpenRef.current) return;
    // Segment blocks use closeSegment instead
    if (item.blockType === 'segment') { closeSegment(); return; }

    setEditing(false);
    setToolbarSelection(null);
    const trimmed = editValue.trim();
    if (trimmed !== item.text) {
      onUpdateText(item.id, trimmed);
    } else {
      setEditValue(item.text);
    }
  }, [editValue, item.id, item.text, item.blockType, closeSegment, onUpdateText]);

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

  // Auto-size goal textarea when the segment form first opens (existing multi-line content)
  useEffect(() => {
    if (editing && goalTextareaRef.current) {
      const el = goalTextareaRef.current;
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [editing]);

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
        // Don't cancel a pending segment double-click edit
        if (!pendingSegmentEditRef.current) {
          setEditing(false);
        }
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
  const applySlashCommand = useCallback((type: BlockType | "repertoire-piece") => {
    setSlashMenuOpen(false);
    setSlashFilter('');
    setSlashHighlight(0);
    isSlashMenuOpenRef.current = false;
    setEditValue('');
    onUpdateText(item.id, '');
    const actualType = type === "repertoire-piece" ? "segment" : type;
    onUpdateType(item.id, actualType);
    if (type === "repertoire-piece") {
      setTimeout(() => {
        setEditing(true);
      }, 0);
    }
  }, [item.id, onUpdateText, onUpdateType]);

  const applyFormat = useCallback(
    (action: "bold" | "italic" | "link", url?: string, opts?: { linkText?: string }) => {
      if (!toolbarSelection) return;
      const result = applyTextFormat(editValue, toolbarSelection, action, url, opts);
      if (!result) return;
      setEditValue(result.newText);
      onUpdateText(item.id, result.newText);
      setToolbarSelection(null);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.setSelectionRange(toolbarSelection.start, result.newCursorEnd);
      }, 10);
    },
    [editValue, item.id, onUpdateText, toolbarSelection, setToolbarSelection]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (editing) return;

      // Clipboard-style operations work on the current selection (managed by parent).
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        onSelectAllBlocks();
        return;
      }
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

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
        const isFullInputSelected = target.selectionStart === 0 && target.selectionEnd === target.value.length;
        if (isFullInputSelected) {
          e.preventDefault();
          onSelectAllBlocks();
          return;
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        onUndo();
        return;
      }

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

      if (e.key === "Tab") {
        e.preventDefault();
        const cursorPos = target.selectionStart ?? "end";
        saveEdit();
        if (e.shiftKey) {
          onUnindent(item.id, cursorPos);
        } else {
          onIndent(item.id, cursorPos);
        }
        return;
      }

      // Standard interactions
      if (e.key === "Enter") {
        const isListType = blockType === "bullet" || blockType === "number" || blockType === "todo";
        const isEmpty = editValue.trim() === "";

        // Text block: Enter = new block below, Shift+Enter = newline in same block
        if (isTextBlock) {
          if (e.shiftKey) {
            // Shift+Enter: allow soft newline within the same block
            return;
          }
          e.preventDefault();
          saveEdit();
          if (target.selectionStart === 0 && target.selectionEnd === 0 && !isEmpty) {
            onInsertBefore(item.id, "text", true);
          } else {
            onInsertBelow(item.id, "text", true);
          }
          return;
        }

        e.preventDefault();

        // Priority 1: Handle empty items (Break list / Unindent)
        if (isEmpty) {
          // If indented, unindent first (move out of nested list)
          if (depth > 0) {
            onUnindent(item.id, "end");
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
    [item.id, blockType, depth, editValue, saveEdit, onUpdateType, onInsertBelow, onInsertBefore, onNavigate, onMergeWithPrevious, onIndent, onUnindent, slashMenuOpen, slashHighlight, filteredSlashOptions, applySlashCommand]
  );

  const focusRow = useCallback(() => {
    rowRef.current?.focus();
    onInputFocus(item.id);
  }, [item.id, onInputFocus]);

  return (
    <div ref={setNodeRef} style={style}>
      <div
        ref={rowRef}
        data-item-id={item.id}
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
          blockType === "segment" ? "my-1.5" : "my-0.5",
          blockType === "text" && "mb-2",
          selected && selectedIdSet.size > 1 && "bg-sky-500/10 dark:bg-sky-400/10 border-l border-sky-400/50 rounded-sm px-1 transition-colors duration-150"
        )}
        onKeyDown={handleKeyDown}
        onClick={(e) => {
          // When clicking inside the input/textarea, let the browser handle cursor placement
          if (editing && inputRef.current && (e.target === inputRef.current || inputRef.current.contains(e.target as Node))) {
            return;
          }
          const isEmpty = (!item.text || !item.text.trim()) && blockType !== "divider" && blockType !== "segment";

          if (isEmpty) {
            onRowClick(item.id, e, "edit");
            setEditing(true);
            return;
          }

          onRowClick(item.id, e, "row");

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
            if (blockType === 'segment') {
              // Explicitly move focus to this row so any other open segment's
              // onBlur fires synchronously (timer controls stopPropagation
              // can prevent onClick from calling focusRow).
              rowRef.current?.focus();
              pendingSegmentEditRef.current = true;
              setTimeout(() => {
                pendingSegmentEditRef.current = false;
                setEditing(true);
              }, 50);
              return;
            }
            // Delay edit so triple-click can select text; cancel if third click arrives.
            // Triple click detection logic:
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
          "absolute left-0 top-0 -translate-x-full"
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
              {allowSegments && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-muted-foreground">Practice</DropdownMenuLabel>
                  {PRACTICE_BLOCK_OPTIONS.map(({ type, label, icon }) => (
                    <DropdownMenuItem
                      key={type}
                      onSelect={() => onInsertBelow(item.id, type)}
                      className="flex items-center gap-2"
                    >
                      <span className="w-6 text-center font-semibold text-muted-foreground flex items-center justify-center">
                        <span className="material-icons text-base">{icon}</span>
                      </span>
                      {label}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="relative">
            <DropdownMenu open={dragMenuOpen} onOpenChange={setDragMenuOpen}>
              <DropdownMenuTrigger asChild>
                <div className="absolute inset-0 pointer-events-none w-7 h-7" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40" onCloseAutoFocus={(e) => e.preventDefault()}>
                <DropdownMenuItem
                  onSelect={() => {
                    onDelete(item.id);
                    setDragMenuOpen(false);
                  }}
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive flex items-center gap-2 cursor-pointer font-medium"
                >
                  <span className="material-icons text-base">delete</span>
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 rounded hover:bg-muted cursor-grab active:cursor-grabbing"
              title="Drag to reorder / Menu"
              {...attributes}
              {...listeners}
              onClick={(e) => {
                e.stopPropagation();
                setDragMenuOpen((o) => !o);
              }}
              onPointerDown={(e) => {
                listeners?.onPointerDown?.(e);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') return;
                listeners?.onKeyDown?.(e);
              }}
            >
              <span className="material-icons text-base">drag_indicator</span>
            </Button>
          </div>
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
                className="flex-1 rounded-xl border border-l-2 border-primary/50 bg-primary/[0.08] p-3.5 space-y-2 shadow-sm shadow-primary/10"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => {
                  // focusout bubbles: fires when any child loses focus.
                  // If focus stayed inside the form, don't save yet.
                  if (segmentFormRef.current?.contains(e.relatedTarget as Node)) return;
                  if (isLinkPopoverOpenRef.current) return;
                  if (isVideoPopoverOpenRef.current) return;
                  if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                  // 0ms: select/popover cases are guarded above; delay only causes dual-open bug
                  saveTimeoutRef.current = setTimeout(() => { saveTimeoutRef.current = null; closeSegment(); }, 0);
                }}
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
                    onBlur={undefined}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); closeSegment(); }
                      if (e.key === 'Escape') {
                        const parsed = parseSegmentLink(item.text);
                        setEditValue(parsed.label);
                        setSegmentLinkUrl(parsed.url);
                        setHasSegmentLink(parsed.hasLink);
                        setSegmentGoalValue(item.segmentGoal ?? '');
                        setSegmentDurationValue(item.allocatedTime ? String(item.allocatedTime) : '');
                        setSegmentPeriodValue(item.allocationPeriod ?? 'day');
                        setSegmentPieceId(item.repertoirePieceId ?? '');
                        setSegmentVideoUrlValue(item.videoUrl ?? '');
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
                      } catch { }

                      if (isUrl) {
                        e.preventDefault();
                        const start = e.currentTarget.selectionStart;
                        const end = e.currentTarget.selectionEnd;
                        if (start !== null && end !== null && start !== end) {
                          // Text is selected -> wrap selected text with link
                          const selectedText = editValue.slice(start, end);
                          setEditValue(selectedText);
                          setSegmentLinkUrl(pastedText);
                          setHasSegmentLink(true);
                        } else {
                          // No text selected -> if editValue has content use it as label, else use pasted url as label
                          const currentLabel = editValue.trim() || pastedText;
                          setEditValue(currentLabel);
                          setSegmentLinkUrl(pastedText);
                          setHasSegmentLink(true);
                        }
                        setToolbarSelection(null);
                      }
                    }}
                    placeholder="Segment name..."
                    className="flex-1 h-7 text-base font-semibold border-none shadow-none bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
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


                  {/* Video link icon — always visible; click opens LinkPopover to add/edit video URL */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-7 w-7 shrink-0 ml-0.5",
                      segmentVideoUrlValue ? "text-primary hover:text-primary/80" : "text-muted-foreground hover:text-foreground"
                    )}
                    title={segmentVideoUrlValue ? "Edit video link" : "Add video link"}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.stopPropagation();
                      isVideoPopoverOpenRef.current = true;
                      setVideoPopoverAnchor(e.currentTarget);
                    }}
                  >
                    <span className="material-icons text-base">videocam</span>
                  </Button>
                </div>
                <div className="pl-6 space-y-1.5">
                  <textarea
                    ref={goalTextareaRef}
                    value={segmentGoalValue}
                    onChange={(e) => {
                      setSegmentGoalValue(e.target.value);
                      // Auto-resize
                      e.target.style.height = 'auto';
                      e.target.style.height = `${e.target.scrollHeight}px`;
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
                      } catch { }

                      if (isUrl) {
                        e.preventDefault();
                        const start = e.currentTarget.selectionStart ?? segmentGoalValue.length;
                        const end = e.currentTarget.selectionEnd ?? segmentGoalValue.length;
                        if (start !== end) {
                          const selectedText = segmentGoalValue.slice(start, end);
                          const newText = segmentGoalValue.slice(0, start) + `[${selectedText}](${pastedText})` + segmentGoalValue.slice(end);
                          setSegmentGoalValue(newText);
                        } else {
                          const newText = segmentGoalValue.slice(0, start) + `[${pastedText}](${pastedText})` + segmentGoalValue.slice(end);
                          setSegmentGoalValue(newText);
                        }
                      }
                    }}
                    onBlur={undefined}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') { setEditing(false); requestAnimationFrame(() => rowRef.current?.focus()); }
                    }}
                    placeholder="Goal — what do you want to achieve?"
                    rows={1}
                    className="w-full text-sm bg-transparent border-none outline-none text-muted-foreground placeholder:text-muted-foreground/50 focus:outline-none resize-none overflow-hidden"
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <Input
                      type="number"
                      min="1"
                      value={segmentDurationValue}
                      onBlur={undefined}
                      onChange={(e) => setSegmentDurationValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); closeSegment(); } }}
                      placeholder="Min"
                      className="w-20 h-7 text-sm"
                    />
                    <span className="text-sm text-muted-foreground">min time box</span>
                    {repertoirePieces && repertoirePieces.length > 0 && (
                      <select
                        value={segmentPieceId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSegmentPieceId(val);
                          const piece = repertoirePieces.find(p => p.id === val);
                          if (piece && (!editValue.trim() || repertoirePieces.some(p => p.title === editValue.trim()))) {
                            setEditValue(piece.title);
                          }
                        }}
                        className="h-7 text-sm bg-background border border-input rounded px-1.5 max-w-[180px] truncate focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="">No linked piece</option>
                        {repertoirePieces.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title} {p.composer ? `(${p.composer})` : ""}
                          </option>
                        ))}
                      </select>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 ml-auto shrink-0"
                      title="Delete segment"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDelete(item.id);
                      }}
                    >
                      <span className="material-icons text-base">delete</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-sm text-muted-foreground hover:text-foreground"
                      onMouseDown={(e) => { e.preventDefault(); closeSegment(); }}
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
                  "group/card flex-1 rounded-xl border border-l-2 p-3.5 space-y-3 transition-all duration-200 shadow-xs cursor-default",
                  selected
                    ? "border-primary border-l-primary/80 bg-primary/10 shadow-sm shadow-primary/5"
                    : "border-border/60 border-l-primary/30 bg-white/[0.03] dark:bg-white/[0.03] hover:bg-white/[0.06] hover:border-primary/30 hover:border-l-primary/70"
                )}
              >
                {/* Header Row: Title and Timer Actions */}
                <div className="flex items-start gap-2.5">
                  {/* Title & Links */}
                  <div className="flex-1 min-w-0 pr-1">
                    <h4 className="font-semibold text-lg leading-snug text-foreground break-words flex items-center flex-wrap gap-2">
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
                      {item.allocatedTime != null && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenAllocationDialog(item.id, item.text, item.allocatedTime, item.allocationPeriod);
                          }}
                          className="inline-flex items-center h-[22px] px-2 text-xs font-mono font-medium rounded-full bg-muted/60 border border-muted-foreground/20 text-muted-foreground hover:bg-muted/80 transition-colors shrink-0 select-none cursor-pointer"
                          title="Click to edit target time box"
                        >
                          Time Box: {item.allocatedTime}m
                        </button>
                      )}
                    </h4>
                  </div>

                  {/* Timer controls */}
                  <div className="flex items-center gap-1 shrink-0 -mt-1" onClick={(e) => e.stopPropagation()}>
                    {isActivePiece ? (
                      <>
                        <span className={cn(
                          "font-mono text-xs tabular-nums px-2 py-0.5 rounded-full border shadow-sm",
                          pieceTimeRemaining < 60
                            ? "bg-red-500/10 border-red-500/30 text-red-500 dark:text-red-400"
                            : "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
                        )}>
                          {formatTime(pieceTimeRemaining)}
                        </span>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
                          onClick={() => {
                            if (isPieceOvertime || isPracticeComplete) {
                              if (pieceOvertimeRunning) {
                                stopPieceOvertime();
                              } else {
                                startPieceOvertime();
                              }
                            } else {
                              if (!isRunning) { startTimer(); if (isPiecePaused) togglePausePiece(); }
                              else { togglePausePiece(); }
                            }
                          }}
                          title={(isPieceOvertime || isPracticeComplete) ? (pieceOvertimeRunning ? 'Pause' : 'Resume') : ((isPiecePaused || !isRunning) ? 'Resume' : 'Pause')}
                        >
                          <span className="material-icons text-sm">
                            {(isPieceOvertime || isPracticeComplete)
                              ? (pieceOvertimeRunning ? 'pause' : 'play_arrow')
                              : ((isPiecePaused || !isRunning) ? 'play_arrow' : 'pause')}
                          </span>
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
                          onClick={clearPiece} title="Stop"
                        >
                          <span className="material-icons text-sm">close</span>
                        </Button>
                      </>
                    ) : (
                      (() => {
                        const settings = getSettings();
                        const weekStartsOn = settings?.weekStartsOn ?? 'monday';
                        const weeklyCompletions = getSegmentCompletionsForThisWeek(item.id, weekStartsOn);
                        const isCompletedToday = hasCompletedSegmentToday(item.id) || (item.checked ?? false);
                        const todaySeconds = getPiecePracticedSeconds(item.id, 'day', weekStartsOn);
                        const hasTimeBox = typeof item.allocatedTime === 'number' && item.allocatedTime > 0;

                        return (
                          <div className="flex items-center gap-1.5 shrink-0">
                            {weeklyCompletions > 0 && (
                              <span className={cn(
                                "inline-flex items-center h-[22px] px-2 rounded-full text-xs font-semibold font-mono tracking-tight shrink-0 select-none border transition-colors",
                                isCompletedToday
                                  ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-700 dark:text-emerald-300"
                                  : "bg-muted/60 border-muted-foreground/20 text-muted-foreground"
                              )}>
                                <span className="material-icons text-[13px] mr-1 shrink-0 select-none" aria-hidden="true">
                                  replay
                                </span>
                                {weeklyCompletions} {weeklyCompletions === 1 ? 'time' : 'times'}
                              </span>
                            )}
                            {todaySeconds > 0 && (
                              <span className="inline-flex items-center h-[22px] bg-primary/10 border border-primary/25 text-primary px-2 rounded-full text-xs font-semibold font-mono tracking-tight shrink-0 select-none">
                                {formatDuration(todaySeconds)}
                              </span>
                            )}

                            {hasTimeBox ? (
                              <Button
                                variant="ghost" size="icon"
                                className="h-7 w-7 rounded-full border border-primary/40 text-primary hover:text-primary-foreground hover:bg-primary transition-all duration-150"
                                onClick={() => onPlayPiece(item.id, item.text, item.allocatedTime || 15, 'day')}
                                title="Start segment time box"
                              >
                                <span className="material-icons text-base">play_arrow</span>
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                  "h-7 w-7 rounded-full transition-all duration-150 shrink-0 group/checkbtn",
                                  isCompletedToday
                                    ? "bg-emerald-500 text-white hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700 border border-emerald-500"
                                    : "border border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground"
                                )}
                                onClick={() => onToggle(item.id)}
                                title={isCompletedToday ? "Uncheck segment" : "Mark as completed"}
                              >
                                {isCompletedToday ? (
                                  <>
                                    <span className="material-icons text-base group-hover/checkbtn:hidden" aria-hidden="true">check</span>
                                    <span className="material-icons text-base hidden group-hover/checkbtn:inline-block" aria-hidden="true">close</span>
                                  </>
                                ) : (
                                  <span className="material-icons text-base" aria-hidden="true">check</span>
                                )}
                              </Button>
                            )}
                          </div>
                        );
                      })()
                    )}
                  </div>
                </div>

                {/* Segment Goal Supporting Text */}
                {item.segmentGoal && (
                  <div className="pt-1 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    <TextWithLinks
                      text={item.segmentGoal}
                      linkVariant="inline"
                      onEditLink={handleEditLink}
                      onUpdateLink={(start, end, newUrl) => handleUpdateLink(start, end, newUrl)}
                      onRemoveLink={handleRemoveLink}
                    />
                  </div>
                )}

                {/* Practice Links & Media Resources */}
                {(linkedPiece || item.videoUrl) && (
                  <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                    {linkedPiece && (
                      <>
                        <Link
                          to={`/repertoire/${linkedPiece.id}`}
                          title={linkedPiece.title}
                          className="inline-flex items-center gap-1.5 h-6 px-2.5 text-xs text-primary bg-primary/10 border border-primary/25 rounded-full font-medium transition-colors hover:bg-primary/20 select-none"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="material-icons text-[12px] shrink-0 select-none">music_note</span>
                          <span className="max-w-[140px] truncate">{linkedPiece.title}</span>
                        </Link>
                        {linkedPiece.score_url && (
                          <ScoreUrlTooltip url={linkedPiece.score_url}>
                            <a
                              href={linkedPiece.score_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 h-6 px-2.5 text-xs text-primary bg-primary/10 border border-primary/25 rounded-full font-medium transition-colors hover:bg-primary/20 select-none"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="material-icons text-[12px] shrink-0 select-none">description</span>
                              <span>Open Score</span>
                            </a>
                          </ScoreUrlTooltip>
                        )}
                      </>
                    )}
                    {item.videoUrl && <RichLink url={item.videoUrl} />}
                  </div>
                )}

                {!item.segmentGoal && !item.allocatedTime && !item.text && (
                  <div className="pt-1 text-xs text-muted-foreground/40 italic">
                    Double-click to add name, goal & time...
                  </div>
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
                  placeholder="Type '/' for commands..."
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
                    if (rawText.includes("\n") || rawText.includes("\r")) {
                      e.preventDefault();
                      onPasteMultiLineText(item.id, rawText);
                      return;
                    }
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
                      e.preventDefault();
                      const start = e.currentTarget.selectionStart ?? editValue.length;
                      const end = e.currentTarget.selectionEnd ?? editValue.length;
                      if (start !== end) {
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
                      } else {
                        const newText = editValue.slice(0, start) + `[${pastedText}](${pastedText})` + editValue.slice(end);
                        setEditValue(newText);
                        onUpdateText(item.id, newText);

                        const newCursorPos = start + (pastedText.length * 2) + 4;
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
                          "Type '/' for commands..."
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
                        <span className="w-6 text-center font-semibold text-muted-foreground flex items-center justify-center">
                          {opt.icon === "timer" || opt.icon === "music_note" ? (
                            <span className="material-icons text-base">{opt.icon}</span>
                          ) : (
                            opt.icon
                          )}
                        </span>
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
                !isHeader && blockType !== "text" && "flex items-center flex-wrap gap-x-2",
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
              ) : null}
              {planType === "lesson" && item.checked && item.checkedDate && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground/80 bg-muted/60 dark:bg-white/5 border border-border/50 px-1.5 py-0.5 rounded shrink-0 select-none">
                  <span className="material-icons text-[12px]">check</span>
                  {formatCheckedDate(item.checkedDate)}
                </span>
              )}
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
          <LinkPopover
            open={!!videoPopoverAnchor}
            onOpenChange={(open) => {
              if (!open) {
                isVideoPopoverOpenRef.current = false;
                setVideoPopoverAnchor(null);

                const activeEl = document.activeElement;
                const isInside = segmentFormRef.current?.contains(activeEl) || activeEl === inputRef.current;
                if (isInside) return;
                saveSegment();
              }
            }}
            anchor={videoPopoverAnchor}
            selectedText={editValue || "Practice Video"}
            initialUrl={segmentVideoUrlValue}
            onConfirm={(url) => {
              isVideoPopoverOpenRef.current = false;
              setSegmentVideoUrlValue(url);
              setVideoPopoverAnchor(null);
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
            onCancel={() => {
              isVideoPopoverOpenRef.current = false;
              setVideoPopoverAnchor(null);
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
            onRemove={() => {
              isVideoPopoverOpenRef.current = false;
              setSegmentVideoUrlValue("");
              setVideoPopoverAnchor(null);
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
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
                onPasteMultiLineText={onPasteMultiLineText}
                onUndo={onUndo}
                onOpenAllocationDialog={onOpenAllocationDialog}
                onPlayPiece={onPlayPiece}
                onSaveSegment={onSaveSegment}
                repertoirePieces={repertoirePieces}
                allowSegments={allowSegments}
                onSelectAllBlocks={onSelectAllBlocks}
                planType={planType}
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

export function PlanEditorPane({
  open,
  onOpenChange,
  planTitle = "Practice Plan",
  planType = "practice",
  planApi = practicePlanApi,
  getSnapshots = defaultGetSnapshots,
  saveSnapshot = defaultSaveSnapshot,
  timeRemaining,
  totalTime,
  mode,
  isRunning,
  isPracticeComplete,
  onStart,
  onPause,
  onSkip,
  onStartNewSession,
}: PlanEditorPaneProps) {
  const allowSegments = planType === "practice";


  const [items, setItems] = useState<PracticePlanItem[]>([]);
  const { toast } = useToast();
  const { isLoggedIn, user } = useAuth();
  const { data: repertoirePieces = [] } = useQuery({
    queryKey: ['repertoire'],
    queryFn: repertoireService.getAll,
    enabled: isLoggedIn,
  });
  // Dismissed slots concept removed for cleaner UI
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const onFocusRequestFulfilled = useCallback(() => setFocusRequest(null), []);

  useEffect(() => {
    setItems(planApi.get());
  }, [planApi]);

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

  const [deleteConfirmItem, setDeleteConfirmItem] = useState<{ id: string; name: string; isSegment?: boolean; hasChildren?: boolean } | null>(null);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // 10-level undo stack: each applyChange pushes the current state before mutating.
  const MAX_UNDO = 10;
  const [undoStack, setUndoStack] = useState<PracticePlanItem[][]>([]);
  const itemsRef = useRef<PracticePlanItem[]>(items);
  const contentRef = useRef<HTMLDivElement>(null);
  // True while the primary mouse button is held down. Gates the `selectionchange`
  // handler so we only sync cross-block browser selection into `selectedIds`
  // when the user is actually drag-selecting. Prevents phantom multi-select
  // caused by React swapping DOM nodes (e.g. entering segment edit mode)
  // pushing browser selection endpoints into a neighbouring row.
  const isPointerSelectingRef = useRef(false);
  // Throttle snapshot saves to at most once per minute
  const lastSnapshotRef = useRef<number>(0);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const isUndoingRef = useRef(false);

  const applyChange = useCallback((updater: (prev: PracticePlanItem[]) => PracticePlanItem[]) => {
    if (isUndoingRef.current) return;
    setUndoStack(prev => [...prev.slice(-(MAX_UNDO - 1)), JSON.parse(JSON.stringify(itemsRef.current))]);
    setItems(updater);
    // Throttled ring-buffer snapshot (at most once per minute)
    const now = Date.now();
    if (now - lastSnapshotRef.current > 60_000) {
      lastSnapshotRef.current = now;
      saveSnapshot(itemsRef.current);
    }
  }, []);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    isUndoingRef.current = true;
    try {
      (document.activeElement as HTMLElement)?.blur();
      window.getSelection()?.removeAllRanges();
    } catch { }
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setItems(prev);
    planApi.save(prev);
    setTimeout(() => {
      isUndoingRef.current = false;
    }, 200);
  }, [undoStack, planApi]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        if (contentRef.current && (contentRef.current === e.target || contentRef.current.contains(e.target as Node) || e.target === document.body)) {
          e.preventDefault();
          handleUndo();
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [handleUndo]);

  const selectPiece = useTimerStore((state) => state.selectPiece);
  const activePieceName = useTimerStore((state) => state.activePieceName);
  const pieceTimeRemaining = useTimerStore((state) => state.pieceTimeRemaining);
  const pieceTotalTime = useTimerStore((state) => state.pieceTotalTime);
  const isPiecePaused = useTimerStore((state) => state.isPiecePaused);
  const togglePausePiece = useTimerStore((state) => state.togglePausePiece);
  const clearPiece = useTimerStore((state) => state.clearPiece);
  const startPieceOvertime = useTimerStore((state) => state.startPieceOvertime);
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
      applyChange((prev) => planApi.updateAllocation(prev, allocationItemId, undefined, undefined));
    } else {
      applyChange((prev) => planApi.updateAllocation(prev, allocationItemId, mins, allocationPeriod));
    }
    setAllocationDialogOpen(false);
    setAllocationItemId(null);
  }, [allocationItemId, allocationMinutes, allocationPeriod, applyChange, planApi]);

  const handleRemoveAllocation = useCallback(() => {
    if (!allocationItemId) return;
    applyChange((prev) => planApi.updateAllocation(prev, allocationItemId, undefined, undefined));
    setAllocationDialogOpen(false);
    setAllocationItemId(null);
  }, [allocationItemId, applyChange, planApi]);

  const handlePlayPiece = useCallback(async (id: string, name: string, minutes: number, period: 'day' | 'week') => {
    try {
      await resumeAudioContext();
    } catch (e) {
      console.error('Error resuming audio context on play segment:', e);
    }

    // If piece was checked from a previous run, uncheck it so starting a new run resets item check state
    applyChange((prev) => planApi.uncheckItem(prev, id));

    const pieceName = name && name.trim() ? name : "Untitled segment";
    selectPiece(id, pieceName, minutes || 15, period);

    if (mode === 'break' || isPracticeComplete) {
      // If we are on break (work timer completed) or practice is complete, start piece overtime instead of main timer
      startPieceOvertime();
    } else {
      // If the main session is not running, start it
      if (!isRunning && onStart) {
        onStart();
      }
    }
  }, [selectPiece, isRunning, onStart, mode, startPieceOvertime, isPracticeComplete, applyChange, planApi]);

  const handleSaveSegment = useCallback((
    id: string,
    name: string,
    goal: string | undefined,
    allocatedTime: number | undefined,
    allocationPeriod: 'day' | 'week' | undefined,
    repertoirePieceId: string | undefined,
    videoUrl: string | undefined
  ) => {
    applyChange((prev) => planApi.updateSegment(prev, id, name, goal, allocatedTime, allocationPeriod, repertoirePieceId, videoUrl));
  }, [applyChange, planApi]);

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
      setItems(planApi.get());
    }
  }, [open, planApi]);

  useEffect(() => {
    const handlePieceComplete = async (event: Event) => {
      const { id } = (event as CustomEvent).detail;
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
    };

    window.addEventListener('piece-timer-complete', handlePieceComplete);
    return () => window.removeEventListener('piece-timer-complete', handlePieceComplete);
  }, [applyChange]);

  const handleRowClick = useCallback(
    (id: string, e: React.MouseEvent<HTMLDivElement>, requestType: "row" | "edit" = "row") => {
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

      // Ensure the row gets focus for keyboard operations, or edit focus for editing.
      setFocusRequest({ id, type: requestType, cursorPosition: "start" });
    },
    [flatList, lastSelectedId]
  );

  const getSelectedBlockIdsFromDOM = useCallback((): string[] => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return [];

    const container = contentRef.current;
    if (!container) return [];

    const allBlockEls = Array.from(container.querySelectorAll<HTMLElement>("[data-item-id]"));
    if (allBlockEls.length === 0) return [];

    const findBlockEl = (node: Node | null): HTMLElement | null => {
      let curr: Node | null = node;
      while (curr && curr !== container && curr !== document.body) {
        if (curr.nodeType === Node.ELEMENT_NODE && (curr as HTMLElement).hasAttribute("data-item-id")) {
          return curr as HTMLElement;
        }
        curr = curr.parentNode;
      }
      return null;
    };

    let startEl = findBlockEl(sel.anchorNode);
    let endEl = findBlockEl(sel.focusNode);

    if (!startEl || !endEl) {
      const activeEl = document.activeElement;
      if (activeEl && container.contains(activeEl)) {
        const activeBlockEl = findBlockEl(activeEl);
        if (activeBlockEl) {
          if (!startEl) startEl = activeBlockEl;
          if (!endEl) endEl = activeBlockEl;
        }
      }
    }

    if (startEl && endEl) {
      const startIdx = allBlockEls.indexOf(startEl);
      const endIdx = allBlockEls.indexOf(endEl);
      if (startIdx !== -1 && endIdx !== -1) {
        const min = Math.min(startIdx, endIdx);
        const max = Math.max(startIdx, endIdx);
        return allBlockEls.slice(min, max + 1).map((el) => el.getAttribute("data-item-id")!).filter(Boolean);
      }
    }

    const selectedIds: string[] = [];
    allBlockEls.forEach((el) => {
      try {
        if (sel.containsNode(el, true)) {
          const id = el.getAttribute("data-item-id");
          if (id && !selectedIds.includes(id)) {
            selectedIds.push(id);
          }
        } else {
          for (let i = 0; i < sel.rangeCount; i++) {
            const range = sel.getRangeAt(i);
            if (range.intersectsNode(el)) {
              const id = el.getAttribute("data-item-id");
              if (id && !selectedIds.includes(id)) {
                selectedIds.push(id);
              }
              break;
            }
          }
        }
      } catch { }
    });

    return selectedIds;
  }, []);

  const handleDeleteMultiple = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const selectedSet = new Set(ids);
    const topLevelIds = ids.filter((id) => !isAncestorSelected(id, selectedSet, flatList));

    const idsInOrder = flatList.map((f) => f.id);
    const orderedDesc = [...topLevelIds].sort(
      (a, b) => idsInOrder.indexOf(b) - idsInOrder.indexOf(a)
    );

    applyChange((prev) => {
      let result = prev;
      for (const id of orderedDesc) {
        result = planApi.delete(result, id);
      }
      return result;
    });

    try {
      window.getSelection()?.removeAllRanges();
    } catch { }
    setSelectedIds([]);
    setLastSelectedId(null);
  }, [flatList, applyChange, planApi]);

  const handleSelectAllBlocks = useCallback(() => {
    const allIds = flatList.map((f) => f.id);
    setSelectedIds(allIds);
    if (allIds.length > 0) {
      setLastSelectedId(allIds[0]);
    }
  }, [flatList]);

  const handleCopySelectionIds = useCallback((targetIds?: string[] | PracticePlanItem, clipboardEvent?: ClipboardEvent) => {
    let idsToCopy: string[] = [];
    let directCopies: PracticePlanItem[] | null = null;

    if (targetIds && !Array.isArray(targetIds)) {
      directCopies = [JSON.parse(JSON.stringify(targetIds))];
    } else if (Array.isArray(targetIds) && targetIds.length > 0) {
      idsToCopy = targetIds;
    } else {
      idsToCopy = selectedIds;
    }

    let copies: PracticePlanItem[] = [];

    if (directCopies) {
      copies = directCopies;
    } else if (idsToCopy.length > 0) {
      const selectedSet = new Set(idsToCopy);
      const topLevelSelectedIds = idsToCopy.filter(
        (id) => !isAncestorSelected(id, selectedSet, flatList)
      );
      const idsInOrder = flatList.map((f) => f.id);
      const ordered = topLevelSelectedIds.sort(
        (a, b) => idsInOrder.indexOf(a) - idsInOrder.indexOf(b)
      );
      for (const id of ordered) {
        const flat = flatList.find((f) => f.id === id);
        if (flat) {
          copies.push(JSON.parse(JSON.stringify(flat.item)));
        }
      }
    }

    if (copies.length > 0) {
      setClipboard(copies);
      const outlineText = copies.map((c) => formatItemAsOutlineText(c)).join("\n");
      if (clipboardEvent && clipboardEvent.clipboardData) {
        clipboardEvent.clipboardData.setData("text/plain", outlineText);
      } else {
        try {
          navigator.clipboard.writeText(outlineText).catch(() => { });
        } catch { }
      }
      try {
        localStorage.setItem("practice-timer-plan-clipboard", JSON.stringify(copies));
      } catch (e) {
        console.warn("[clipboard] Failed to save to localStorage", e);
      }
    }
  }, [selectedIds, flatList]);

  const handleCutSelectionIds = useCallback((targetIds?: string[] | PracticePlanItem, clipboardEvent?: ClipboardEvent) => {
    let idsToCut: string[] = [];
    if (targetIds && !Array.isArray(targetIds)) {
      idsToCut = [targetIds.id];
    } else if (Array.isArray(targetIds) && targetIds.length > 0) {
      idsToCut = targetIds;
    } else {
      idsToCut = selectedIds;
    }

    if (idsToCut.length === 0) return;

    handleCopySelectionIds(idsToCut, clipboardEvent);

    const selectedSet = new Set(idsToCut);
    const topLevelCutIds = idsToCut.filter(
      (id) => !isAncestorSelected(id, selectedSet, flatList)
    );

    const idsInOrder = flatList.map((f) => f.id);
    const orderedDesc = [...topLevelCutIds].sort(
      (a, b) => idsInOrder.indexOf(b) - idsInOrder.indexOf(a)
    );

    applyChange((prev) => {
      let result = prev;
      for (const id of orderedDesc) {
        result = planApi.delete(result, id);
      }
      return result;
    });

    try {
      window.getSelection()?.removeAllRanges();
    } catch { }
    setSelectedIds([]);
    setLastSelectedId(null);
  }, [selectedIds, flatList, handleCopySelectionIds, applyChange, planApi]);

  const handleCopySelection = useCallback((targetItem?: PracticePlanItem) => {
    handleCopySelectionIds(targetItem);
  }, [handleCopySelectionIds]);

  const handleCutSelection = useCallback((targetItem?: PracticePlanItem) => {
    handleCutSelectionIds(targetItem);
  }, [handleCutSelectionIds]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
      const isInputFocused = activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA");
      const hasPartialTextSelection = isInputFocused && activeEl.selectionStart !== activeEl.selectionEnd;

      if ((e.key === "a" || e.key === "A") && (e.metaKey || e.ctrlKey)) {
        if (!isInputFocused || (activeEl.selectionStart === 0 && activeEl.selectionEnd === activeEl.value.length)) {
          e.preventDefault();
          handleSelectAllBlocks();
          return;
        }
      }

      if ((e.key === "Backspace" || e.key === "Delete") && !hasPartialTextSelection) {
        const domSelectedIds = getSelectedBlockIdsFromDOM();
        if (domSelectedIds.length > 1) {
          e.preventDefault();
          handleDeleteMultiple(domSelectedIds);
        }
      }
    };

    const handleGlobalCopy = (e: ClipboardEvent) => {
      const activeEl = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
      const isInputFocused = activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA");
      const hasPartialTextSelection = isInputFocused && activeEl.selectionStart !== activeEl.selectionEnd;

      if (!hasPartialTextSelection) {
        const domSelectedIds = getSelectedBlockIdsFromDOM();
        const idsToCopy = domSelectedIds.length > 0 ? domSelectedIds : selectedIds;
        if (idsToCopy.length > 0) {
          e.preventDefault();
          handleCopySelectionIds(idsToCopy, e);
        }
      }
    };

    const handleGlobalCut = (e: ClipboardEvent) => {
      const activeEl = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
      const isInputFocused = activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA");
      const hasPartialTextSelection = isInputFocused && activeEl.selectionStart !== activeEl.selectionEnd;

      if (!hasPartialTextSelection) {
        const domSelectedIds = getSelectedBlockIdsFromDOM();
        const idsToCut = domSelectedIds.length > 0 ? domSelectedIds : selectedIds;
        if (idsToCut.length > 0) {
          e.preventDefault();
          handleCutSelectionIds(idsToCut, e);
        }
      }
    };

    let rafId: number | null = null;
    const handleSelectionChange = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        // Only sync a cross-block browser selection into block-level state
        // while the user is actively drag-selecting. Ignores phantom ranges
        // that appear when React swaps a title `<span>` for an `<Input>`
        // (entering segment edit mode) and the browser reassigns the range
        // endpoints to text nodes in the next row.
        if (!isPointerSelectingRef.current) return;

        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) return;
        if (sel.toString().length === 0) return;

        const domSelectedIds = getSelectedBlockIdsFromDOM();
        if (domSelectedIds.length > 1) {
          setSelectedIds(domSelectedIds);
        }
      });
    };

    const handlePointerDown = (e: PointerEvent) => {
      // Only left / primary button starts a drag-select.
      if (e.button === 0 || e.button === undefined) {
        isPointerSelectingRef.current = true;
      }
    };
    const handlePointerUp = () => {
      // Release on the next frame so a `selectionchange` triggered by the
      // final `mouseup` still runs with the flag on.
      requestAnimationFrame(() => {
        isPointerSelectingRef.current = false;
      });
    };

    document.addEventListener("keydown", handleGlobalKeyDown);
    document.addEventListener("copy", handleGlobalCopy);
    document.addEventListener("cut", handleGlobalCut);
    document.addEventListener("selectionchange", handleSelectionChange);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerUp);

    return () => {
      document.removeEventListener("keydown", handleGlobalKeyDown);
      document.removeEventListener("copy", handleGlobalCopy);
      document.removeEventListener("cut", handleGlobalCut);
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointercancel", handlePointerUp);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [getSelectedBlockIdsFromDOM, selectedIds, handleDeleteMultiple, handleCopySelectionIds, handleCutSelectionIds, handleSelectAllBlocks]);

  const handlePasteBelowSelection = useCallback(
    (targetId?: string) => {
      let activeClipboard = clipboard;
      if (!activeClipboard || activeClipboard.length === 0) {
        try {
          const raw = localStorage.getItem("practice-timer-plan-clipboard");
          if (raw) {
            activeClipboard = JSON.parse(raw);
          }
        } catch { }
      }

      if (!activeClipboard || activeClipboard.length === 0) {
        toast({
          title: "Clipboard empty",
          description: "No items in clipboard. Copy or cut a block first.",
          variant: "destructive",
        });
        return;
      }

      const newIds: string[] = [];
      applyChange((prev) => {
        let result = prev;
        let insertAfterId = targetId || (prev.length > 0 ? prev[prev.length - 1].id : null);
        if (!insertAfterId && prev.length === 0) {
          const cloned = activeClipboard.map(cloneWithNewIds);
          newIds.push(...cloned.map((c) => c.id));
          return cloned;
        }
        for (const snippet of activeClipboard) {
          const cloned = cloneWithNewIds(snippet);
          if (insertAfterId) {
            result = planApi.insertExistingAfter(result, insertAfterId, cloned);
            insertAfterId = cloned.id;
          } else {
            result = [...result, cloned];
            insertAfterId = cloned.id;
          }
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
        const totalCount = countTotalNodesInForest(activeClipboard);
        toast({
          title: "Pasted",
          description: `Pasted ${totalCount} item${totalCount > 1 ? "s" : ""}.`,
          duration: 2500,
        });
      }
    },
    [clipboard, applyChange, planApi, toast]
  );

  const handlePasteMultiLineText = useCallback((targetId: string, rawText: string) => {
    const parsedItems = parseTextToPlanItems(rawText);
    if (parsedItems.length === 0) return;

    applyChange((prev) => {
      const flat = flatList.find((f) => f.id === targetId);
      if (!flat) {
        return [...prev, ...parsedItems];
      }

      if (!flat.item.text.trim() && (!flat.item.children || flat.item.children.length === 0)) {
        let result = prev;
        let insertAfterId = targetId;
        for (const newItem of parsedItems) {
          result = planApi.insertExistingAfter(result, insertAfterId, newItem);
          insertAfterId = newItem.id;
        }
        result = planApi.delete(result, targetId);
        return result;
      } else {
        let result = prev;
        let insertAfterId = targetId;
        for (const newItem of parsedItems) {
          result = planApi.insertExistingAfter(result, insertAfterId, newItem);
          insertAfterId = newItem.id;
        }
        return result;
      }
    });

    if (parsedItems.length > 0) {
      const lastItem = parsedItems[parsedItems.length - 1];
      setFocusRequest({
        id: lastItem.id,
        type: "edit",
        cursorPosition: "end",
      });
    }
  }, [flatList, applyChange, planApi]);

  const handleToggleCheck = useCallback((id: string) => {
    applyChange((prev) => planApi.toggleCheck(prev, id));
  }, [applyChange, planApi]);

  const handleUpdateText = useCallback((id: string, text: string) => {
    if (isUndoingRef.current) return;
    if (text.includes("\n") || text.includes("\r")) {
      handlePasteMultiLineText(id, text);
      return;
    }
    applyChange((prev) => planApi.updateText(prev, id, text));
  }, [applyChange, planApi, handlePasteMultiLineText]);

  const handleUpdateType = useCallback((id: string, type: BlockType | "repertoire-piece") => {
    const actualType = type === "repertoire-piece" ? "segment" : type;
    applyChange((prev) => planApi.updateBlockType(prev, id, actualType));
    // Request focus back to ensure editing continues smoothly
    setFocusRequest({ id, type: actualType === "divider" ? "row" : "edit", cursorPosition: "start" });
  }, [applyChange, planApi]);

  const handleDelete = useCallback((id: string, force = false) => {
    const flat = flatList.find((x) => x.id === id);
    if (!flat) return;

    const isSegment = flat.item.blockType === "segment";
    const hasChildren = !!(flat.item.children && flat.item.children.length > 0);

    if (!force && (isSegment || hasChildren)) {
      const rawName = stripMarkdownLinks(flat.item.text.trim());
      setDeleteConfirmItem({
        id,
        name: rawName || (isSegment ? "this segment" : "this block"),
        isSegment,
        hasChildren,
      });
      return;
    }

    const index = flatList.findIndex((x) => x.id === id);
    let nextFocusId: string | null = null;
    if (index > 0) {
      nextFocusId = flatList[index - 1].id;
    } else if (index >= 0 && index < flatList.length - 1) {
      nextFocusId = flatList[index + 1].id;
    }

    const deletedName = stripMarkdownLinks(flat.item.text.trim()) || (isSegment ? "Segment" : "Block");

    applyChange((prev) => planApi.delete(prev, id));
    if (nextFocusId) {
      setFocusRequest({ id: nextFocusId, type: "row" });
    }
  }, [flatList, applyChange, planApi]);

  const handleInsertBlock = useCallback(
    (index: number, blockType: BlockType | "repertoire-piece", initialText?: string) => {
      const newId = generateId();
      const actualType = blockType === "repertoire-piece" ? "segment" : blockType;
      applyChange((prev) =>
        planApi.insertRootAt(prev, index, actualType, initialText, newId)
      );
      setFocusRequest({ id: newId, type: actualType === "divider" ? "row" : "edit", cursorPosition: "end" });
    },
    [applyChange, planApi]
  );

  const handleInsertBelow = useCallback(
    (afterId: string, blockType: BlockType | "repertoire-piece", empty?: boolean) => {
      const newId = generateId();
      const actualType = blockType === "repertoire-piece" ? "segment" : blockType;
      applyChange((prev) =>
        planApi.insertBlockAfter(
          prev,
          afterId,
          actualType,
          empty ? "" : undefined,
          newId
        )
      );
      setFocusRequest({ id: newId, type: actualType === "divider" ? "row" : "edit", cursorPosition: "end" });
    },
    [applyChange, planApi]
  );

  const handleInsertBefore = useCallback(
    (beforeId: string, blockType: BlockType | "repertoire-piece", empty?: boolean) => {
      const newId = generateId();
      const actualType = blockType === "repertoire-piece" ? "segment" : blockType;
      applyChange((prev) =>
        planApi.insertBlockBefore(
          prev,
          beforeId,
          actualType,
          empty ? "" : undefined,
          newId
        )
      );
      setFocusRequest({ id: newId, type: actualType === "divider" ? "row" : "edit", cursorPosition: "end" });
    },
    [applyChange, planApi]
  );

  const handleAddLineAtSlot = useCallback((index: number) => {
    const newId = generateId();
    applyChange((prev) =>
      planApi.insertRootAt(prev, index, "text", "", newId)
    );
    setFocusRequest({ id: newId, type: "edit", cursorPosition: "end" });
  }, [applyChange, planApi]);

  const handleIndent = useCallback((id: string, cursorPosition?: number | "start" | "end") => {
    applyChange((prev) => planApi.indent(prev, id));
    if (cursorPosition !== undefined) {
      setFocusRequest({ id, type: "edit", cursorPosition });
    }
  }, [applyChange, planApi]);

  const handleUnindent = useCallback((id: string, cursorPosition?: number | "start" | "end") => {
    applyChange((prev) => planApi.unindent(prev, id));
    if (cursorPosition !== undefined) {
      setFocusRequest({ id, type: "edit", cursorPosition });
    }
  }, [applyChange, planApi]);

  const handleReset = useCallback(() => {
    applyChange((prev) => planApi.resetChecks(prev));
  }, [applyChange, planApi]);

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importText, setImportText] = useState("");

  const handleExportPlan = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(items, null, 2)).then(() => {
      toast({
        title: `${planTitle} Exported`,
        description: `${planTitle} copied to clipboard. Paste into Import on another tab or device.`,
        duration: 3000,
      });
    });
  }, [items, toast, planTitle]);

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
      planApi.save(normalized);
      setImportDialogOpen(false);
      setImportText("");
      toast({ title: `${planTitle} Imported`, description: `${planTitle} loaded successfully.` });
    } catch (e) {
      toast({
        title: "Invalid JSON",
        description: e instanceof Error ? e.message : "Could not parse. Check for truncated data.",
        variant: "destructive",
      });
    }
  }, [importText, normalizeImportedItem, toast, planApi, planTitle]);



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
      let step1 = planApi.updateText(items, prev.id, newText);
      let step2 = planApi.delete(step1, id);
      return step2;
    });

    setFocusRequest({
      id: prev.id,
      type: "edit",
      cursorPosition: cursorAt
    });

  }, [flatList, handleDelete, applyChange, planApi]);

  const handleInputFocus = useCallback((_id: string) => {
    // Any focus into a specific row/input is unambiguous single-row intent,
    // so collapse any prior block-level multi-selection. This also clears
    // stale phantom multi-selects that survived a DOM rearrangement (e.g.
    // React swapping a title span for an input when entering segment edit).
    setSelectedIds((prev) => (prev.length === 0 ? prev : []));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      applyChange((prev) => planApi.reorder(prev, active.id as string, over.id as string));
    }
  }, [applyChange, planApi]);

  if (!open) return null;

  return (
    <div className="space-y-6">
      {/* Flat planning sub-header actions */}
      <div className="flex items-center justify-end -mt-3 mb-2">
        <TooltipProvider delayDuration={200}>
          <div className="flex items-center gap-1 bg-slate-100/50 dark:bg-slate-900/40 border border-black/5 dark:border-white/10 rounded-xl p-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 rounded-lg"
                  onClick={handleReset}
                  aria-label="Reset progress"
                >
                  <span className="material-icons text-lg">refresh</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reset Progress</TooltipContent>
            </Tooltip>


            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 rounded-lg"
                      aria-label="Plan options"
                    >
                      <span className="material-icons text-lg">more_vert</span>
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Plan Options</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="bg-slate-900 border border-white/10 text-foreground">
                <DropdownMenuItem onClick={() => setImportDialogOpen(true)} className="focus:bg-white/5 cursor-pointer flex items-center gap-2">
                  <span className="material-icons text-sm">content_paste</span>
                  Import {planTitle}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPlan} className="focus:bg-white/5 cursor-pointer flex items-center gap-2">
                  <span className="material-icons text-sm">content_copy</span>
                  Export {planTitle}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TooltipProvider>
      </div>

      <div
        ref={contentRef}
        className="w-full p-0 sm:p-4"
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
            <div className="space-y-1 pb-20 pl-8 sm:pl-14">
              {items.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground animate-in fade-in duration-300">
                  <p className="mb-4">Your {planTitle.toLowerCase()} is empty.</p>
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
                      {allowSegments && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel>Practice</DropdownMenuLabel>
                          {PRACTICE_BLOCK_OPTIONS.map(({ type, label, icon }) => (
                            <DropdownMenuItem
                              key={type}
                              onSelect={() => handleInsertBlock(0, type)}
                              className="flex items-center gap-2"
                            >
                              <span className="w-6 text-center font-semibold text-muted-foreground flex items-center justify-center">
                                <span className="material-icons text-base">{icon}</span>
                              </span>
                              {label}
                            </DropdownMenuItem>
                          ))}
                        </>
                      )}
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
                  onToggle={handleToggleCheck}
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
                  onPasteMultiLineText={handlePasteMultiLineText}
                  onUndo={handleUndo}
                  onOpenAllocationDialog={handleOpenAllocationDialog}
                  onPlayPiece={handlePlayPiece}
                  onSaveSegment={handleSaveSegment}
                  repertoirePieces={repertoirePieces}
                  allowSegments={allowSegments}
                  onSelectAllBlocks={handleSelectAllBlocks}
                  planType={planType}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
      {/* Link Popover Portal Target */}
      <div id="practice-sheet-content" className="relative" />

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import {planTitle}</DialogTitle>
            <DialogDescription>
              Paste exported {planTitle.toLowerCase()} JSON below. Use Export {planTitle} on another tab or device to copy it.
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
            <DialogTitle>Set Time Box Duration</DialogTitle>
            <DialogDescription>
              Set target duration (time box) for "{allocationItemText}".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="allocation-minutes">Session Target Duration (Minutes)</Label>
              <Input
                id="allocation-minutes"
                type="number"
                min="1"
                placeholder="e.g. 15"
                value={allocationMinutes}
                onChange={(e) => setAllocationMinutes(e.target.value)}
              />
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

      <AlertDialog open={!!deleteConfirmItem} onOpenChange={(open) => { if (!open) setDeleteConfirmItem(null); }}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteConfirmItem?.isSegment
                ? `Delete segment?`
                : deleteConfirmItem?.hasChildren
                  ? `Delete block and sub-items?`
                  : `Delete block?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirmItem?.name}"{deleteConfirmItem?.hasChildren ? " and all of its sub-items" : ""}? You can undo this action if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteConfirmItem) {
                  const targetId = deleteConfirmItem.id;
                  setDeleteConfirmItem(null);
                  handleDelete(targetId, true);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import { RepertoireBlock } from "@/lib/repertoire.types";
import { extractYouTubeId } from "./YouTubeEmbed";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

const generateId = () => Math.random().toString(36).slice(2, 10);

const BLOCK_OPTIONS: { type: RepertoireBlock["type"]; label: string; icon: string }[] = [
  { type: "text",     label: "Text",           icon: "T"  },
  { type: "heading1", label: "Heading 1",       icon: "H1" },
  { type: "heading2", label: "Heading 2",       icon: "H2" },
  { type: "bullet",   label: "Bulleted list",   icon: "•"  },
  { type: "number",   label: "Numbered list",   icon: "1." },
  { type: "todo",     label: "To-do",           icon: "☐"  },
  { type: "divider",  label: "Divider",         icon: "—"  },
  { type: "youtube",  label: "YouTube embed",   icon: "▶"  },
];

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

// ── Single block ──────────────────────────────────────────────────────────────
interface BlockItemProps {
  block: RepertoireBlock;
  index: number;
  focusId: string | null;
  onFocused: () => void;
  onChange: (id: string, updates: Partial<RepertoireBlock>) => void;
  onDelete: (id: string) => void;
  onInsertBelow: (id: string, type: RepertoireBlock["type"]) => void;
  onFocusPrev: (id: string) => void;
  onFocusNext: (id: string) => void;
}

function BlockItem({
  block,
  index,
  focusId,
  onFocused,
  onChange,
  onDelete,
  onInsertBelow,
  onFocusPrev,
  onFocusNext,
}: BlockItemProps) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const ytInputRef = useRef<HTMLInputElement>(null);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [slashHighlight, setSlashHighlight] = useState(0);
  const slashOpenRef = useRef(false);

  // Auto-resize whenever block text changes
  useEffect(() => {
    if (taRef.current) autoResize(taRef.current);
  }, [block.text, block.type]);

  // Respond to external focus requests (e.g. after inserting a new block)
  useEffect(() => {
    if (focusId === block.id) {
      const el = taRef.current ?? ytInputRef.current;
      if (el) {
        el.focus();
        if (el instanceof HTMLTextAreaElement) {
          el.setSelectionRange(el.value.length, el.value.length);
        }
      }
      onFocused();
    }
  }, [focusId, block.id, onFocused]);

  const filteredSlash = useMemo(() => {
    if (!slashFilter) return BLOCK_OPTIONS;
    const f = slashFilter.toLowerCase();
    return BLOCK_OPTIONS.filter((o) => o.label.toLowerCase().includes(f) || o.type.includes(f));
  }, [slashFilter]);

  const applySlash = useCallback(
    (type: RepertoireBlock["type"]) => {
      setSlashOpen(false);
      slashOpenRef.current = false;
      setSlashFilter("");
      setSlashHighlight(0);
      onChange(block.id, { text: "", type });
      requestAnimationFrame(() => taRef.current?.focus());
    },
    [block.id, onChange]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      autoResize(e.currentTarget);

      if (val === "/") {
        setSlashOpen(true);
        slashOpenRef.current = true;
        setSlashFilter("");
        setSlashHighlight(0);
      } else if (val.startsWith("/") && slashOpenRef.current) {
        setSlashFilter(val.slice(1));
        setSlashHighlight(0);
      } else {
        if (slashOpenRef.current) {
          setSlashOpen(false);
          slashOpenRef.current = false;
          setSlashFilter("");
        }
      }

      onChange(block.id, { text: val });
    },
    [block.id, onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const ta = e.currentTarget;

      // ── Slash menu navigation ──
      if (slashOpenRef.current) {
        if (e.key === "ArrowDown") { e.preventDefault(); setSlashHighlight((h) => Math.min(h + 1, filteredSlash.length - 1)); return; }
        if (e.key === "ArrowUp")   { e.preventDefault(); setSlashHighlight((h) => Math.max(h - 1, 0)); return; }
        if (e.key === "Enter")     { e.preventDefault(); if (filteredSlash[slashHighlight]) applySlash(filteredSlash[slashHighlight].type); return; }
        if (e.key === "Escape")    { e.preventDefault(); setSlashOpen(false); slashOpenRef.current = false; setSlashFilter(""); return; }
        if (e.key === "Backspace" && ta.value === "/") { setSlashOpen(false); slashOpenRef.current = false; setSlashFilter(""); }
      }

      // ── Markdown shortcuts on Space ──
      if (e.key === " " && ta.selectionStart === ta.value.length) {
        const shortcuts: Record<string, RepertoireBlock["type"]> = {
          "#": "heading1", "##": "heading2",
          "-": "bullet", "*": "bullet",
          "[]": "todo", "---": "divider",
        };
        const match = shortcuts[ta.value.trim()];
        if (match) {
          e.preventDefault();
          onChange(block.id, { text: "", type: match });
          return;
        }
      }

      // ── Enter: new block below ──
      if (e.key === "Enter") {
        if (block.type === "text" && !e.shiftKey) return; // allow newlines in text blocks
        e.preventDefault();
        const newType: RepertoireBlock["type"] =
          block.type === "heading1" || block.type === "heading2" ? "text" : block.type;
        onInsertBelow(block.id, newType);
        return;
      }

      // ── Backspace at start ──
      if (e.key === "Backspace" && ta.selectionStart === 0 && ta.selectionEnd === 0) {
        if (["bullet", "number", "todo", "heading1", "heading2"].includes(block.type)) {
          e.preventDefault();
          onChange(block.id, { type: "text" });
          return;
        }
        if (ta.value === "") {
          e.preventDefault();
          onDelete(block.id);
          onFocusPrev(block.id);
          return;
        }
      }

      // ── Arrow navigation ──
      if (e.key === "ArrowUp" && ta.selectionStart === 0) {
        e.preventDefault();
        onFocusPrev(block.id);
      }
      if (e.key === "ArrowDown" && ta.selectionStart === ta.value.length) {
        e.preventDefault();
        onFocusNext(block.id);
      }
    },
    [block.id, block.type, filteredSlash, slashHighlight, applySlash, onChange, onDelete, onInsertBelow, onFocusPrev, onFocusNext]
  );

  const taBase =
    "w-full bg-transparent border-none outline-none resize-none overflow-hidden leading-relaxed placeholder:text-muted-foreground/40 focus:ring-0";

  return (
    <div className="group/block relative">
      {/* Invisible hover zone for YouTube blocks — extends into left gutter so
          hovering near the left edge triggers group-hover (iframes eat mouse events) */}
      {block.type === "youtube" && extractYouTubeId(block.text) && (
        <div className="absolute -left-8 top-0 bottom-0 w-12 z-[1]" />
      )}

      {/* Left hover bar */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full flex items-center gap-0.5 opacity-0 group-hover/block:opacity-100 transition-opacity z-10 pr-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={(e) => e.stopPropagation()}>
              <span className="material-icons text-base">add</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48" onCloseAutoFocus={(e) => e.preventDefault()}>
            {BLOCK_OPTIONS.map(({ type, label, icon }) => (
              <DropdownMenuItem key={type} onSelect={() => onInsertBelow(block.id, type)} className="flex items-center gap-2">
                <span className="w-6 text-center font-semibold text-muted-foreground text-xs">{icon}</span>
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={(e) => e.stopPropagation()}>
              <span className="material-icons text-base">drag_indicator</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44" onCloseAutoFocus={(e) => e.preventDefault()}>
            <DropdownMenuItem onSelect={() => onDelete(block.id)} className="flex items-center gap-2 text-destructive focus:text-destructive">
              <span className="material-icons text-sm">delete</span>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Delete button — shown on hover, inside the block boundary */}
      {block.type !== "youtube" && (
        <button
          type="button"
          onClick={() => onDelete(block.id)}
          className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/block:opacity-100 transition-opacity text-muted-foreground/40 hover:text-destructive z-10"
          tabIndex={-1}
        >
          <span className="material-icons text-base">close</span>
        </button>
      )}

      {/* Divider */}
      {block.type === "divider" ? (
        <div className="flex items-center py-3">
          <hr className="flex-1 border-border/50" />
        </div>

      ) : block.type === "youtube" ? (
        /* YouTube */
        <div className="py-2">
          {extractYouTubeId(block.text) ? (
            <div className="relative">
              <div className="relative w-full rounded-lg overflow-hidden" style={{ aspectRatio: "16/9" }}>
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${extractYouTubeId(block.text)}`}
                  title="YouTube video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                />
              </div>
              {/* Three-dot menu — top-right corner */}
              <div className="absolute top-2 right-2 z-10">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 bg-black/60 hover:bg-black/80 text-white">
                      <span className="material-icons text-lg">more_horiz</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44" onCloseAutoFocus={(e) => e.preventDefault()}>
                    <DropdownMenuItem onSelect={() => { navigator.clipboard.writeText(block.text); }} className="flex items-center gap-2">
                      <span className="material-icons text-sm">content_copy</span>
                      Copy URL
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onChange(block.id, { text: "" })} className="flex items-center gap-2">
                      <span className="material-icons text-sm">link</span>
                      Replace URL
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onDelete(block.id)} className="flex items-center gap-2 text-destructive focus:text-destructive">
                      <span className="material-icons text-sm">delete</span>
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ) : (
            <input
              ref={ytInputRef}
              type="url"
              value={block.text}
              onChange={(e) => onChange(block.id, { text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
                if (e.key === "Backspace" && block.text === "") { e.preventDefault(); onDelete(block.id); onFocusPrev(block.id); }
              }}
              placeholder="Paste YouTube URL..."
              className="w-full bg-transparent border border-border/50 rounded px-3 py-2 text-sm outline-none focus:border-primary placeholder:text-muted-foreground/50"
            />
          )}
        </div>

      ) : (
        /* Text / Heading / List / Todo */
        <div className="flex items-start gap-2 py-0.5 relative">
          {block.type === "todo" && (
            <input
              type="checkbox"
              checked={block.checked || false}
              onChange={(e) => onChange(block.id, { checked: e.target.checked })}
              className="mt-1.5 shrink-0 rounded"
              onClick={(e) => e.stopPropagation()}
            />
          )}
          {block.type === "bullet" && (
            <span className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/70" />
          )}
          {block.type === "number" && (
            <span className="w-6 shrink-0 text-right text-sm text-muted-foreground tabular-nums select-none pr-1 pt-0.5">
              {index + 1}.
            </span>
          )}

          <div className="flex-1 relative">
            <textarea
              ref={taRef}
              value={block.text}
              rows={1}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={
                block.type === "heading1" ? "Heading 1" :
                block.type === "heading2" ? "Heading 2" :
                block.type === "bullet"   ? "List item" :
                block.type === "todo"     ? "To-do item" :
                "Type '/' for blocks..."
              }
              className={cn(
                taBase,
                block.type === "heading1" && "text-2xl font-bold py-1",
                block.type === "heading2" && "text-xl font-semibold py-0.5",
                (block.type === "text" || block.type === "bullet" || block.type === "number") && "text-sm",
                block.type === "todo" && cn("text-sm", block.checked && "line-through text-muted-foreground"),
              )}
            />

            {/* Slash command menu */}
            {slashOpen && filteredSlash.length > 0 && (
              <>
                <div className="fixed inset-0 z-40" onMouseDown={() => { setSlashOpen(false); slashOpenRef.current = false; }} />
                <div className="absolute left-0 top-full mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg p-1 min-w-[200px]">
                  {filteredSlash.map((opt, i) => (
                    <button
                      key={opt.type}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); applySlash(opt.type); }}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 text-sm rounded text-left",
                        i === slashHighlight ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                      )}
                    >
                      <span className="w-5 text-center font-semibold text-muted-foreground text-xs">{opt.icon}</span>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Public editor ─────────────────────────────────────────────────────────────
interface RepertoireEditorProps {
  blocks: RepertoireBlock[];
  onChange: (blocks: RepertoireBlock[]) => void;
}

export function RepertoireEditor({ blocks, onChange }: RepertoireEditorProps) {
  const [focusId, setFocusId] = useState<string | null>(null);

  const updateBlock = useCallback(
    (id: string, updates: Partial<RepertoireBlock>) => {
      onChange(blocks.map((b) => (b.id === id ? { ...b, ...updates } : b)));
    },
    [blocks, onChange]
  );

  const deleteBlock = useCallback(
    (id: string) => {
      onChange(blocks.filter((b) => b.id !== id));
    },
    [blocks, onChange]
  );

  const insertBlock = useCallback(
    (afterId: string | null, type: RepertoireBlock["type"]) => {
      const newBlock: RepertoireBlock = {
        id: generateId(),
        type,
        text: "",
        checked: type === "todo" ? false : undefined,
      };
      if (!afterId) {
        onChange([...blocks, newBlock]);
      } else {
        const idx = blocks.findIndex((b) => b.id === afterId);
        const next = [...blocks];
        next.splice(idx + 1, 0, newBlock);
        onChange(next);
      }
      setFocusId(newBlock.id);
    },
    [blocks, onChange]
  );

  const focusPrev = useCallback(
    (id: string) => {
      const idx = blocks.findIndex((b) => b.id === id);
      if (idx > 0) setFocusId(blocks[idx - 1].id);
    },
    [blocks]
  );

  const focusNext = useCallback(
    (id: string) => {
      const idx = blocks.findIndex((b) => b.id === id);
      if (idx < blocks.length - 1) setFocusId(blocks[idx + 1].id);
    },
    [blocks]
  );

  return (
    <div className="pl-8">
      {blocks.map((block, i) => (
        <BlockItem
          key={block.id}
          block={block}
          index={i}
          focusId={focusId}
          onFocused={() => setFocusId(null)}
          onChange={updateBlock}
          onDelete={deleteBlock}
          onInsertBelow={(id, type) => insertBlock(id, type)}
          onFocusPrev={focusPrev}
          onFocusNext={focusNext}
        />
      ))}

      {blocks.length === 0 && (
        <div
          className="text-muted-foreground/50 text-sm py-2 cursor-text select-none"
          onClick={() => insertBlock(null, "text")}
        >
          Click to add notes...
        </div>
      )}

      <div className="mt-2 opacity-0 hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground h-7 gap-1">
              <span className="material-icons text-base">add</span>
              Add block
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {BLOCK_OPTIONS.map(({ type, label, icon }) => (
              <DropdownMenuItem key={type} onSelect={() => insertBlock(null, type)} className="flex items-center gap-2">
                <span className="w-6 text-center font-semibold text-muted-foreground text-xs">{icon}</span>
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

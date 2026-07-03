import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import { RepertoireBlock } from "@/lib/repertoire.types";
import { extractYouTubeId } from "./YouTubeEmbed";
import { InlineToolbar } from "./InlineToolbar";
import { LinkPopover } from "./LinkPopover";
import { TextWithLinks } from "./TextWithLinks";
import { Button } from "./ui/button";
import { useTextSelection } from "@/hooks/useTextSelection";
import { applyTextFormat } from "@/lib/richText";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "./ui/dropdown-menu";

const generateId = () => Math.random().toString(36).slice(2, 10);

const BLOCK_OPTIONS: { type: RepertoireBlock["type"]; label: string; icon: string }[] = [
    { type: "text", label: "Text", icon: "T" },
    { type: "heading1", label: "Heading 1", icon: "H1" },
    { type: "heading2", label: "Heading 2", icon: "H2" },
    { type: "bullet", label: "Bulleted list", icon: "•" },
    { type: "number", label: "Numbered list", icon: "1." },
    { type: "todo", label: "To-do", icon: "☐" },
    { type: "divider", label: "Divider", icon: "—" },
    { type: "youtube", label: "YouTube embed", icon: "▶" },
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
    const blockText = block.text || "";
    const taRef = useRef<HTMLTextAreaElement>(null);
    const toolbarAnchorRef = useRef<HTMLInputElement>(null);
    const ytInputRef = useRef<HTMLInputElement>(null);
    const [editing, setEditing] = useState(!blockText);
    const [slashOpen, setSlashOpen] = useState(false);
    const [slashFilter, setSlashFilter] = useState("");
    const [slashHighlight, setSlashHighlight] = useState(0);
    const slashOpenRef = useRef(false);

    const {
        selection,
        setSelection,
        linkPopoverOpen,
        setLinkPopoverOpen,
        linkPopoverOpenRef,
    } = useTextSelection();

    // Position the toolbar anchor at the selection midpoint
    const positionToolbarAnchor = useCallback(() => {
        const ta = taRef.current;
        const anchor = toolbarAnchorRef.current;
        if (!ta || !anchor) return;
        const { selectionStart, selectionEnd } = ta;
        if (selectionStart === selectionEnd) return;

        // Create a mirror div to measure caret position
        const mirror = document.createElement("div");
        const style = window.getComputedStyle(ta);
        mirror.style.cssText = `
            position: absolute; visibility: hidden; white-space: pre-wrap; word-wrap: break-word;
            width: ${ta.clientWidth}px;
            font: ${style.font}; letter-spacing: ${style.letterSpacing};
            padding: ${style.padding}; border: ${style.border};
            line-height: ${style.lineHeight};
        `;
        mirror.textContent = ta.value.slice(0, selectionStart);
        const span = document.createElement("span");
        span.textContent = ta.value.slice(selectionStart, selectionEnd) || ".";
        mirror.appendChild(span);
        document.body.appendChild(mirror);

        const taRect = ta.getBoundingClientRect();
        const spanRect = span.getBoundingClientRect();
        const mirrorRect = mirror.getBoundingClientRect();

        const top = taRect.top + (spanRect.top - mirrorRect.top) - ta.scrollTop;
        const left = taRect.left + (spanRect.left - mirrorRect.left) + spanRect.width / 2;

        anchor.style.position = "fixed";
        anchor.style.top = `${top}px`;
        anchor.style.left = `${left}px`;
        anchor.style.width = "1px";
        anchor.style.height = "1px";

        document.body.removeChild(mirror);
    }, []);

    const handleSelect = useCallback(() => {
        const ta = taRef.current;
        if (!ta) return;
        const { selectionStart, selectionEnd } = ta;
        if (selectionStart !== selectionEnd) {
            setSelection({ start: selectionStart, end: selectionEnd });
            requestAnimationFrame(positionToolbarAnchor);
        } else {
            setSelection(null);
        }
    }, [positionToolbarAnchor, setSelection]);

    const applyFormat = useCallback(
        (action: "bold" | "italic" | "link", url?: string) => {
            if (!selection) return;
            const result = applyTextFormat(blockText, selection, action, url);
            if (!result) return;
            onChange(block.id, { text: result.newText });
            setSelection(null);
            setTimeout(() => {
                taRef.current?.focus();
                taRef.current?.setSelectionRange(selection.start, result.newCursorEnd);
            }, 10);
        },
        [block.id, blockText, selection, onChange, setSelection]
    );

    // Auto-resize whenever block text changes
    useEffect(() => {
        if (taRef.current) autoResize(taRef.current);
    }, [blockText, block.type]);

    // Respond to external focus requests (e.g. after inserting a new block)
    useEffect(() => {
        if (focusId === block.id) {
            setEditing(true);
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

    // Focus textarea when entering edit mode
    useEffect(() => {
        if (editing && taRef.current) {
            taRef.current.focus();
            autoResize(taRef.current);
        }
    }, [editing]);

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
                if (e.key === "ArrowUp") { e.preventDefault(); setSlashHighlight((h) => Math.max(h - 1, 0)); return; }
                if (e.key === "Enter") { e.preventDefault(); if (filteredSlash[slashHighlight]) applySlash(filteredSlash[slashHighlight].type); return; }
                if (e.key === "Escape") { e.preventDefault(); setSlashOpen(false); slashOpenRef.current = false; setSlashFilter(""); return; }
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

    const isRenderedYouTube = block.type === "youtube" && !!extractYouTubeId(blockText);

    return (
        <div className="group/block relative">
            {/* Invisible hover zone for YouTube blocks — iframes eat mouse events */}
            {isRenderedYouTube && (
                <div className="absolute -left-10 top-0 bottom-0 w-12 z-[1]" />
            )}

            {/* Left hover bar */}
            <div className={cn(
                "absolute top-1 flex items-center gap-0.5 opacity-0 group-hover/block:opacity-100 transition-opacity z-10 pr-1",
                isRenderedYouTube ? "-left-8 -translate-x-full" : "left-0 -translate-x-full"
            )}>
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
                <div className="-ml-8 -mr-2">
                    {extractYouTubeId(blockText) ? (
                        <div className="relative">
                            <div className="relative w-full aspect-video">
                                <iframe
                                    src={`https://www.youtube-nocookie.com/embed/${extractYouTubeId(blockText)}?rel=0`}
                                    title="YouTube video"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                    className="absolute top-0 left-0 w-full h-full border-0"
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
                                        <DropdownMenuItem onSelect={() => { navigator.clipboard.writeText(blockText); }} className="flex items-center gap-2">
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
                            value={blockText}
                            onChange={(e) => onChange(block.id, { text: e.target.value })}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") e.preventDefault();
                                if (e.key === "Backspace" && blockText === "") { e.preventDefault(); onDelete(block.id); onFocusPrev(block.id); }
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
                        {editing ? (
                            <>
                                <textarea
                                    ref={taRef}
                                    value={blockText}
                                    rows={1}
                                    onChange={handleChange}
                                    onKeyDown={handleKeyDown}
                                    onSelect={handleSelect}
                                    onMouseUp={handleSelect}
                                    onBlur={() => {
                                        if (!linkPopoverOpenRef.current) {
                                            setSelection(null);
                                            setEditing(false);
                                        }
                                    }}
                                    placeholder={
                                        block.type === "heading1" ? "Heading 1" :
                                            block.type === "heading2" ? "Heading 2" :
                                                block.type === "bullet" ? "List item" :
                                                    block.type === "todo" ? "To-do item" :
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

                                {/* Inline formatting toolbar */}
                                <input ref={toolbarAnchorRef} className="pointer-events-none absolute w-0 h-0 opacity-0 overflow-hidden" tabIndex={-1} aria-hidden="true" />
                                <InlineToolbar
                                    anchorRef={toolbarAnchorRef}
                                    visible={!!selection && !slashOpen && !linkPopoverOpen}
                                    selectedText={selection ? blockText.slice(selection.start, selection.end) : ""}
                                    onFormat={(action) => {
                                        if (action === "link") {
                                            linkPopoverOpenRef.current = true;
                                            setLinkPopoverOpen(true);
                                        } else {
                                            applyFormat(action);
                                        }
                                    }}
                                    onLinkClick={() => {
                                        linkPopoverOpenRef.current = true;
                                        setLinkPopoverOpen(true);
                                    }}
                                    onToolbarInteraction={() => { }}
                                />
                                <LinkPopover
                                    open={linkPopoverOpen}
                                    onOpenChange={(open) => {
                                        linkPopoverOpenRef.current = open;
                                        setLinkPopoverOpen(open);
                                        if (!open) {
                                            setTimeout(() => taRef.current?.focus(), 10);
                                        }
                                    }}
                                    anchor={taRef.current}
                                    selectedText={selection ? blockText.slice(selection.start, selection.end) : ""}
                                    onConfirm={(url) => {
                                        applyFormat("link", url);
                                        linkPopoverOpenRef.current = false;
                                        setLinkPopoverOpen(false);
                                    }}
                                />
                            </>
                        ) : (
                            /* Rendered view — click to edit */
                            <div
                                onClick={() => setEditing(true)}
                                className={cn(
                                    "cursor-text min-h-[1.5rem] leading-relaxed whitespace-pre-wrap",
                                    block.type === "heading1" && "text-2xl font-bold py-1",
                                    block.type === "heading2" && "text-xl font-semibold py-0.5",
                                    (block.type === "text" || block.type === "bullet" || block.type === "number") && "text-sm",
                                    block.type === "todo" && cn("text-sm", block.checked && "line-through text-muted-foreground"),
                                    !blockText && "text-muted-foreground/40"
                                )}
                            >
                                {blockText ? (
                                    <TextWithLinks text={blockText} />
                                ) : (
                                    <span className="select-none">
                                        {block.type === "heading1" ? "Heading 1" :
                                            block.type === "heading2" ? "Heading 2" :
                                                block.type === "bullet" ? "List item" :
                                                    block.type === "todo" ? "To-do item" :
                                                        "Type '/' for blocks..."}
                                    </span>
                                )}
                            </div>
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

export function RepertoireEditor({ blocks: rawBlocks, onChange }: RepertoireEditorProps) {
    const blocks = rawBlocks || [];
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

            {blocks.length > 0 && (
                <div
                    className="min-h-[3rem] cursor-text"
                    onClick={() => {
                        const last = blocks[blocks.length - 1];
                        if (last.text === "" && last.type === "text") {
                            setFocusId(last.id);
                        } else {
                            insertBlock(last.id, "text");
                        }
                    }}
                />
            )}
        </div>
    );
}

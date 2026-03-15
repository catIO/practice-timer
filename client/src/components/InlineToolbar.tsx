import { useLayoutEffect, useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { BlockType } from "@/lib/practicePlan";

type FormatAction = "bold" | "italic" | "link";

const BLOCK_TYPE_OPTIONS: { type: BlockType; label: string; icon: string }[] = [
  { type: "heading1", label: "Heading 1", icon: "title" },
  { type: "heading2", label: "Heading 2", icon: "title" },
  { type: "heading3", label: "Heading 3", icon: "title" },
  { type: "bullet", label: "Bulleted list", icon: "format_list_bulleted" },
  { type: "number", label: "Numbered list", icon: "format_list_numbered" },
  { type: "todo", label: "To-do list", icon: "check_box_outline_blank" },
  { type: "divider", label: "Divider", icon: "horizontal_rule" },
  { type: "text", label: "Plain text", icon: "subject" },
];

export interface InlineToolbarProps {
  anchorRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  visible: boolean;
  selectedText: string;
  currentBlockType?: BlockType;
  onFormat: (action: FormatAction, selectedText?: string) => void;
  onLinkClick: () => void;
  onConvertType?: (type: BlockType) => void;
  turnIntoOpen?: boolean;
  onTurnIntoOpenChange?: (open: boolean) => void;
  /** Called when user interacts with toolbar - cancels pending blur/save */
  onToolbarInteraction?: () => void;
}

const TOOLBAR_OFFSET = 8;

export function InlineToolbar({
  anchorRef,
  visible,
  selectedText,
  currentBlockType = "text",
  onFormat,
  onLinkClick,
  onConvertType,
  turnIntoOpen = false,
  onTurnIntoOpenChange,
  onToolbarInteraction,
}: InlineToolbarProps) {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const turnIntoRef = useRef<HTMLDivElement>(null);

  const setTurnIntoOpen = useCallback((val: boolean) => {
    onTurnIntoOpenChange?.(val);
  }, [onTurnIntoOpenChange]);

  const [container, setContainer] = useState<HTMLElement | null>(null);

  // Close "Turn into" list when clicking outside
  useEffect(() => {
    if (!turnIntoOpen) return;
    const handle = (e: MouseEvent) => {
      const el = e.target as Node;
      if (turnIntoRef.current?.contains(el)) return;
      setTurnIntoOpen(false);
    };
    document.addEventListener("mousedown", handle, true);
    return () => document.removeEventListener("mousedown", handle, true);
  }, [turnIntoOpen]);

  useLayoutEffect(() => {
    setContainer(document.getElementById("practice-sheet-content") || document.body);
  }, []);

  useLayoutEffect(() => {
    if (!visible || !anchorRef.current || !container) return;

    // Get anchor rect (viewport relative)
    const rect = anchorRef.current.getBoundingClientRect();

    // If we are inside the sheet content (which has transform), we need to adjust
    // coordinates to be relative to the container IF the container is the offset parent.
    // However, createPortal to a container doesn't automatically make it the offset parent 
    // for fixed positioning unless the container has formatting context AND we used absolute.
    // BUT we used fixed. 
    // If container has transform (e.g. Radix Sheet Content sliding in), fixed children 
    // become relative to that container.

    let top = rect.top - TOOLBAR_OFFSET;
    let left = rect.left + rect.width / 2;

    if (container !== document.body) {
      // Check if container has transform (Radix Sheet Content usually does when open/animating)
      const computedStyle = window.getComputedStyle(container);
      const hasTransform = computedStyle.transform !== 'none';

      if (hasTransform) {
        // If container is the viewport for fixed children, we need to subtract its position
        const containerRect = container.getBoundingClientRect();
        top = top - containerRect.top;
        left = left - containerRect.left;
      }
    }

    setPosition({ top, left });
  }, [visible, anchorRef, selectedText, container]);

  if (!visible || !container) return null;

  return createPortal(
    <div
      data-inline-toolbar
      className={cn(
        "fixed z-[9999] flex max-w-[90vw] items-center gap-0.5 rounded-md border bg-background px-1 py-0.5 shadow-md",
        turnIntoOpen ? "overflow-visible" : "overflow-x-auto"
      )}
      onMouseDown={(e) => {
        e.preventDefault();
        onToolbarInteraction?.();
      }}
      onClick={(e) => e.stopPropagation()}
      style={{
        top: position.top,
        left: position.left,
        transform: "translate(-50%, -100%)",
        pointerEvents: "auto",
      }}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        title="Bold"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onFormat("bold")}
      >
        <span className="material-icons text-base font-bold">format_bold</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        title="Italic"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onFormat("italic")}
      >
        <span className="material-icons text-base italic">format_italic</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        title="Link"
        onMouseDown={(e) => {
          e.preventDefault();
          onToolbarInteraction?.();
          onLinkClick();
        }}
        onClick={() => {}}
      >
        <span className="material-icons text-base">link</span>
      </Button>
      {onConvertType && (
        <>
          <div className="mx-0.5 h-5 w-px bg-border" aria-hidden />
          <div className="relative shrink-0" ref={turnIntoRef}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2 text-xs"
            title="Turn into"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToolbarInteraction?.();
              setTurnIntoOpen(!turnIntoOpen);
            }}
          >
            <span className="material-icons text-base">transform</span>
            <span>Turn into</span>
            <span className={cn("material-icons text-sm transition-transform", turnIntoOpen && "rotate-180")}>expand_more</span>
          </Button>
          {turnIntoOpen && (
            <div
              className="absolute left-0 top-full z-[10000] mt-1 min-w-[180px] rounded-md border bg-popover py-1 shadow-md"
              onMouseDown={(e) => e.preventDefault()}
            >
              <p className="px-2 py-1 text-xs text-muted-foreground">Turn into</p>
              {BLOCK_TYPE_OPTIONS.map(({ type, label, icon }) => (
                <button
                  key={type}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onToolbarInteraction?.();
                  }}
                  onClick={() => {
                    onConvertType(type);
                    setTurnIntoOpen(false);
                  }}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                    type === currentBlockType && "bg-accent text-accent-foreground"
                  )}
                >
                  <span className="material-icons w-6 text-center text-lg text-muted-foreground">{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        </>
      )}
    </div>,
    document.body
  );
}

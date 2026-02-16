import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface LinkPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchor: HTMLElement | null;
  selectedText: string;
  /** Pre-filled URL when editing existing link */
  initialUrl?: string;
  onConfirm: (url: string) => void;
  onRemove?: () => void;
  onCancel?: () => void;
}

export function LinkPopover({
  open,
  onOpenChange,
  anchor,
  selectedText,
  initialUrl = "",
  onConfirm,
  onRemove,
  onCancel,
}: LinkPopoverProps) {
  const [url, setUrl] = useState(initialUrl);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, transform: "translate(-50%, -100%)" });
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [isPositioned, setIsPositioned] = useState(false);

  useEffect(() => {
    // We used to look for specific containers, but document.body is safer for fixed positioning validity.
    setContainer(document.body);
  }, []);

  useEffect(() => {
    setUrl(initialUrl);
  }, [open, initialUrl]);

  useEffect(() => {
    if (open && initialUrl) setUrl(initialUrl);
  }, [open, initialUrl]);

  useLayoutEffect(() => {
    if (!open) {
      setIsPositioned(false);
      return;
    }
    if (!anchor || !container) return;
    const rect = anchor.getBoundingClientRect();

    // Safety check: if anchor is hidden or unmounted (or waiting for layout), rect might be zero.
    // If we position based on zero, we get 0,0 placement.
    if (rect.width === 0 && rect.height === 0) return;

    const gap = 4;

    // Position logic
    const TOOLBAR_OFFSET = 8;
    const POPOVER_HEIGHT_ESTIMATE = 120; // Title, input, buttons...
    const viewportTop = 0;

    const spaceAbove = rect.top - viewportTop;
    const placeAbove = spaceAbove > POPOVER_HEIGHT_ESTIMATE;

    let top: number;
    let transformOrigin: string;

    if (placeAbove) {
      top = rect.top - TOOLBAR_OFFSET;
      transformOrigin = "translate(-50%, -100%)";
    } else {
      top = rect.bottom + TOOLBAR_OFFSET;
      transformOrigin = "translate(-50%, 0)";
    }

    let left = rect.left + rect.width / 2;

    // Since we are portal-ing to document.body, and position is fixed,
    // we don't need to subtract container offsets unless document.body has a transform (unlikely).
    // The previous logic for `container` handles specific relative containers. 
    // If container IS document.body, we just use viewport coordinates (rect).

    if (container !== document.body) {
      // Legacy check just in case we revert to a specific container later, 
      // but currently we force document.body.
      const computedStyle = window.getComputedStyle(container);
      const hasTransform = computedStyle.transform !== 'none';
      if (hasTransform) {
        const containerRect = container.getBoundingClientRect();
        top = top - containerRect.top;
        left = left - containerRect.left;
      }
    }

    setPosition({ top, left, transform: transformOrigin });
    setIsPositioned(true);
  }, [open, anchor, container]);

  useEffect(() => {
    if (open) {
      if (isPositioned) {
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    }
  }, [open, isPositioned]);

  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      // If click is outside the popover, close it.
      // We need a ref to the popover content.
      // Actually we have the portal content.
      // Let's rely on the `wrapperRef` we'll add to the div.
      // Use composedPath for more robust check (handles shadow DOM, removed nodes, etc.)
      const path = e.composedPath();
      if (wrapperRef.current && !path.includes(wrapperRef.current)) {
        onOpenChange(false);
      }
    };

    if (open) {
      // Use capture to handle events before others if needed, or bubble.
      // A small timeout avoids handling the click that opened it if it bubbled up?
      // But `open` changes usually on a click. 
      // Radix usually uses pointerdown.
      requestAnimationFrame(() => {
        document.addEventListener("mousedown", handleDocumentClick);
      });
    }

    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
    };
  }, [open, onOpenChange]);

  if (!open || !container) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (trimmed) {
      onConfirm(trimmed);
    }
  };

  const stopPropagation = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  return createPortal(
    <div
      ref={wrapperRef}
      data-link-modal
      onMouseDown={(e) => {
        // Prevent click-outside logic from triggering when interacting with the popover
        e.stopPropagation();
      }}
      className="fixed z-[10001] w-72 rounded-md border bg-popover p-3 shadow-lg transition-opacity duration-75"
      style={{
        top: position.top,
        left: position.left,
        transform: position.transform,
        pointerEvents: "auto",
        opacity: isPositioned ? 1 : 0
      }}

      onClick={(e) => e.stopPropagation()}
      onKeyDown={stopPropagation}
      onKeyUp={stopPropagation}
      onKeyPress={stopPropagation}
      onPaste={stopPropagation}
      onInput={stopPropagation}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            type="url"
            placeholder="Paste link..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1 h-9 text-sm"
          />
        </div>
        {selectedText && (
          <p className="text-xs text-muted-foreground truncate">
            Text: <span className="font-medium text-foreground">{selectedText}</span>
          </p>
        )}
        {initialUrl && onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 justify-start px-2 text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={() => {
              onRemove();
              onOpenChange(false);
            }}
          >
            <span className="material-icons text-sm mr-2">delete</span>
            Remove link
          </Button>
        )}
      </form>
    </div>,
    document.body
  );
}

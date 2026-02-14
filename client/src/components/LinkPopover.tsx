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
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    setContainer(document.getElementById("practice-sheet-content") || document.body);
  }, []);

  useEffect(() => {
    setUrl(initialUrl);
  }, [open, initialUrl]);

  useEffect(() => {
    if (open && initialUrl) setUrl(initialUrl);
  }, [open, initialUrl]);

  useLayoutEffect(() => {
    if (!open || !anchor || !container) return;
    const rect = anchor.getBoundingClientRect();
    const gap = 4;

    // Position just below the anchor element
    let top = rect.bottom + gap;
    let left = rect.left + rect.width / 2;

    if (container !== document.body) {
      const computedStyle = window.getComputedStyle(container);
      const hasTransform = computedStyle.transform !== 'none';
      if (hasTransform) {
        const containerRect = container.getBoundingClientRect();
        top = top - containerRect.top;
        left = left - containerRect.left;
      }
    }

    setPosition({ top, left });
  }, [open, anchor, container]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      // If click is outside the popover, close it.
      // We need a ref to the popover content.
      // Actually we have the portal content.
      // Let's rely on the `wrapperRef` we'll add to the div.
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
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
      onOpenChange(false);
    }
  };

  const stopPropagation = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  return createPortal(
    <div
      ref={wrapperRef}
      data-link-modal
      className="fixed z-[10001] w-72 rounded-md border bg-popover p-3 shadow-lg"
      style={{
        top: position.top,
        left: position.left,
        transform: "translate(-50%, 0)",
        pointerEvents: "auto"
      }}
      onMouseDown={(e) => {
        // Prevent default mousedown to avoid losing focus if clicking background of popover, 
        // BUT allow interaction with inputs.
        // Actually, for a popover with input, we DO want focus to move to input.
        // So we shouldn't preventDefault blindly.
        e.stopPropagation();
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
    container
  );
}

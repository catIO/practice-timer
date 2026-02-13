import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface LinkPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  selectedText: string;
  /** Pre-filled URL when editing existing link */
  initialUrl?: string;
  onConfirm: (url: string) => void;
  onCancel?: () => void;
}

export function LinkPopover({
  open,
  onOpenChange,
  anchorRef,
  selectedText,
  initialUrl = "",
  onConfirm,
  onCancel,
}: LinkPopoverProps) {
  const [url, setUrl] = useState(initialUrl);
  const inputRef = useRef<HTMLInputElement>(null);
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
    if (!open || !anchorRef.current || !container) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const gap = 4;

    // Position just below toolbar (Notion-style: close to selection)
    // Actually anchorRef passed is usually the contentRef (row). 
    // We want it near the selection if possible, or just below the row.
    // For now, centering on the row is acceptable or we could try to use window.getSelection range.

    let top = rect.top + rect.height + gap; // Default below (or above if space?)
    // Provide a better guess? The previous code used `rect.top - 8` (toolbar bottom).
    // But `anchorRef` in PracticePlanPane is `contentRef` (the div).
    // Let's stick to the previous logic but adjust for container offset like InlineToolbar.

    // Previous logic: top = rect.top - 8. 
    // Wait, rect.top would be the top of the row. rect.top - 8 is ABOVE the row?
    // If it's a popover for a Link, usually it's below the link or selection.

    // Let's place it slightly below the row for now to avoid covering text.
    top = rect.bottom + gap;
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
  }, [open, anchorRef, container]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

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
      onKeyDown={stopPropagation}
      onKeyUp={stopPropagation}
      onKeyPress={stopPropagation}
      onPaste={stopPropagation}
      onInput={stopPropagation}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            type="url"
            placeholder="Paste link..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1 h-9 text-sm"
          />
          <Button type="submit" size="sm" disabled={!url.trim()} className="h-9 px-3 shrink-0">
            Link
          </Button>
        </div>
        {selectedText && (
          <p className="text-xs text-muted-foreground truncate">
            Text: <span className="font-medium text-foreground">{selectedText}</span>
          </p>
        )}
      </form>
    </div>,
    container
  );
}

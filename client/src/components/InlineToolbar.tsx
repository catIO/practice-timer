import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";

type FormatAction = "bold" | "italic" | "link";

interface InlineToolbarProps {
  anchorRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  visible: boolean;
  selectedText: string;
  onFormat: (action: FormatAction, selectedText?: string) => void;
  onLinkClick: () => void;
  /** Called when user interacts with toolbar - cancels pending blur/save */
  onToolbarInteraction?: () => void;
}

const TOOLBAR_OFFSET = 8;

export function InlineToolbar({
  anchorRef,
  visible,
  selectedText,
  onFormat,
  onLinkClick,
  onToolbarInteraction,
}: InlineToolbarProps) {
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const [container, setContainer] = useState<HTMLElement | null>(null);

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
      className="fixed z-[9999] flex items-center gap-0.5 rounded-md border bg-background px-1 py-0.5 shadow-md"
      onMouseDown={(e) => {
        e.preventDefault();
        onToolbarInteraction?.();
      }}
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
    </div>,
    document.body
  );
}

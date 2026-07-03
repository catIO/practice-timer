import { useState, useCallback, useRef } from "react";
import { SelectionRange } from "../lib/richText";

export function useTextSelection() {
  const [selection, setSelection] = useState<SelectionRange | null>(null);
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const linkPopoverOpenRef = useRef(false);

  const handleSelect = useCallback((e: React.SyntheticEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const el = e.currentTarget;
    const { selectionStart, selectionEnd } = el;
    if (selectionStart !== null && selectionEnd !== null && selectionStart !== selectionEnd) {
      setSelection({ start: selectionStart, end: selectionEnd });
    } else {
      setSelection(null);
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelection(null);
  }, []);

  return {
    selection,
    setSelection,
    clearSelection,
    linkPopoverOpen,
    setLinkPopoverOpen,
    linkPopoverOpenRef,
    handleSelect,
  };
}

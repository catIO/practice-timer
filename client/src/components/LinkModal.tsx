import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedText: string;
  onConfirm: (url: string) => void;
}

export function LinkModal({ open, onOpenChange, selectedText, onConfirm }: LinkModalProps) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (open) setUrl("");
  }, [open]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-sm p-4 gap-3 top-[20%]"
        data-link-modal
        onKeyDown={stopPropagation}
        onKeyUp={stopPropagation}
        onKeyPress={stopPropagation}
        onPaste={stopPropagation}
        onInput={stopPropagation}
      >
        <DialogTitle className="sr-only">Add link</DialogTitle>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Input
              id="link-url"
              type="url"
              placeholder="Paste link..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoFocus
              className="flex-1 h-9"
            />
            <Button type="submit" size="sm" disabled={!url.trim()} className="h-9 px-3">
              Link
            </Button>
          </div>
          {selectedText && (
            <div className="text-xs text-muted-foreground truncate px-1">
              Text: <span className="font-medium text-foreground">{selectedText}</span>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}

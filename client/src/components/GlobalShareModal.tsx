import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useShareModal } from "@/contexts/ShareContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function GlobalShareModal() {
  const { toast } = useToast();
  const {
    shareDialogOpen,
    setShareDialogOpen,
    shareUrl,
    permalinkId,
    lastPublishedDate,
    isPublishing,
    isSharing,
    handlePublishUpdate,
    handleCreateVersion,
    handleCopyLink,
    formatLastPublishedDate,
  } = useShareModal();

  return (
    <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
      <DialogContent className="sm:max-w-md bg-slate-900 border-white/10 text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <span className="material-icons text-primary text-xl">share</span>
            Share Practice Report
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Publish a live web report of your practice plan, lesson plan, 7-day practice log, and linked repertoire.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Permanent Link Section */}
          <div className="space-y-3 p-3 rounded-xl bg-muted/20 border border-white/5">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <span className="material-icons text-base text-primary">link</span>
                Permanent Link
              </h4>
              <span className="text-[10px] uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded font-bold">
                Auto-updating
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="grid flex-1 gap-2">
                <Input
                  id="global-permalink"
                  value={permalinkId ? `${window.location.origin}/r/${permalinkId}` : "Not published yet"}
                  readOnly
                  className="w-full h-9 bg-muted/50 text-xs font-mono"
                />
              </div>
              {permalinkId && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-9 w-9 p-0"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/r/${permalinkId}`);
                      toast({ title: "Copied!", duration: 1000 });
                    }}
                    title="Copy permalink"
                  >
                    <span className="material-icons text-base">content_copy</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-9 w-9 p-0"
                    onClick={() => window.open(`${window.location.origin}/r/${permalinkId}`, "_blank")}
                    title="Open link"
                  >
                    <span className="material-icons text-base">open_in_new</span>
                  </Button>
                </>
              )}
            </div>
            {lastPublishedDate && permalinkId && (
              <p className="text-[11px] text-muted-foreground italic pl-1 flex items-center gap-1.5">
                <span className="material-icons text-xs text-primary">schedule</span>
                <span>Last published: {formatLastPublishedDate(lastPublishedDate)}</span>
              </p>
            )}
            <Button
              className="w-full gap-2 h-9"
              onClick={handlePublishUpdate}
              disabled={isPublishing}
            >
              <span className={cn("material-icons text-sm", isPublishing && "animate-spin")}>
                {isPublishing ? "sync" : "cloud_upload"}
              </span>
              {permalinkId ? "Publish Update" : "Create Permalink"}
            </Button>
          </div>

          <div className="relative h-px bg-border">
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900 px-2 text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
              or
            </span>
          </div>

          {/* Snapshot Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground">Snapshot version</h4>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                Static backup
              </span>
            </div>
            <Button
              variant="outline"
              className="w-full gap-2 h-9 border-dashed border-white/20 hover:bg-white/5"
              onClick={handleCreateVersion}
              disabled={isSharing}
            >
              <span className={cn("material-icons text-sm", isSharing && "animate-spin")}>
                {isSharing ? "sync" : "history"}
              </span>
              Create Snapshot Version
            </Button>
            {shareUrl && !shareUrl.includes(permalinkId || "___") && (
              <div className="flex items-center space-x-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <Input
                  value={shareUrl}
                  readOnly
                  className="flex-1 h-8 bg-muted/30 text-[11px] font-mono"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={handleCopyLink}
                >
                  <span className="material-icons text-sm">content_copy</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

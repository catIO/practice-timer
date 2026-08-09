import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { useQuery } from "@tanstack/react-query";
import { repertoireService } from "@/lib/repertoireService";
import { useToast } from "@/hooks/use-toast";
import {
  createGlobalReportSnapshot,
  shareReport,
  getGlobalPermalinkId,
  saveGlobalPermalinkId,
  getGlobalLastPublishedDate,
  saveGlobalLastPublishedDate,
  getShortShareUrl,
} from "@/lib/reportShare";

interface ShareContextType {
  shareDialogOpen: boolean;
  setShareDialogOpen: (open: boolean) => void;
  openShareModal: () => void;
  closeShareModal: () => void;
  shareUrl: string;
  permalinkId: string | null;
  lastPublishedDate: string | null;
  isPublishing: boolean;
  isSharing: boolean;
  handlePublishUpdate: () => Promise<void>;
  handleCreateVersion: () => Promise<void>;
  handleCopyLink: () => void;
  formatLastPublishedDate: (isoStr: string | null) => string;
}

const ShareContext = createContext<ShareContextType | undefined>(undefined);

export function ShareProvider({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, user } = useAuth();
  const { toast } = useToast();

  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const [permalinkId, setPermalinkId] = useState<string | null>(() => getGlobalPermalinkId());
  const [lastPublishedDate, setLastPublishedDate] = useState<string | null>(() => getGlobalLastPublishedDate());
  const [shareUrl, setShareUrl] = useState<string>(() => {
    const existingId = getGlobalPermalinkId();
    return existingId ? getShortShareUrl(existingId) : "";
  });

  const { data: repertoirePieces = [] } = useQuery({
    queryKey: ["repertoire"],
    queryFn: async () => {
      try {
        return await repertoireService.getAll();
      } catch (e) {
        console.warn("[ShareContext] Failed to fetch repertoire pieces:", e);
        return [];
      }
    },
    enabled: isLoggedIn,
  });

  useEffect(() => {
    const existingId = getGlobalPermalinkId();
    if (existingId) {
      setPermalinkId(existingId);
      setShareUrl(getShortShareUrl(existingId));
    }
    setLastPublishedDate(getGlobalLastPublishedDate());
  }, [shareDialogOpen]);

  const openShareModal = useCallback(() => {
    setShareDialogOpen(true);
  }, []);

  const closeShareModal = useCallback(() => {
    setShareDialogOpen(false);
  }, []);

  const formatLastPublishedDate = useCallback((isoStr: string | null) => {
    if (!isoStr) return "";
    try {
      const d = new Date(isoStr);
      return d.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return isoStr;
    }
  }, []);

  const handlePublishUpdate = useCallback(async () => {
    setIsPublishing(true);
    try {
      const creatorName = user?.user_metadata?.full_name || user?.user_metadata?.name || undefined;
      const snapshot = createGlobalReportSnapshot(repertoirePieces, creatorName);
      const url = await shareReport(snapshot, permalinkId || undefined);

      const nowStr = new Date().toISOString();
      saveGlobalLastPublishedDate(nowStr);
      setLastPublishedDate(nowStr);

      if (!permalinkId) {
        const newId = url.split("/").pop() || "";
        setPermalinkId(newId);
        saveGlobalPermalinkId(newId);
        setShareUrl(url);
      } else {
        setShareUrl(url);
      }

      toast({
        title: "Link Updated",
        description: "Your workspace report has been published to the permalink.",
      });
    } catch (e) {
      toast({
        title: "Error",
        description: "Failed to publish update. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPublishing(false);
    }
  }, [permalinkId, repertoirePieces, user, toast]);

  const handleCreateVersion = useCallback(async () => {
    setIsSharing(true);
    try {
      const creatorName = user?.user_metadata?.full_name || user?.user_metadata?.name || undefined;
      const snapshot = createGlobalReportSnapshot(repertoirePieces, creatorName);
      const url = await shareReport(snapshot);
      setShareUrl(url);
      toast({
        title: "Version Created",
        description: "A new snapshot link has been generated.",
      });
    } catch (e) {
      toast({
        title: "Error",
        description: "Failed to create version. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSharing(false);
    }
  }, [repertoirePieces, user, toast]);

  const handleCopyLink = useCallback(() => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast({
        title: "Copied!",
        description: "Link copied to clipboard.",
        duration: 2000,
      });
    });
  }, [shareUrl, toast]);

  return (
    <ShareContext.Provider
      value={{
        shareDialogOpen,
        setShareDialogOpen,
        openShareModal,
        closeShareModal,
        shareUrl,
        permalinkId,
        lastPublishedDate,
        isPublishing,
        isSharing,
        handlePublishUpdate,
        handleCreateVersion,
        handleCopyLink,
        formatLastPublishedDate,
      }}
    >
      {children}
    </ShareContext.Provider>
  );
}

export function useShareModal() {
  const context = useContext(ShareContext);
  if (!context) {
    throw new Error("useShareModal must be used within a ShareProvider");
  }
  return context;
}

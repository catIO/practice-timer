import { useEffect, useMemo, useState } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import { decodeReportToken, type ReportSnapshot, type ReportSnapshotItem, type ReportLogSummary } from "@/lib/reportShare";
import { Button } from "@/components/ui/button";
import { TextWithLinks } from "@/components/TextWithLinks";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/** Strip markdown link syntax [text](url) → text. Also strips **bold** and *italic* markers. */
function stripMarkdown(text: string): string {
  return text
    // Replace [label](url) with label
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Replace plain URLs that remain (just show as-is, no change needed)
    // Strip **bold**
    .replace(/\*\*(.+?)\*\*/g, "$1")
    // Strip *italic*
    .replace(/\*(.+?)\*/g, "$1");
}

/** Decode token during render so the first paint has snapshot data (RichLink metadata queries mount immediately). */
function useTokenSnapshot(token: string | null): ReportSnapshot | null {
  return useMemo(() => {
    if (!token) return null;
    return decodeReportToken(token);
  }, [token]);
}

function ReportItem({
  item,
  depth = 0,
  numberIndex = 0,
  logSummary,
  embeddedPieces,
  sharedId,
  sharedToken,
}: {
  item: ReportSnapshotItem;
  depth?: number;
  numberIndex?: number;
  logSummary?: ReportLogSummary;
  embeddedPieces?: Record<string, any>;
  sharedId?: string;
  sharedToken?: string | null;
}) {
  const isDivider = item.blockType === "divider" || (item.text === "---" && !item.blockType);
  const isHeader =
    item.blockType === "heading1" ||
    item.blockType === "heading2" ||
    item.blockType === "heading3";
  const isTodo = item.blockType === "todo";
  const isSegment = item.blockType === "segment";

  const paddingLeft = depth * 16;

  if (isDivider) {
    return (
      <div className="py-4" style={{ paddingLeft: depth ? `${paddingLeft}px` : undefined }}>
        <div className="h-px bg-muted-foreground/30 w-full" />
      </div>
    );
  }

  if (isHeader) {
    const Tag =
      item.blockType === "heading1"
        ? "h2"
        : item.blockType === "heading2"
          ? "h3"
          : "h4";
    const headingSizeClass =
      item.blockType === "heading1"
        ? "text-xl sm:text-2xl font-semibold tracking-tight"
        : item.blockType === "heading2"
          ? "text-lg sm:text-xl font-semibold"
          : "text-base sm:text-lg font-semibold";
    return (
      <>
        <Tag
          className={`text-foreground mt-4 first:mt-0 ${headingSizeClass}`}
          style={{ paddingLeft: depth ? `${paddingLeft}px` : undefined }}
        >
          <TextWithLinks text={item.text || "\u00A0"} />
        </Tag>
        {item.children.map((child, i, arr) => {
          const childNumberIndex = arr.slice(0, i).filter((c) => c.blockType === "number").length;
          return (
            <ReportItem
              key={i}
              item={child}
              depth={depth + 1}
              numberIndex={childNumberIndex}
              logSummary={logSummary}
              embeddedPieces={embeddedPieces}
              sharedId={sharedId}
              sharedToken={sharedToken}
            />
          );
        })}
      </>
    );
  }

  if (isSegment) {
    const title = item.text ? stripMarkdown(item.text) : "";
    // Match by itemId first (reliable), then fall back to name match
    const practicedEntry = logSummary?.pieces.find(
      (p) => (item.id && p.itemId === item.id) ||
             stripMarkdown(p.itemName) === title ||
             p.itemName === item.text
    );
    const practicedSeconds = practicedEntry?.seconds ?? 0;

    const linkedPiece = item.repertoirePieceId && embeddedPieces
      ? embeddedPieces[item.repertoirePieceId]
      : null;

    const linkUrl = item.repertoirePieceId
      ? (sharedId
          ? `/r/${sharedId}/piece/${item.repertoirePieceId}`
          : (sharedToken
              ? `/report/${sharedToken}/piece/${item.repertoirePieceId}`
              : `/report/piece/${item.repertoirePieceId}${window.location.hash}`))
      : "";

    return (
      <div className="py-1" style={{ paddingLeft: depth ? `${paddingLeft}px` : undefined }}>
        <div className="rounded-lg border border-muted/40 bg-muted/10 px-3 py-2 space-y-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={cn(
                  "material-icons text-sm shrink-0 select-none",
                  item.checked ? "text-green-500" : "text-primary"
                )}
              >
                {item.checked ? "task_alt" : "timer"}
              </span>
              <span
                style={{ fontWeight: 600, fontSize: "0.875rem" }}
                className={cn("truncate flex items-center gap-2", item.checked ? "text-muted-foreground" : "text-foreground")}
              >
                {item.text ? (
                  <TextWithLinks text={item.text} />
                ) : (
                  <span className="text-muted-foreground italic font-normal">Untitled segment</span>
                )}
                {linkedPiece && (
                  <Link
                    to={linkUrl}
                    className="inline-flex items-center gap-0.5 text-xs text-primary bg-primary/10 border border-primary/25 px-1.5 py-0.5 rounded-full font-medium ml-1 shrink-0 transition-colors hover:bg-primary/20"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="material-icons text-[10px] shrink-0 select-none">music_note</span>
                    <span className="max-w-[120px] truncate">{linkedPiece.title}</span>
                  </Link>
                )}
              </span>
            </div>
            <div className="flex items-center gap-1.5 sm:ml-auto shrink-0 select-none pl-7 sm:pl-0">
              {item.allocatedTime != null && (
                <span className="inline-flex items-center bg-muted/60 border border-muted-foreground/15 text-muted-foreground px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono tracking-tight">
                  Goal: {item.allocatedTime}m/{item.allocationPeriod === "week" ? "wk" : "day"}
                </span>
              )}
              {practicedSeconds > 0 && (
                <span className="inline-flex items-center bg-primary/10 border border-primary/25 text-primary px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono tracking-tight">
                  Total: {formatDuration(practicedSeconds)}
                </span>
              )}
            </div>
          </div>
          {item.segmentGoal && (
            <p className="text-xs text-muted-foreground pl-7 leading-relaxed whitespace-pre-wrap">{item.segmentGoal}</p>
          )}
        </div>
        {item.children.length > 0 && (
          <div className="pl-4 border-l border-border/50 mt-0.5 ml-2 space-y-0.5">
            {item.children.map((child, i, arr) => {
              const childNumberIndex = arr.slice(0, i).filter((c) => c.blockType === "number").length;
              return (
                <ReportItem
                  key={i}
                  item={child}
                  depth={depth + 1}
                  numberIndex={childNumberIndex}
                  logSummary={logSummary}
                  embeddedPieces={embeddedPieces}
                  sharedId={sharedId}
                  sharedToken={sharedToken}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="py-0.5" style={{ paddingLeft: depth ? `${paddingLeft}px` : undefined }}>
      <div className="flex items-start gap-2 text-foreground">
        {item.blockType === "todo" ? (
          <Checkbox checked={item.checked} disabled className="mt-1 shrink-0" />
        ) : item.blockType === "bullet" ? (
          <span className="shrink-0 mt-0.5 text-muted-foreground" aria-hidden>
            •
          </span>
        ) : item.blockType === "number" ? (
          <span className="shrink-0 mt-0.5 min-w-[1.2rem] text-right text-sm text-muted-foreground tabular-nums select-none" aria-hidden>
            {numberIndex + 1}.
          </span>
        ) : null}
        <span>
          <TextWithLinks text={item.text || "\u00A0"} richLinkVariant="report" />
        </span>
      </div>
      {item.children.length > 0 && (
        <div className="pl-4 border-l border-border/50 mt-0.5 ml-2 space-y-0.5">
          {item.children.map((child, i, arr) => {
            const childNumberIndex = arr.slice(0, i).filter((c) => c.blockType === "number").length;
            return (
              <ReportItem
                key={i}
                item={child}
                depth={depth + 1}
                numberIndex={childNumberIndex}
                logSummary={logSummary}
                embeddedPieces={embeddedPieces}
                sharedId={sharedId}
                sharedToken={sharedToken}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}


export default function Report() {
  const { token: pathToken, id } = useParams<{ token?: string; id?: string }>();
  const location = useLocation();
  // Token from path (/report/:token) or from hash (/report#token - used in dev to avoid long URLs)
  const token = pathToken ?? (location.pathname === "/report" && location.hash ? location.hash.slice(1) : null);
  const tokenSnapshot = useTokenSnapshot(id ? null : token);
  const [idSnapshot, setIdSnapshot] = useState<ReportSnapshot | null>(null);
  const [idLoading, setIdLoading] = useState(!!id);
  const [idError, setIdError] = useState(false);

  const snapshot = id ? idSnapshot : tokenSnapshot;
  const loading = id ? idLoading : false;
  const tokenInvalid = Boolean(token && !id && !tokenSnapshot);
  const error = id ? idError : tokenInvalid;

  // Handle short ID (server-side fetch)
  useEffect(() => {
    if (!id) {
      setIdSnapshot(null);
      setIdError(false);
      setIdLoading(false);
      return;
    }
    // In dev, Netlify Functions aren't available — skip the fetch
    if (import.meta.env.DEV) {
      setIdError(true);
      setIdLoading(false);
      return;
    }
    setIdLoading(true);
    setIdError(false);
    fetch(`/.netlify/functions/share-report?id=${encodeURIComponent(id)}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        setIdSnapshot(data);
      })
      .catch(() => {
        setIdError(true);
      })
      .finally(() => {
        setIdLoading(false);
      });
  }, [id]);

  useEffect(() => {
    if (snapshot?.title) {
      document.title = snapshot.title;
    }
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "robots");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", "noindex, nofollow");
    return () => {
      meta?.setAttribute("content", "");
    };
  }, [snapshot]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-foreground">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
        <p className="text-muted-foreground text-sm">Loading report...</p>
      </div>
    );
  }

  if (!token && !id) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-foreground text-center">
        <h1 className="text-2xl font-bold text-primary mb-2">Practice plan progress</h1>
        <p className="text-muted-foreground text-sm max-w-sm mb-6 leading-relaxed">
          No report to display. Create a shareable link from the Practice plan in the app.
        </p>
        <Button variant="outline" asChild className="border-white/10 rounded-xl">
          <Link to="/">Open Practice Mate</Link>
        </Button>
      </div>
    );
  }

  if (error || !snapshot) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-foreground text-center">
        <h1 className="text-2xl font-bold text-primary mb-2">
          {import.meta.env.DEV && id ? "Not available in dev" : "Invalid or expired link"}
        </h1>
        <p className="text-muted-foreground text-sm max-w-sm mb-6 leading-relaxed">
          {import.meta.env.DEV && id
            ? "Permalink links require the production server. Use the Share dialog to generate a local test link instead."
            : "This report link is invalid or has expired. Ask for a new link."}
        </p>
        <Button variant="outline" asChild className="border-white/10 rounded-xl">
          <Link to="/">Open Practice Mate</Link>
        </Button>
      </div>
    );
  }

  const dateLabel = (() => {
    try {
      const d = new Date(snapshot.date);
      return d.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return snapshot.date;
    }
  })();

  return (
    <div className="space-y-6 text-foreground">
      <header className="border-b border-white/10 pb-4">
        <h1 className="text-2xl font-bold text-foreground">
          {snapshot.title ?? "Practice Plan & Progress Report"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Generated {dateLabel}</p>
      </header>
      {snapshot.logSummary && snapshot.logSummary.totalSeconds > 0 && (
        <div className="py-2 border-b border-white/10 pb-4">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-primary tabular-nums">
              {formatDuration(snapshot.logSummary.totalSeconds)}
            </span>
            <span className="text-sm text-muted-foreground">total in last 7 days</span>
          </div>
        </div>
      )}
      <main className="w-full">
        <div className="space-y-1">
          {snapshot.items.map((item, i, arr) => {
            const numIdx = arr.slice(0, i).filter((c) => c.blockType === "number").length;
            return (
              <ReportItem
                key={i}
                item={item}
                numberIndex={numIdx}
                logSummary={snapshot.logSummary}
                embeddedPieces={snapshot.embeddedPieces}
                sharedId={id}
                sharedToken={token}
              />
            );
          })}
        </div>
      </main>
    </div>
  );
}

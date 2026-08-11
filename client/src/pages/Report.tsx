import { useEffect, useMemo, useState } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import { decodeReportToken, type ReportSnapshot, type ReportSnapshotItem, type ReportLogSummary } from "@/lib/reportShare";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TextWithLinks } from "@/components/TextWithLinks";
import { RichLink } from "@/components/RichLink";
import { supabase } from "@/lib/supabaseClient";
import { sanitizeHref } from "@/lib/urlSafety";
import { useSharedReport } from "@/contexts/SharedReportContext";
import { ScoreUrlTooltip } from "@/components/ScoreUrlTooltip";
import { getSegmentCompletionsLast7Days, getSegmentCompletionsForThisWeek, getThisWeekSummary, getLastWeekSummary, getLast7DaysSummary } from "@/lib/practiceLog";
import { getPracticePlan } from "@/lib/practicePlan";
import { getSettings } from "@/lib/localStorage";
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
  logSummary?: ReportLogSummary | null;
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
          ? "text-lg font-semibold"
          : "text-base font-semibold";
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
    const settings = getSettings();
    const weekStartsOn = settings?.weekStartsOn ?? 'monday';
    const completionsCount = practicedEntry?.completionsCount ?? (item.id ? getSegmentCompletionsForThisWeek(item.id, weekStartsOn) : 0);

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
      <div className="py-2.5 rounded-xl border border-border/50 border-l-2 border-l-primary/60 bg-white/[0.03] dark:bg-white/[0.03] space-y-1.5 transition-colors hover:bg-white/[0.05] px-3.5 mb-2" style={{ paddingLeft: depth ? `${paddingLeft + 14}px` : undefined }}>
        <div className="space-y-1.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="material-icons text-sm shrink-0 select-none text-primary"
              >
                timer
              </span>
              <span className="text-base font-semibold truncate flex items-center gap-2 text-foreground">
                {item.text ? (
                  <TextWithLinks text={item.text} />
                ) : (
                  <span className="text-muted-foreground italic font-normal">Untitled segment</span>
                )}
                {item.allocatedTime != null && (
                  <span className="inline-flex items-center h-[22px] px-2 text-xs font-mono font-medium rounded-full bg-muted/60 border border-muted-foreground/20 text-muted-foreground shrink-0 select-none">
                    Time Box: {item.allocatedTime}m
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-1.5 sm:ml-auto shrink-0 select-none pl-7 sm:pl-0 flex-wrap">
              {completionsCount > 0 && (
                <span className="inline-flex items-center h-[22px] bg-emerald-500/15 border border-emerald-500/35 text-emerald-700 dark:text-emerald-300 px-2 rounded-full text-xs font-semibold font-mono tracking-tight">
                  <span className="material-icons text-[13px] mr-1 shrink-0 select-none" aria-hidden="true">
                    replay
                  </span>
                  {completionsCount} {completionsCount === 1 ? 'time' : 'times'}
                </span>
              )}
              {practicedSeconds > 0 && (
                <span className="inline-flex items-center h-[22px] bg-primary/10 border border-primary/25 text-primary px-2 rounded-full text-xs font-semibold font-mono tracking-tight">
                  {formatDuration(practicedSeconds)}
                </span>
              )}
            </div>
          </div>
          {item.segmentGoal && (
            <p className="text-sm text-muted-foreground pl-7 leading-relaxed whitespace-pre-wrap">
              <TextWithLinks text={item.segmentGoal} richLinkVariant="report" linkVariant="inline" />
            </p>
          )}
          {(linkedPiece || item.videoUrl) && (
            <div className="pl-7 pt-1 flex items-center gap-1.5 flex-wrap">
              {linkedPiece && (
                <>
                  <Link
                    to={linkUrl}
                    title={linkedPiece.title}
                    className="inline-flex items-center gap-1.5 h-6 px-2.5 text-xs font-medium text-primary bg-primary/10 border border-primary/25 rounded-full shrink-0 transition-colors hover:bg-primary/20 select-none"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="material-icons text-[12px] shrink-0 select-none">music_note</span>
                    <span className="max-w-[140px] truncate">{linkedPiece.title}</span>
                  </Link>
                  {linkedPiece.score_url && sanitizeHref(linkedPiece.score_url) && (
                    <ScoreUrlTooltip url={linkedPiece.score_url}>
                      <a
                        href={sanitizeHref(linkedPiece.score_url)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 h-6 px-2.5 text-xs font-medium text-primary bg-primary/10 border border-primary/25 rounded-full shrink-0 transition-colors hover:bg-primary/20 select-none"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="material-icons text-[12px] shrink-0 select-none">description</span>
                        <span>Open Score</span>
                      </a>
                    </ScoreUrlTooltip>
                  )}
                </>
              )}
              {item.videoUrl && <RichLink url={item.videoUrl} eagerPreview />}
            </div>
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
        {item.blockType === "todo" || item.blockType === "bullet" ? (
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

function getReportDays(logSummary?: ReportLogSummary): number {
  if (!logSummary?.startDate || !logSummary?.endDate) return 7;
  try {
    const startMs = new Date(logSummary.startDate + "T00:00:00").getTime();
    const endMs = new Date(logSummary.endDate + "T00:00:00").getTime();
    const diff = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 7;
  } catch {
    return 7;
  }
}


export default function Report() {
  const { setCreatorName } = useSharedReport();
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

    async function loadReport() {
      setIdLoading(true);
      setIdError(false);

      // 1. Try to load from Supabase first (if configured)
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from("shared_reports")
            .select("data")
            .eq("id", id)
            .single();

          if (data && !error) {
            setIdSnapshot(data.data as ReportSnapshot);
            setIdLoading(false);
            return;
          }
        } catch (e) {
          console.warn("[Report] Failed to load from Supabase, trying fallback:", e);
        }
      }

      // In dev, if Supabase failed or wasn't configured, Netlify functions are unavailable - stop here
      if (import.meta.env.DEV) {
        setIdError(true);
        setIdLoading(false);
        return;
      }

      // 2. Fallback to Netlify Blobs (via serverless function)
      try {
        const res = await fetch(`/.netlify/functions/share-report?id=${encodeURIComponent(id!)}`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });

        if (!res.ok) throw new Error("Failed to fetch from Netlify function");

        const data = (await res.json()) as ReportSnapshot;
        setIdSnapshot(data);

        // 3. Asynchronously migrate the legacy report to Supabase for future visits
        if (supabase) {
          supabase
            .from("shared_reports")
            .insert({ id: id!, data })
            .then(
              ({ error }) => {
                if (error) {
                  console.warn("[Report] Auto-migration to Supabase failed:", error);
                } else {
                  console.log("[Report] Auto-migrated legacy report to Supabase successfully.");
                }
              },
              (err: unknown) => {
                console.warn("[Report] Error auto-migrating to Supabase:", err);
              }
            );
        }
      } catch (err) {
        console.warn("[Report] Failed to load report from fallback:", err);
        setIdError(true);
      } finally {
        setIdLoading(false);
      }
    }

    loadReport();
  }, [id]);

  useEffect(() => {
    if (snapshot) {
      const docTitle =
        snapshot.title && snapshot.title !== "Practice & Lesson Plan Report"
          ? snapshot.title
          : "Practice Plan & Progress Report";
      document.title = docTitle;
      setCreatorName(snapshot.creatorName || null);
    }
  }, [snapshot, setCreatorName]);

  const [fetchedPieces, setFetchedPieces] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!snapshot) return;
    const missingIds = new Set<string>();
    const collectPieceIds = (item: any) => {
      if (item.repertoirePieceId && (!snapshot.embeddedPieces || !snapshot.embeddedPieces[item.repertoirePieceId])) {
        missingIds.add(item.repertoirePieceId);
      }
      item.children?.forEach(collectPieceIds);
    };
    snapshot.items?.forEach(collectPieceIds);
    snapshot.lessonPlanItems?.forEach(collectPieceIds);

    if (missingIds.size > 0 && supabase) {
      supabase
        .from("repertoire")
        .select("*")
        .in("id", Array.from(missingIds))
        .then(({ data, error }) => {
          if (data && !error && data.length > 0) {
            const pieceMap: Record<string, any> = {};
            data.forEach((p) => {
              pieceMap[p.id] = p;
            });
            setFetchedPieces((prev) => ({ ...prev, ...pieceMap }));
          }
        });
    }
  }, [snapshot]);

  const effectiveEmbeddedPieces = useMemo(() => {
    return {
      ...(snapshot?.embeddedPieces ?? {}),
      ...fetchedPieces,
    };
  }, [snapshot?.embeddedPieces, fetchedPieces]);

  useEffect(() => {
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "robots");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", "noindex, nofollow");
    return () => {
      meta?.setAttribute("content", "");
      setCreatorName(null);
    };
  }, [snapshot, setCreatorName]);

  const settings = getSettings();
  const weekStartsOn = settings?.weekStartsOn ?? 'monday';

  const activeLogSummary = useMemo(() => {
    if (snapshot?.logSummary) {
      return snapshot.logSummary;
    }
    if (id) {
      return undefined;
    }
    const planItems = getPracticePlan();
    return getThisWeekSummary(planItems, weekStartsOn);
  }, [id, snapshot, weekStartsOn]);

  const lastWeekSummary = useMemo(() => {
    if (snapshot?.lastWeekLogSummary) {
      return snapshot.lastWeekLogSummary;
    }
    if (id || snapshot) {
      return undefined;
    }
    const planItems = getPracticePlan();
    return getLastWeekSummary(planItems, weekStartsOn);
  }, [id, snapshot, weekStartsOn]);

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
      const summary = activeLogSummary ?? snapshot?.logSummary;
      if (summary?.startDate && summary?.endDate) {
        const start = new Date(summary.startDate + 'T12:00:00');
        const end = new Date(summary.endDate + 'T12:00:00');
        const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
        const startStr = start.toLocaleDateString(undefined, opts);
        const endStr = end.toLocaleDateString(undefined, { ...opts, year: "numeric" });
        return `Week ${startStr} – ${endStr}`;
      }
      if (snapshot?.date) {
        const d = new Date(snapshot.date);
        return `Week ${d.toLocaleDateString(undefined, { dateStyle: "medium" })}`;
      }
      return "";
    } catch {
      return snapshot?.date ?? "";
    }
  })();

  const headerTitle =
    snapshot.title && snapshot.title !== "Practice & Lesson Plan Report"
      ? snapshot.title
      : "Practice Plan & Progress Report";

  return (
    <div className="space-y-6 text-foreground">
      <header className="border-b border-white/10 pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            {headerTitle}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground mt-1.5">
            <span>{dateLabel}</span>
            {activeLogSummary && (
              <>
                <span className="text-muted-foreground/40 hidden sm:inline">•</span>
                <span className="inline-flex items-center gap-1.5 text-foreground font-medium">
                  <span className="material-icons text-base text-primary select-none">timer</span>
                  <span className="font-bold text-primary tabular-nums">
                    {formatDuration(activeLogSummary.totalSeconds ?? 0)}
                  </span>
                  <span className="text-muted-foreground">time this week</span>
                </span>
              </>
            )}
            {lastWeekSummary && (
              <>
                <span className="text-muted-foreground/40 hidden sm:inline">•</span>
                <span className="inline-flex items-center gap-1.5 text-foreground font-medium">
                  <span className="material-icons text-base text-muted-foreground select-none">history</span>
                  <span className="font-bold text-muted-foreground tabular-nums">
                    {formatDuration(lastWeekSummary.totalSeconds)}
                  </span>
                  <span className="text-muted-foreground">last week</span>
                </span>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="w-full space-y-8">
        {snapshot.lessonPlanItems && snapshot.lessonPlanItems.length > 0 ? (
          <Tabs defaultValue="practice" className="w-full space-y-0">
            <div className="flex items-center gap-2 mb-0">
              <TabsList className="inline-flex h-11 items-center justify-start rounded-t-2xl rounded-b-none bg-slate-900/90 dark:bg-slate-900/90 border-t border-x border-white/10 border-b-0 p-1.5 gap-1.5 shadow-sm">
                <TabsTrigger
                  value="practice"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 text-muted-foreground hover:text-foreground data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:border data-[state=active]:border-primary/30 data-[state=active]:shadow-xs"
                >
                  <span className="material-icons text-base select-none">assignment</span>
                  Practice Plan
                </TabsTrigger>
                <TabsTrigger
                  value="lesson"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 text-muted-foreground hover:text-foreground data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:border data-[state=active]:border-primary/30 data-[state=active]:shadow-xs"
                >
                  <span className="material-icons text-base select-none">school</span>
                  Lesson Plan
                </TabsTrigger>
              </TabsList>
            </div>
            <div className="relative rounded-b-2xl rounded-tr-2xl border border-border/60 bg-card/40 dark:bg-slate-900/40 p-5 sm:p-7 shadow-sm transition-all">
              <TabsContent value="practice" className="space-y-2 mt-0 focus-visible:outline-none focus-visible:ring-0">
                {snapshot.items && snapshot.items.length > 0 ? (
                  snapshot.items.map((item, i, arr) => {
                    const numIdx = arr.slice(0, i).filter((c) => c.blockType === "number").length;
                    return (
                      <ReportItem
                        key={i}
                        item={item}
                        numberIndex={numIdx}
                        logSummary={activeLogSummary}
                        embeddedPieces={effectiveEmbeddedPieces}
                        sharedId={id}
                        sharedToken={token}
                      />
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground italic py-4">No practice plan items available.</p>
                )}
              </TabsContent>
              <TabsContent value="lesson" className="space-y-2 mt-0 focus-visible:outline-none focus-visible:ring-0">
                {snapshot.lessonPlanItems.map((item, i, arr) => {
                  const numIdx = arr.slice(0, i).filter((c) => c.blockType === "number").length;
                  return (
                    <ReportItem
                      key={i}
                      item={item}
                      numberIndex={numIdx}
                      logSummary={activeLogSummary}
                      embeddedPieces={effectiveEmbeddedPieces}
                      sharedId={id}
                      sharedToken={token}
                    />
                  );
                })}
              </TabsContent>
            </div>
          </Tabs>
        ) : (
          snapshot.items && snapshot.items.length > 0 && (
            <div className="relative rounded-2xl border border-border/60 bg-card/40 dark:bg-slate-900/40 p-5 sm:p-7 shadow-sm space-y-2">
              {snapshot.items.map((item, i, arr) => {
                const numIdx = arr.slice(0, i).filter((c) => c.blockType === "number").length;
                return (
                  <ReportItem
                    key={i}
                    item={item}
                    numberIndex={numIdx}
                    logSummary={snapshot.logSummary}
                    embeddedPieces={effectiveEmbeddedPieces}
                    sharedId={id}
                    sharedToken={token}
                  />
                );
              })}
            </div>
          )
        )}
      </main>
    </div>
  );
}

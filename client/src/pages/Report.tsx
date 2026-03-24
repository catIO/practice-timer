import { useEffect, useMemo, useState } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import { decodeReportToken, type ReportSnapshot, type ReportSnapshotItem } from "@/lib/reportShare";
import { Button } from "@/components/ui/button";
import { TextWithLinks } from "@/components/TextWithLinks";
import { Checkbox } from "@/components/ui/checkbox";

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
}: {
  item: ReportSnapshotItem;
  depth?: number;
  numberIndex?: number;
}) {
  const isDivider = item.blockType === "divider" || (item.text === "---" && !item.blockType);
  const isHeader =
    item.blockType === "heading1" ||
    item.blockType === "heading2" ||
    item.blockType === "heading3";
  const isTodo = item.blockType === "todo";

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
          return <ReportItem key={i} item={child} depth={depth + 1} numberIndex={childNumberIndex} />;
        })}
      </>
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
            return <ReportItem key={i} item={child} depth={depth + 1} numberIndex={childNumberIndex} />;
          })}
        </div>
      )}
    </div>
  );
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
      <div className="min-h-screen bg-background text-foreground p-6 flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
        <p className="text-muted-foreground">Loading report...</p>
      </div>
    );
  }

  if (!token && !id) {
    return (
      <div className="min-h-screen bg-background text-foreground p-6 flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-primary mb-2">Practice plan progress</h1>
        <p className="text-muted-foreground text-center max-w-sm mb-6">
          No report to display. Create a shareable link from the Practice plan in the app.
        </p>
        <Button variant="outline" asChild>
          <Link to="/">Open Practice Mate</Link>
        </Button>
      </div>
    );
  }

  if (error || !snapshot) {
    return (
      <div className="min-h-screen bg-background text-foreground p-6 flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-primary mb-2">Invalid or expired link</h1>
        <p className="text-muted-foreground text-center max-w-sm mb-6">
          This report link is invalid or has expired. Ask for a new link.
        </p>
        <Button variant="outline" asChild>
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
    <div className="min-h-screen text-foreground font-sans">
      <div className="max-w-3xl mx-auto pt-8 pb-32 px-4 sm:px-0">
        <div className="rounded-2xl bg-gradient-to-t from-gray-800/40 to-black backdrop-blur-sm shadow-2xl border border-white/10 min-h-[500px]">
          <header className="border-b border-border/40 px-6 py-6 bg-background/20 backdrop-blur-md rounded-t-2xl">
            <h1 className="text-2xl font-bold text-foreground">
              {snapshot.title ?? "Practice plan progress"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Generated {dateLabel}</p>
          </header>
          <main className="p-8 w-full">
            <div className="space-y-1">
              {snapshot.items.map((item, i, arr) => {
                const numIdx = arr.slice(0, i).filter((c) => c.blockType === "number").length;
                return <ReportItem key={i} item={item} numberIndex={numIdx} />;
              })}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

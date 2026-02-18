import { useEffect, useMemo, useState } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import { decodeReportToken, type ReportSnapshot, type ReportSnapshotItem } from "@/lib/reportShare";
import { Button } from "@/components/ui/button";
import { TextWithLinks } from "@/components/TextWithLinks";

function ReportItem({
  item,
  depth = 0,
}: {
  item: ReportSnapshotItem;
  depth?: number;
}) {
  const isHeader =
    item.blockType === "heading1" ||
    item.blockType === "heading2" ||
    item.blockType === "heading3";
  const isTodo = item.blockType === "todo";

  const paddingLeft = depth * 16;

  if (isHeader) {
    const Tag =
      item.blockType === "heading1"
        ? "h2"
        : item.blockType === "heading2"
          ? "h3"
          : "h4";
    return (
      <>
        <Tag
          className="font-semibold text-foreground mt-4 first:mt-0"
          style={{ paddingLeft: depth ? `${paddingLeft}px` : undefined }}
        >
          <TextWithLinks text={item.text || "\u00A0"} />
        </Tag>
        {item.children.map((child, i) => (
          <ReportItem key={i} item={child} depth={depth + 1} />
        ))}
      </>
    );
  }

  return (
    <div className="py-0.5" style={{ paddingLeft: depth ? `${paddingLeft}px` : undefined }}>
      <div className="flex items-start gap-2 text-foreground">
        {item.text.trim() ? (
          <span className="shrink-0 mt-0.5 text-muted-foreground" aria-hidden>
            {isTodo ? (item.checked ? "✓" : "○") : "•"}
          </span>
        ) : null}
        <span
          className={isTodo && item.checked ? "text-muted-foreground" : undefined}
        >
          <TextWithLinks text={item.text || "\u00A0"} />
        </span>
      </div>
      {item.children.length > 0 && (
        <div className="pl-4 border-l border-border/50 mt-0.5 ml-2 space-y-0.5">
          {item.children.map((child, i) => (
            <ReportItem key={i} item={child} depth={0} />
          ))}
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
  const [snapshot, setSnapshot] = useState<ReportSnapshot | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState(false);

  // Handle legacy token (client-side decode)
  useEffect(() => {
    if (token) {
      const decoded = decodeReportToken(token);
      if (decoded) {
        setSnapshot(decoded);
      } else {
        setError(true);
      }
      setLoading(false);
    }
  }, [token]);

  // Handle short ID (server-side fetch)
  useEffect(() => {
    if (id) {
      setLoading(true);
      fetch(`/.netlify/functions/share-report?id=${id}`)
        .then(async (res) => {
          if (!res.ok) throw new Error("Failed");
          const data = await res.json();
          setSnapshot(data);
        })
        .catch(() => {
          setError(true);
        })
        .finally(() => {
          setLoading(false);
        });
    }
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

  if (!snapshot) {
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
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/50 px-4 py-4 bg-card/50">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold text-primary">
            {snapshot.title ?? "Practice plan progress"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Generated {dateLabel}</p>
        </div>
      </header>
      <main className="p-6 max-w-3xl mx-auto w-full">
        <div className="space-y-1">
          {snapshot.items.map((item, i) => (
            <ReportItem key={i} item={item} />
          ))}
        </div>
      </main>
    </div>
  );
}

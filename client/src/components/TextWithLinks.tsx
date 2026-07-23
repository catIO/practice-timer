import React, { useState, useRef, useEffect } from "react";
import { RichLink } from "./RichLink";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

/** Matches [text](url), [SHORTCODE] (not followed by '('), or plain https URLs. */
const TOKEN_REGEX = /\[([^\]]+)\]\(([^)]+)\)|\[([A-Za-z0-9_!?-]+)\](?!\()|(https?:\/\/[^\s]+)/g;

export type LinkPart = { type: "mdlink"; text: string; url: string; start: number; end: number };
export type ShortcodePart = { type: "shortcode"; code: string };
export type PlainPart = { type: "plain"; text: string };
export type TextPart = LinkPart | ShortcodePart | PlainPart;

const SHORTCODE_STYLES: Record<string, string> = {
  "NEW": "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  "!": "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  "IMPORTANT": "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  "URGENT": "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  "TODO": "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  "WIP": "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  "DONE": "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  "OK": "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  "FIXED": "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  "HOT": "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
  "REVIEW": "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",

  // Progress level scale [1] - [10] (Red -> Orange -> Yellow -> Lime -> Green)
  "1": "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/40 font-mono",
  "2": "bg-red-500/15 text-red-500 dark:text-red-400 border-red-500/30 font-mono",
  "3": "bg-orange-600/15 text-orange-600 dark:text-orange-400 border-orange-600/30 font-mono",
  "4": "bg-orange-500/15 text-orange-500 dark:text-orange-400 border-orange-500/30 font-mono",
  "5": "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 font-mono",
  "6": "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30 font-mono",
  "7": "bg-lime-500/15 text-lime-600 dark:text-lime-400 border-lime-500/30 font-mono",
  "8": "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-mono",
  "9": "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30 font-mono",
  "10": "bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 font-mono font-extrabold",
};

const DEFAULT_SHORTCODE_STYLE = "bg-secondary text-secondary-foreground border-border";

function ShortcodePill({ code }: { code: string }) {
  const upperCode = code.toUpperCase();
  const style = SHORTCODE_STYLES[upperCode] || DEFAULT_SHORTCODE_STYLE;
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold border rounded-md tracking-wider align-baseline select-none shrink-0 mr-1.5 my-0.5 ${style}`}
    >
      {code}
    </span>
  );
}

/** Renders a segment that may contain **bold** and *italic* */
function renderFormatted(segment: string, keyPrefix: string) {
  const tokens: Array<{ t: "b" | "i" | "p"; s: string }> = [];
  let last = 0;
  let m;
  const combined = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  while ((m = combined.exec(segment)) !== null) {
    if (m.index > last) tokens.push({ t: "p", s: segment.slice(last, m.index) });
    if (m[1] != null) tokens.push({ t: "b", s: m[1] });
    else if (m[2] != null) tokens.push({ t: "i", s: m[2] });
    last = combined.lastIndex;
  }
  if (last < segment.length) tokens.push({ t: "p", s: segment.slice(last) });
  const elements = tokens.map((tok, i) => {
    if (tok.t === "b") return <strong key={`${keyPrefix}-${i}`}>{tok.s}</strong>;
    if (tok.t === "i") return <em key={`${keyPrefix}-${i}`}>{tok.s}</em>;
    return <span key={`${keyPrefix}-${i}`}>{tok.s}</span>;
  });
  return elements.length === 1 && tokens[0].t === "p" ? elements[0] : <>{elements}</>;
}

interface TextWithLinksProps {
  text: string;
  /** When provided, links show edit chip on hover (view mode) */
  onEditLink?: (linkText: string, linkUrl: string, start: number, end: number, anchor: HTMLElement | null) => void;
  onUpdateLink?: (start: number, end: number, newUrl: string) => void;
  onRemoveLink?: (start: number, end: number) => void;
  /** Progress report: fetch link previews aggressively (avoids stale SW / React Query edge cases). */
  richLinkVariant?: "default" | "report";
}


/**
 * Renders text with:
 * - Markdown links [text](url) as clickable links
 * - Shortcode pills [NEW], [!], [TODO], etc.
 * - Plain URLs (http/https) as RichLink cards
 * - **bold** and *italic*
 * - Optional: edit chip on link hover when onEditLink provided
 */
export function TextWithLinks({
  text,
  onEditLink,
  onRemoveLink,
  onUpdateLink,
  richLinkVariant = "default",
}: TextWithLinksProps) {
  const parts: Array<TextPart> = [];
  let lastIndex = 0;
  let match;
  const re = new RegExp(TOKEN_REGEX.source, "g");
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "plain", text: text.slice(lastIndex, match.index) });
    }
    if (match[1] != null && match[2] != null) {
      parts.push({ type: "mdlink", text: match[1], url: match[2], start: match.index, end: re.lastIndex });
    } else if (match[3] != null) {
      parts.push({ type: "shortcode", code: match[3] });
    } else if (match[4] != null) {
      parts.push({ type: "mdlink", text: match[4], url: match[4], start: match.index, end: re.lastIndex });
    }
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push({ type: "plain", text: text.slice(lastIndex) });
  }

  // Only show a plain URL as a RichLink card when it is the sole content in the block.
  // When mixed with surrounding text the card style breaks inline text flow.
  const isUrlOnlyBlock = parts.length === 1 && parts[0].type === "mdlink";

  return (
    <>
      {parts.map((part, i) => {
        if (part.type === "mdlink") {
          return (
            <LinkWithPreview
              key={i}
              part={part}
              onEditLink={onEditLink}
              onUpdateLink={onUpdateLink}
              onRemoveLink={onRemoveLink}
              rich={part.text === part.url && isUrlOnlyBlock}
              eagerRichPreview={richLinkVariant === "report"}
            />
          );
        }
        if (part.type === "shortcode") {
          return <ShortcodePill key={i} code={part.code} />;
        }

        let plainText = part.text;
        if (i > 0 && parts[i - 1].type === "shortcode" && plainText.startsWith(" ")) {
          plainText = plainText.slice(1);
        }

        if (!plainText) return null;

        return <React.Fragment key={i}>{renderFormatted(plainText, `p-${i}`)}</React.Fragment>;
      })}
    </>
  );
}

function LinkWithPreview({
  part,
  onEditLink,
  onUpdateLink,
  onRemoveLink,
  rich,
  eagerRichPreview,
}: {
  part: LinkPart;
  onEditLink?: (linkText: string, linkUrl: string, start: number, end: number, anchor: HTMLElement | null) => void;
  onUpdateLink?: (start: number, end: number, newUrl: string) => void;
  onRemoveLink?: (start: number, end: number) => void;
  rich?: boolean;
  eagerRichPreview?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [editingUrl, setEditingUrl] = useState(false);
  const [tempUrl, setTempUrl] = useState(part.url);
  const linkRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isSavingRef = useRef(false);

  useEffect(() => {
    if (!editingUrl) {
      isSavingRef.current = false;
    }
  }, [editingUrl]);

  const handleUrlSave = () => {
    if (tempUrl !== part.url) {
      onUpdateLink?.(part.start, part.end, tempUrl);
    }
    setEditingUrl(false);
  };


  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(part.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingUrl(true);
    setTempUrl(part.url);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemoveLink?.(part.start, part.end);
  };

  const domain = tryGetDomain(part.url);

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <span ref={linkRef} className="cursor-pointer">
          {rich ? (
            <RichLink url={part.url} eagerPreview={eagerRichPreview} />
          ) : (
            <a
              href={part.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:text-primary/80"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {renderFormatted(part.text, `link-${part.start}`)}
            </a>
          )}
        </span>
      </HoverCardTrigger>
      {onEditLink && (
        <HoverCardContent
          align="start"
          side="bottom"
          sideOffset={5}
          className="w-auto p-1 flex flex-col gap-1 bg-popover/95 backdrop-blur-sm border-border/50 shadow-lg"
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-2 px-2 py-1 max-w-[240px]">
              <span className="material-icons text-xs text-muted-foreground shrink-0">public</span>
              {editingUrl ? (
                <input
                  ref={inputRef}
                  value={tempUrl}
                  onChange={(e) => setTempUrl(e.target.value)}
                  onBlur={() => {
                    if (!isSavingRef.current) {
                      setEditingUrl(false);
                      setTempUrl(part.url);
                    }
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") {
                      e.preventDefault();
                      isSavingRef.current = true;
                      handleUrlSave();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      setEditingUrl(false);
                      setTempUrl(part.url);
                    }
                  }}
                  className="h-5 px-1 text-xs bg-background border rounded w-[180px] focus:outline-none focus:ring-1 focus:ring-ring"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  className="text-xs text-popover-foreground hover:underline truncate cursor-text block max-w-[180px]"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingUrl(true);
                    setTempUrl(part.url);
                  }}
                  title="Click to edit URL"
                >
                  {part.url}
                </span>
              )}
            </div>
            <div className="flex items-center gap-0.5 border-l border-border/50 pl-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-sm text-muted-foreground hover:text-foreground"
                onClick={handleCopy}
                title="Copy URL"
              >
                <span className="material-icons text-[14px]">
                  {copied ? "check" : "content_copy"}
                </span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs font-medium rounded-sm text-muted-foreground hover:text-foreground"
                onClick={handleEdit}
              >
                Edit
              </Button>
            </div>
          </div>
          {onRemoveLink && !rich && (
            <>
              <Separator className="my-0.5" />
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-full justify-start text-xs text-muted-foreground hover:text-foreground hover:bg-muted px-2"
                onClick={handleRemove}
              >
                <span className="material-icons text-[14px] mr-2">delete</span>
                Remove link
              </Button>
            </>
          )}
        </HoverCardContent>
      )}
    </HoverCard>
  );
}

function tryGetDomain(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

import { useState } from "react";
import { RichLink } from "./RichLink";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

/** Matches [text](url) or plain https URLs. Markdown links are tried first. */
const LINK_REGEX = /\[([^\]]+)\]\(([^)]+)\)|(https?:\/\/[^\s]+)/g;

export type LinkPart = { type: "mdlink"; text: string; url: string; start: number; end: number };
export type PlainPart = { type: "plain"; text: string };

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
  return tokens.map((tok, i) => {
    if (tok.t === "b") return <strong key={`${keyPrefix}-${i}`}>{tok.s}</strong>;
    if (tok.t === "i") return <em key={`${keyPrefix}-${i}`}>{tok.s}</em>;
    return <span key={`${keyPrefix}-${i}`}>{tok.s}</span>;
  });
}

interface TextWithLinksProps {
  text: string;
  /** When provided, links show edit chip on hover (view mode) */
  onEditLink?: (linkText: string, linkUrl: string, start: number, end: number) => void;
  onRemoveLink?: (start: number, end: number) => void;
}

/**
 * Renders text with:
 * - Markdown links [text](url) as clickable links
 * - Plain URLs (http/https) as RichLink cards
 * - **bold** and *italic*
 * - Optional: edit chip on link hover when onEditLink provided
 */
export function TextWithLinks({ text, onEditLink, onRemoveLink }: TextWithLinksProps) {
  const parts: Array<LinkPart | PlainPart> = [];
  let lastIndex = 0;
  let match;
  const re = new RegExp(LINK_REGEX.source, "g");
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "plain", text: text.slice(lastIndex, match.index) });
    }
    if (match[1] != null && match[2] != null) {
      parts.push({ type: "mdlink", text: match[1], url: match[2], start: match.index, end: re.lastIndex });
    } else if (match[3] != null) {
      parts.push({ type: "mdlink", text: match[3], url: match[3], start: match.index, end: re.lastIndex });
    }
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push({ type: "plain", text: text.slice(lastIndex) });
  }

  return (
    <>
      {parts.map((part, i) => {
        if (part.type === "mdlink") {
          return (
            <LinkWithPreview
              key={i}
              part={part}
              onEditLink={onEditLink}
              onRemoveLink={onRemoveLink}
              rich={part.text === part.url}
            />
          );
        }
        return <span key={i}>{renderFormatted(part.text, `p-${i}`)}</span>;
      })}
    </>
  );
}

function LinkWithPreview({
  part,
  onEditLink,
  onRemoveLink,
  rich,
}: {
  part: LinkPart;
  onEditLink?: (linkText: string, linkUrl: string, start: number, end: number) => void;
  onRemoveLink?: (start: number, end: number) => void;
  rich?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(part.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEditLink?.(part.text, part.url, part.start, part.end);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemoveLink?.(part.start, part.end);
  };

  const domain = tryGetDomain(part.url);

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <span className="cursor-pointer">
          {rich ? (
            <RichLink url={part.url} />
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
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-2 px-2 py-1 max-w-[240px]">
              <span className="material-icons text-xs text-muted-foreground shrink-0">public</span>
              <a
                href={part.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-popover-foreground hover:underline truncate"
              >
                {part.url}
              </a>
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

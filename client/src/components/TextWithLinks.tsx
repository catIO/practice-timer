import { useState } from "react";
import { RichLink } from "./RichLink";

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
}

/**
 * Renders text with:
 * - Markdown links [text](url) as clickable links
 * - Plain URLs (http/https) as RichLink cards
 * - **bold** and *italic*
 * - Optional: edit chip on link hover when onEditLink provided
 */
export function TextWithLinks({ text, onEditLink }: TextWithLinksProps) {
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
          if (part.text === part.url) {
            return (
              <RichLinkWithEdit
                key={i}
                part={part}
                onEditLink={onEditLink}
              />
            );
          }
          return (
            <LinkWithEdit
              key={i}
              part={part}
              onEditLink={onEditLink}
            />
          );
        }
        return <span key={i}>{renderFormatted(part.text, `p-${i}`)}</span>;
      })}
    </>
  );
}

function RichLinkWithEdit({
  part,
  onEditLink,
}: {
  part: LinkPart;
  onEditLink?: (linkText: string, linkUrl: string, start: number, end: number) => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <span
      className="relative inline group/link"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <RichLink url={part.url} />
      {onEditLink && hover && (
        <button
          type="button"
          className="absolute -top-6 left-0 z-10 rounded border bg-background px-2 py-0.5 text-xs shadow hover:bg-accent"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onEditLink(part.text, part.url, part.start, part.end);
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          Edit link
        </button>
      )}
    </span>
  );
}

function LinkWithEdit({
  part,
  onEditLink,
}: {
  part: LinkPart;
  onEditLink?: (linkText: string, linkUrl: string, start: number, end: number) => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <span
      className="relative inline group/link"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
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
      {onEditLink && hover && (
        <button
          type="button"
          className="absolute -top-6 left-0 z-10 rounded border bg-background px-2 py-0.5 text-xs shadow hover:bg-accent"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onEditLink(part.text, part.url, part.start, part.end);
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          Edit link
        </button>
      )}
    </span>
  );
}

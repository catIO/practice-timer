import { RichLink } from "./RichLink";

/** Matches [text](url) or plain https URLs. Markdown links are tried first. */
const LINK_REGEX = /\[([^\]]+)\]\(([^)]+)\)|(https?:\/\/[^\s]+)/g;

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

/**
 * Renders text with:
 * - Markdown links [text](url) as clickable links
 * - Plain URLs (http/https) as RichLink cards
 * - **bold** and *italic*
 */
export function TextWithLinks({ text }: { text: string }) {
  const parts: Array<{ type: "mdlink"; text: string; url: string } | { type: "plain"; text: string }> = [];
  let lastIndex = 0;
  let match;
  const re = new RegExp(LINK_REGEX.source, "g");
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "plain", text: text.slice(lastIndex, match.index) });
    }
    if (match[1] != null && match[2] != null) {
      parts.push({ type: "mdlink", text: match[1], url: match[2] });
    } else if (match[3] != null) {
      parts.push({ type: "mdlink", text: match[3], url: match[3] }); // plain URL as link text
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
            return <RichLink key={i} url={part.url} />;
          }
          return (
            <a
              key={i}
              href={part.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:text-primary/80"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {renderFormatted(part.text, `link-${i}`)}
            </a>
          );
        }
        return <span key={i}>{renderFormatted(part.text, `p-${i}`)}</span>;
      })}
    </>
  );
}

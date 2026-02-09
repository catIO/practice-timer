import { RichLink } from "./RichLink";

/**
 * Renders text with URLs (http/https) transformed into RichLink cards.
 * Used on the plan page and the shareable report so links (e.g. YouTube) show the same way.
 */
export function TextWithLinks({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.match(/^https?:\/\//)) {
          return <RichLink key={i} url={part} />;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

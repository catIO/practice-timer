export interface SelectionRange {
  start: number;
  end: number;
}

export interface FormatResult {
  newText: string;
  newCursorEnd: number;
}

/**
 * Applies Bold (**text**), Italic (*text*), or Markdown Link ([text](url)) formatting to a selection.
 */
export function applyTextFormat(
  text: string,
  selection: SelectionRange,
  action: "bold" | "italic" | "link",
  url?: string,
  opts?: { linkText?: string }
): FormatResult | null {
  if (selection.start === selection.end) return null;
  const sel = opts?.linkText ?? text.slice(selection.start, selection.end);
  let newText: string;
  let newCursorEnd: number;

  if (action === "bold") {
    newText = text.slice(0, selection.start) + `**${sel}**` + text.slice(selection.end);
    newCursorEnd = selection.start + sel.length + 4;
  } else if (action === "italic") {
    newText = text.slice(0, selection.start) + `*${sel}*` + text.slice(selection.end);
    newCursorEnd = selection.start + sel.length + 2;
  } else if (action === "link" && url) {
    newText = text.slice(0, selection.start) + `[${sel}](${url})` + text.slice(selection.end);
    newCursorEnd = selection.start + sel.length + url.length + 4;
  } else {
    return null;
  }

  return { newText, newCursorEnd };
}

/**
 * Strips markdown link formatting from a string, returning only the text label.
 * Also handles partially mangled link markup gracefully.
 */
export function stripMarkdownLinks(str: string | null | undefined): string {
  if (!str) return "";
  return str.replace(/\[([^\]\(\)]+)\]?\((https?:\/\/[^\s\)]*)\)?/g, "$1");
}

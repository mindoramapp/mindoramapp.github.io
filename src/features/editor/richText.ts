// Light formatting inside a topic's text, stored as plain text with Markdown-style marks:
// **bold**, *italic* (or _italic_) and ~~strikethrough~~. Line breaks are kept as "\n".
// Plain text keeps working everywhere (search, review cards, exports), and nothing is ever
// rendered as HTML.

export interface RichSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
}

type Style = "bold" | "italic" | "strike";

const MARKS: { mark: string; style: Style }[] = [
  { mark: "**", style: "bold" },
  { mark: "~~", style: "strike" },
  { mark: "*", style: "italic" },
  { mark: "_", style: "italic" },
];

/** Splits a label into styled pieces. Unclosed marks stay as literal text. */
export function parseRich(label: string): RichSegment[] {
  const segments: RichSegment[] = [];
  const walk = (text: string, styles: Partial<Record<Style, boolean>>) => {
    let buffer = "";
    let i = 0;
    const flush = () => {
      if (buffer) segments.push({ text: buffer, ...styles });
      buffer = "";
    };
    while (i < text.length) {
      const found = MARKS.find(({ mark }) => text.startsWith(mark, i));
      if (found) {
        let close = text.indexOf(found.mark, i + found.mark.length);
        // "***" closing "**...*...***": the inner mark takes the first star, this one the rest.
        while (close > -1 && text.startsWith(found.mark, close + 1)) close += 1;
        const inner = close > -1 ? text.slice(i + found.mark.length, close) : "";
        // "_" inside words (snake_case) and empty or space-padded pairs are not formatting.
        const wordUnderscore =
          found.mark === "_" && /\w/.test(text[i - 1] ?? "") && /\w/.test(text[close + 1] ?? "");
        if (close > -1 && inner.trim() && inner === inner.trim() && !wordUnderscore) {
          flush();
          walk(inner, { ...styles, [found.style]: true });
          i = close + found.mark.length;
          continue;
        }
      }
      buffer += text[i];
      i += 1;
    }
    flush();
  };
  walk(label, {});
  return segments;
}

/** The label without formatting marks (search, review cards, plain exports). */
export function plainText(label: string): string {
  return parseRich(label)
    .map((segment) => segment.text)
    .join("");
}

/** Whether the label uses any formatting (so plain labels render exactly as before). */
export function hasFormatting(label: string): boolean {
  return plainText(label) !== label;
}

const MARK_OF: Record<Style, string> = { bold: "**", italic: "*", strike: "~~" };

/**
 * Wraps the selection in a mark, or removes it when the selection is already wrapped. With
 * nothing selected the whole text is used, so one click formats the topic.
 */
export function toggleMark(
  value: string,
  start: number,
  end: number,
  style: Style,
): { value: string; start: number; end: number } {
  const mark = MARK_OF[style];
  if (start === end) {
    start = 0;
    end = value.length;
  }
  // Leave surrounding spaces out of the marks ("**word** " not "**word **").
  while (start < end && /\s/.test(value[start])) start += 1;
  while (end > start && /\s/.test(value[end - 1])) end -= 1;
  if (start === end) return { value, start, end };

  const selected = value.slice(start, end);
  const before = value.slice(0, start);
  const after = value.slice(end);
  // Already wrapped, inside or just outside the selection: unwrap.
  if (selected.length > mark.length * 2 && selected.startsWith(mark) && selected.endsWith(mark)) {
    const inner = selected.slice(mark.length, -mark.length);
    return { value: before + inner + after, start, end: start + inner.length };
  }
  if (before.endsWith(mark) && after.startsWith(mark)) {
    return {
      value: before.slice(0, -mark.length) + selected + after.slice(mark.length),
      start: start - mark.length,
      end: end - mark.length,
    };
  }
  return {
    value: before + mark + selected + mark + after,
    start: start + mark.length,
    end: end + mark.length,
  };
}

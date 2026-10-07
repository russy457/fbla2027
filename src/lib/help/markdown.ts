/**
 * markdown.ts
 * A tiny, safe Markdown parser for help articles. It produces a plain data
 * tree (no HTML strings) that MarkdownView renders as React elements, so the
 * app never needs dangerouslySetInnerHTML (SPEC 8.4 rule on rendering).
 *
 * Supported, on purpose, and nothing else:
 *   blocks   "## " and "### " headings, paragraphs, "- " / "* " bullet lists,
 *            "1. " numbered lists, "> " notes (used for "Coming soon")
 *   inline   **bold**, *italic* or _italic_, `code`, [label](/internal/link)
 *
 * Links must be internal app paths ("/help/..."). Any other target (http:,
 * javascript:, protocol-relative "//") is rendered as its plain label text.
 */

export type InlineNode =
  | { readonly type: "text"; readonly text: string }
  | { readonly type: "strong"; readonly children: readonly InlineNode[] }
  | { readonly type: "em"; readonly children: readonly InlineNode[] }
  | { readonly type: "code"; readonly text: string }
  | { readonly type: "link"; readonly href: string; readonly children: readonly InlineNode[] };

export type BlockNode =
  | { readonly type: "heading"; readonly level: 2 | 3; readonly children: readonly InlineNode[] }
  | { readonly type: "paragraph"; readonly children: readonly InlineNode[] }
  | { readonly type: "list"; readonly ordered: boolean; readonly items: ReadonlyArray<readonly InlineNode[]> }
  | { readonly type: "note"; readonly children: readonly InlineNode[] };

/** Internal path: one leading slash (not two), safe URL characters, no backslash. */
const INTERNAL_HREF = /^\/(?!\/)[A-Za-z0-9\-._~/?#=&%]*$/;

export const isInternalHref = (href: string): boolean => INTERNAL_HREF.test(href);

/*
 * Inline grammar, tried left to right; the earliest match wins.
 * Groups: 1 code, 2 link label, 3 link href, 4 bold, 5 italic (*), 6 italic (_).
 */
const INLINE_PATTERN = /`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*\*(.+?)\*\*|\*([^*\s][^*]*?)\*|(?<![\w])_([^_\s][^_]*?)_(?![\w])/g;

const textNode = (text: string): InlineNode => ({ type: "text", text });

const toInlineNode = (match: RegExpExecArray): InlineNode => {
  const [, code, label, href, bold, starItalic, underscoreItalic] = match;
  if (code !== undefined) return { type: "code", text: code };
  if (label !== undefined && href !== undefined) {
    // Unsafe or external links lose their link and keep only the label text.
    return isInternalHref(href) ? { type: "link", href, children: parseInline(label) } : textNode(label);
  }
  if (bold !== undefined) return { type: "strong", children: parseInline(bold) };
  return { type: "em", children: parseInline(starItalic ?? underscoreItalic ?? "") };
};

/** Parse one line (or joined paragraph) of inline Markdown. */
export const parseInline = (text: string): readonly InlineNode[] => {
  const nodes: InlineNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(INLINE_PATTERN)) {
    if (match.index > cursor) nodes.push(textNode(text.slice(cursor, match.index)));
    nodes.push(toInlineNode(match));
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) nodes.push(textNode(text.slice(cursor)));
  return nodes;
};

const HEADING = /^(#{1,3})\s+(.*)$/;
const BULLET_ITEM = /^[-*]\s+(.*)$/;
const NUMBERED_ITEM = /^\d+[.)]\s+(.*)$/;
const NOTE = /^>\s?(.*)$/;

type LineKind = "blank" | "heading" | "bullet" | "numbered" | "note" | "text";

const classify = (line: string): LineKind => {
  if (line.trim() === "") return "blank";
  if (HEADING.test(line)) return "heading";
  if (BULLET_ITEM.test(line)) return "bullet";
  if (NUMBERED_ITEM.test(line)) return "numbered";
  if (NOTE.test(line)) return "note";
  return "text";
};

/** Collect consecutive lines of one kind starting at `start`. */
const takeRun = (lines: readonly string[], start: number, kind: LineKind): readonly string[] => {
  const run: string[] = [];
  for (let index = start; index < lines.length && classify(lines[index]!) === kind; index += 1) {
    run.push(lines[index]!);
  }
  return run;
};

const stripPrefix = (line: string, pattern: RegExp): string => (pattern.exec(line)?.[1] ?? "").trim();

/** Turn one run of same-kind lines into a block. Paragraph lines join with spaces. */
const toBlock = (kind: Exclude<LineKind, "blank">, run: readonly string[]): BlockNode => {
  switch (kind) {
    case "heading": {
      const [, hashes = "##", text = ""] = HEADING.exec(run[0]!) ?? [];
      // The page title is the only h1, so "#" and "##" both become h2.
      return { type: "heading", level: hashes.length === 3 ? 3 : 2, children: parseInline(text.trim()) };
    }
    case "bullet":
    case "numbered": {
      const pattern = kind === "bullet" ? BULLET_ITEM : NUMBERED_ITEM;
      return { type: "list", ordered: kind === "numbered", items: run.map((line) => parseInline(stripPrefix(line, pattern))) };
    }
    case "note":
      return { type: "note", children: parseInline(run.map((line) => stripPrefix(line, NOTE)).join(" ")) };
    case "text":
      return { type: "paragraph", children: parseInline(run.map((line) => line.trim()).join(" ")) };
  }
};

/** Parse a Markdown document into blocks. Headings are always one line each. */
export const parseMarkdown = (markdown: string): readonly BlockNode[] => {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: BlockNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const kind = classify(lines[index]!);
    if (kind === "blank") {
      index += 1;
      continue;
    }
    const run = kind === "heading" ? [lines[index]!] : takeRun(lines, index, kind);
    blocks.push(toBlock(kind, run));
    index += run.length;
  }
  return blocks;
};

/** Flatten inline nodes to plain text (used for previews and tests). */
export const inlineToText = (nodes: readonly InlineNode[]): string =>
  nodes.map((node) => ("children" in node ? inlineToText(node.children) : node.text)).join("");

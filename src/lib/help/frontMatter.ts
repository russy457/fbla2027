/**
 * frontMatter.ts
 * A deliberately tiny front matter parser for help articles, so the app does
 * not need a YAML dependency. It understands exactly the subset our articles
 * use, one key per line:
 *
 *   ---
 *   slug: kiosk-check-in          plain string
 *   tags: [check in, kiosk, code] inline list (comma separated)
 *   ---
 *
 * Anything else (nested maps, multi-line values) is rejected with a clear
 * error so a typo in an article fails the test suite instead of silently
 * producing a broken page.
 */

export type FrontMatterValue = string | readonly string[];

export interface FrontMatterResult {
  readonly data: Readonly<Record<string, FrontMatterValue>>;
  readonly body: string;
}

const FENCE = "---";
const KEY_LINE = /^([a-zA-Z][\w-]*):\s*(.*)$/;

/** Strip one pair of matching surrounding quotes, if present. */
const unquote = (value: string): string => {
  const trimmed = value.trim();
  const first = trimmed.at(0);
  if (trimmed.length >= 2 && (first === '"' || first === "'") && trimmed.at(-1) === first) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

/** "[a, b, c]" -> ["a", "b", "c"]; empty entries are dropped. */
const parseInlineList = (value: string): readonly string[] =>
  value
    .slice(1, -1)
    .split(",")
    .map(unquote)
    .filter((item) => item.length > 0);

const parseValue = (raw: string): FrontMatterValue => {
  const trimmed = raw.trim();
  return trimmed.startsWith("[") && trimmed.endsWith("]") ? parseInlineList(trimmed) : unquote(trimmed);
};

/**
 * Split a Markdown file into its front matter map and body.
 * Throws when the opening or closing fence is missing or a line is malformed.
 */
export const parseFrontMatter = (raw: string, source = "article"): FrontMatterResult => {
  // Normalize Windows line endings so authors on any OS get the same result.
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  if (lines[0]?.trim() !== FENCE) {
    throw new Error(`${source}: front matter must start with "---" on the first line.`);
  }
  const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === FENCE);
  if (closingIndex < 0) {
    throw new Error(`${source}: front matter is missing its closing "---".`);
  }

  const entries = lines.slice(1, closingIndex).flatMap((line, offset): Array<[string, FrontMatterValue]> => {
    if (line.trim() === "") return [];
    const match = KEY_LINE.exec(line);
    if (!match) {
      throw new Error(`${source}: line ${offset + 2} is not "key: value".`);
    }
    return [[match[1]!, parseValue(match[2] ?? "")]];
  });

  return {
    data: Object.freeze(Object.fromEntries(entries)),
    body: lines.slice(closingIndex + 1).join("\n").trim()
  };
};

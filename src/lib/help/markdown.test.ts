/**
 * markdown.test.ts
 * Unit tests for the safe Markdown subset: block structure, inline marks,
 * and the internal-only link rule.
 */
import { describe, expect, it } from "vitest";
import { inlineToText, isInternalHref, parseInline, parseMarkdown } from "./markdown";

describe("parseMarkdown blocks", () => {
  it("parses headings, paragraphs, lists, and notes", () => {
    const blocks = parseMarkdown(
      "## Title\n\nLine one\nline two.\n\n- a\n- b\n\n1. first\n2. second\n\n> Coming soon: x\n\n### Small\n# Big"
    );
    expect(blocks.map((block) => block.type)).toEqual([
      "heading",
      "paragraph",
      "list",
      "list",
      "note",
      "heading",
      "heading"
    ]);
    expect(blocks[1]).toEqual({ type: "paragraph", children: [{ type: "text", text: "Line one line two." }] });
    expect(blocks[2]).toMatchObject({ ordered: false, items: [[{ text: "a" }], [{ text: "b" }]] });
    expect(blocks[3]).toMatchObject({ ordered: true });
    expect(blocks[5]).toMatchObject({ level: 3 });
    // A single "#" is demoted to h2 because the page title is the only h1.
    expect(blocks[6]).toMatchObject({ level: 2 });
  });

  it("ends a paragraph when a list starts on the next line", () => {
    expect(parseMarkdown("Intro:\n- item").map((block) => block.type)).toEqual(["paragraph", "list"]);
  });

  it("returns no blocks for blank input", () => {
    expect(parseMarkdown("\n\n  \n")).toEqual([]);
  });
});

describe("parseInline", () => {
  it("parses bold, italic, code, and nested marks", () => {
    const nodes = parseInline("Press **Check _now_**, then *wait* for `123456`.");
    expect(nodes.map((node) => node.type)).toEqual(["text", "strong", "text", "em", "text", "code", "text"]);
    expect(nodes[1]).toEqual({
      type: "strong",
      children: [
        { type: "text", text: "Check " },
        { type: "em", children: [{ type: "text", text: "now" }] }
      ]
    });
  });

  it("keeps internal links and flattens external or script links to text", () => {
    const nodes = parseInline("[ok](/help/a) [ext](https://x.example) [bad](javascript:alert(1)) [proto](//evil.example)");
    expect(nodes[0]).toEqual({ type: "link", href: "/help/a", children: [{ type: "text", text: "ok" }] });
    expect(nodes.filter((node) => node.type === "link")).toHaveLength(1);
    expect(inlineToText(nodes)).toContain("ext");
    expect(inlineToText(nodes)).not.toContain("https://");
  });

  it("does not treat snake_case words as italics", () => {
    expect(parseInline("org_id and kiosk_code")).toEqual([{ type: "text", text: "org_id and kiosk_code" }]);
  });

  it("leaves HTML-looking text as plain text", () => {
    expect(parseInline("<img src=x onerror=alert(1)>")).toEqual([
      { type: "text", text: "<img src=x onerror=alert(1)>" }
    ]);
  });
});

describe("isInternalHref", () => {
  it.each([
    ["/help/kiosk-check-in", true],
    ["/verify?code=ABC#top", true],
    ["//evil.example", false],
    ["https://example.com", false],
    ["javascript:alert(1)", false],
    ["/path\\with\\backslash", false]
  ])("%s -> %s", (href, expected) => {
    expect(isInternalHref(href)).toBe(expected);
  });
});

/**
 * highlight.test.ts
 * Unit tests for splitting text into matched and unmatched segments.
 */
import { describe, expect, it } from "vitest";
import { splitHighlights } from "./highlight";

describe("splitHighlights", () => {
  it("marks exact, plural, and case-insensitive matches", () => {
    expect(splitHighlights("Check in with Codes", ["check", "code"])).toEqual([
      { text: "Check", isMatch: true },
      { text: " in with ", isMatch: false },
      { text: "Codes", isMatch: true }
    ]);
  });

  it("marks a word within the typo distance", () => {
    const segments = splitHighlights("kiosk mode", ["kiosck"]);
    expect(segments[0]).toEqual({ text: "kiosk", isMatch: true });
  });

  it("never marks stop words or single letters", () => {
    expect(splitHighlights("a the", ["the", "a"])).toEqual([{ text: "a the", isMatch: false }]);
  });

  it("returns one plain segment when there are no terms", () => {
    expect(splitHighlights("Hello", [])).toEqual([{ text: "Hello", isMatch: false }]);
    expect(splitHighlights("", ["x"])).toEqual([]);
  });

  it("keeps markup-looking text as plain text", () => {
    const segments = splitHighlights("<b>code</b>", ["code"]);
    expect(segments.map((segment) => segment.text).join("")).toBe("<b>code</b>");
    expect(segments.find((segment) => segment.isMatch)?.text).toBe("code");
  });
});

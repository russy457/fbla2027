/**
 * frontMatter.test.ts
 * Unit tests for the tiny front matter parser: strings, inline lists, quotes,
 * Windows line endings, and the errors authors see for malformed files.
 */
import { describe, expect, it } from "vitest";
import { parseFrontMatter } from "./frontMatter";

describe("parseFrontMatter", () => {
  it("reads strings and inline lists and returns the trimmed body", () => {
    const raw = "---\nslug: kiosk-check-in\ntitle: \"Checking in\"\ntags: [check in, 'kiosk', code]\n---\n\nBody text.\n";
    const { data, body } = parseFrontMatter(raw);
    expect(data.slug).toBe("kiosk-check-in");
    expect(data.title).toBe("Checking in");
    expect(data.tags).toEqual(["check in", "kiosk", "code"]);
    expect(body).toBe("Body text.");
  });

  it("handles Windows line endings and blank lines inside the block", () => {
    const { data, body } = parseFrontMatter("---\r\nslug: a\r\n\r\nroles: all\r\n---\r\nHello");
    expect(data).toEqual({ slug: "a", roles: "all" });
    expect(body).toBe("Hello");
  });

  it("drops empty list entries", () => {
    expect(parseFrontMatter("---\ntags: [a, , b,]\n---\n").data.tags).toEqual(["a", "b"]);
  });

  it("rejects a file without an opening fence", () => {
    expect(() => parseFrontMatter("slug: a\n---", "x.md")).toThrow(/x\.md: front matter must start/);
  });

  it("rejects a file without a closing fence", () => {
    expect(() => parseFrontMatter("---\nslug: a\n")).toThrow(/missing its closing/);
  });

  it("rejects a line that is not key: value", () => {
    expect(() => parseFrontMatter("---\nslug a\n---\n")).toThrow(/line 2 is not "key: value"/);
  });
});

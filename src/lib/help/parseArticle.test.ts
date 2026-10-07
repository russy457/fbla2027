/**
 * parseArticle.test.ts
 * Unit tests for article validation and the trailing "Related articles"
 * section extraction.
 */
import { describe, expect, it } from "vitest";
import { extractRelated, parseArticle } from "./parseArticle";

const article = (frontMatter: string, body = "Intro.\n\n## Related articles\n\n- other-slug\n- second") =>
  `---\n${frontMatter}\n---\n${body}`;

const VALID = "slug: my-topic\ntitle: My topic\nsummary: A summary.\ntags: [one, two]\nroles: [volunteer, coordinator]";

describe("parseArticle", () => {
  it("parses a valid article and lifts the related list out of the body", () => {
    const parsed = parseArticle(article(VALID));
    expect(parsed).toMatchObject({
      slug: "my-topic",
      title: "My topic",
      summary: "A summary.",
      tags: ["one", "two"],
      roles: ["volunteer", "coordinator"],
      related: ["other-slug", "second"],
      body: "Intro."
    });
  });

  it("accepts a single role and tag written as plain strings", () => {
    const parsed = parseArticle(article("slug: a\ntitle: A\nsummary: S\ntags: solo\nroles: all"));
    expect(parsed.roles).toEqual(["all"]);
    expect(parsed.tags).toEqual(["solo"]);
  });

  it("drops a related link that points at the article itself", () => {
    const parsed = parseArticle(article(VALID, "Body\n\n## Related articles\n\n- my-topic\n- other"));
    expect(parsed.related).toEqual(["other"]);
  });

  it.each([
    ["missing title", "slug: a\nsummary: S\nroles: all", /"title" must be a non-empty string/],
    ["bad slug", "slug: Not A Slug\ntitle: T\nsummary: S\nroles: all", /must be lowercase words/],
    ["unknown role", "slug: a\ntitle: T\nsummary: S\nroles: [parent]", /unknown role\(s\) parent/],
    ["no roles", "slug: a\ntitle: T\nsummary: S", /"roles" is required/]
  ])("rejects %s", (_name, frontMatter, message) => {
    expect(() => parseArticle(article(frontMatter), "bad.md")).toThrow(message);
  });
});

describe("extractRelated", () => {
  it("returns the body unchanged when there is no related section", () => {
    expect(extractRelated("Just text.", "x")).toEqual({ body: "Just text.", related: [] });
  });

  it("rejects related entries that are not slug bullets", () => {
    expect(() => extractRelated("Body\n## Related articles\nSee the kiosk page", "x.md")).toThrow(/must be a bullet/);
  });
});

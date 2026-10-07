/**
 * content.test.ts
 * Guards the real articles in src/content/help: they parse, every related
 * link and route suggestion points at a real article, required SPEC slugs
 * exist, prose has no em or en dashes (style rule), and real search finds the
 * obvious article for common questions.
 */
import { describe, expect, it } from "vitest";
import { getHelpLibrary } from "./helpLibrary";
import { assertArticleSetIsConsistent, loadHelpArticles, parseArticleFiles } from "./loadArticles";
import { DEFAULT_SUGGESTIONS, ROUTE_SUGGESTIONS } from "./routeContext";
import type { HelpArticle } from "./types";

/** En dash (U+2013) and em dash (U+2014), written as codes so this file has none. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);

const articles = loadHelpArticles();
const slugs = new Set(articles.map((article) => article.slug));

/** Required articles (SPEC 8.5) and error catalog helpSlugs (SPEC 10.10) this help set covers. */
const SPEC_SLUGS = [
  "getting-started",
  "privacy-and-minors",
  "find-and-sign-up",
  "kiosk-check-in",
  "check-out-and-hours",
  "verified-letters",
  "verify-a-letter",
  "accessibility-settings",
  "ai-assistant",
  "org-verification",
  "coordinator-start-kiosk",
  "coordinator-approve-hours",
  "coordinator-attendance",
  "coordinator-reports",
  // Tier 1 (SPEC 8.5 required list and 10.10 helpSlugs)
  "waitlist-and-promotion",
  "manual-hours",
  "track-record",
  "calendar-export",
  "alerts-are-in-app",
  // Tier 1 feature articles
  "saved-items",
  "milestones",
  "coordinator-needs-attention",
  "attendance-disputes",
  "org-registration",
  "coordinator-invites",
  "coordinator-create-shifts"
];

describe("bundled help content", () => {
  it("loads between 25 and 45 articles, sorted by title", () => {
    expect(articles.length).toBeGreaterThanOrEqual(25);
    expect(articles.length).toBeLessThanOrEqual(45);
    const titles = articles.map((article) => article.title);
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)));
  });

  it("includes every SPEC slug this set is responsible for", () => {
    expect(SPEC_SLUGS.filter((slug) => !slugs.has(slug))).toEqual([]);
  });

  it("gives every article a related list of real articles", () => {
    for (const article of articles) {
      expect(article.related.length, article.slug).toBeGreaterThan(0);
      expect(article.related.every((slug) => slugs.has(slug)), article.slug).toBe(true);
    }
  });

  it("only suggests real articles for routes", () => {
    const suggested = [...ROUTE_SUGGESTIONS.flatMap(([, routeSlugs]) => routeSlugs), ...DEFAULT_SUGGESTIONS];
    expect(suggested.filter((slug) => !slugs.has(slug))).toEqual([]);
  });

  it("contains no em or en dashes", () => {
    const dashed = articles.filter((article) => DASHES.test(JSON.stringify(article)));
    expect(dashed.map((article) => article.slug)).toEqual([]);
  });

  it.each([
    ["code expired", "troubleshooting-check-in"],
    ["how are hours counted", "check-out-and-hours"],
    ["revoked letter", "verify-a-letter"],
    ["text size", "accessibility-settings"],
    ["birth date", "create-account"],
    // Tier 1 questions
    ["waitlist", "waitlist-and-promotion"],
    ["add to calendar", "calendar-export"],
    ["no-show dispute", "attendance-disputes"],
    ["register my nonprofit", "org-registration"],
    ["invite a coordinator", "coordinator-invites"],
    ["manual hours", "manual-hours"],
    ["reliability score", "track-record"],
    ["notifications", "alerts-are-in-app"],
    ["saved shifts", "saved-items"],
    ["25 hour milestone", "milestones"],
    ["needs attention", "coordinator-needs-attention"],
    ["create a shift", "coordinator-create-shifts"],
    ["do you send email reminders", "alerts-are-in-app"],
    ["daily limit on the AI assistant", "ai-assistant"]
  ])("search for %j finds %s in the top 3", (query, slug) => {
    const top = getHelpLibrary().search(query, { limit: 3 }).map((hit) => hit.article.slug);
    expect(top).toContain(slug);
  });
});

describe("article set validation", () => {
  const sample = (slug: string, related: string[] = []): HelpArticle => ({
    slug,
    title: slug,
    summary: "s",
    tags: [],
    roles: ["all"],
    related,
    body: ""
  });

  it("rejects duplicate slugs and missing related articles", () => {
    expect(() => assertArticleSetIsConsistent([sample("a"), sample("a")])).toThrow(/Duplicate/);
    expect(() => assertArticleSetIsConsistent([sample("a", ["ghost"])])).toThrow(/missing article\(s\): ghost/);
  });

  it("parses a raw file map", () => {
    const parsed = parseArticleFiles({ "x.md": "---\nslug: x\ntitle: X\nsummary: S\nroles: all\n---\nBody" });
    expect(parsed.map((article) => article.slug)).toEqual(["x"]);
  });
});

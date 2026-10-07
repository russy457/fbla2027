/**
 * helpSearch.test.ts
 * Ranking sanity for Help Center search: title and tag boosts, typo
 * tolerance, search-as-you-type completions, and the empty query rule.
 */
import { describe, expect, it } from "vitest";
import { createHelpSearcher, toSearchableRecord } from "./helpSearch";
import { FIXTURE_ARTICLES } from "./testFixtures";

const searcher = createHelpSearcher(FIXTURE_ARTICLES);
const slugsFor = (query: string) => searcher.search(query).map((hit) => hit.article.slug);

describe("help search", () => {
  it("returns nothing for an empty or stop-word-only query", () => {
    expect(searcher.search("")).toEqual([]);
    expect(searcher.search("   ")).toEqual([]);
    expect(searcher.search("the and of")).toEqual([]);
  });

  it("ranks a title match above a body-only mention", () => {
    // "letter" is in the letters title; the kiosk article never says it.
    expect(slugsFor("letter")[0]).toBe("verified-letters");
    // "kiosk" is in two titles but the check-in article also tags it.
    expect(slugsFor("kiosk").slice(0, 2).sort()).toEqual(["coordinator-start-kiosk", "kiosk-check-in"]);
  });

  it("uses tags as a strong signal", () => {
    expect(slugsFor("contrast")[0]).toBe("accessibility-settings");
    expect(slugsFor("tablet")[0]).toBe("coordinator-start-kiosk");
  });

  it("tolerates a typo", () => {
    expect(slugsFor("kiosck ")).toContain("kiosk-check-in");
    expect(slugsFor("accesibility ")[0]).toBe("accessibility-settings");
  });

  it("completes an unfinished last word", () => {
    expect(slugsFor("verif")[0]).toBe("verified-letters");
    const [hit] = searcher.search("verif");
    // The typed fragment plus at least one real completion such as "verify".
    expect(hit?.matchedTerms.some((term) => term.startsWith("verif") && term !== "verif")).toBe(true);
  });

  it("never autocompletes a stop word", () => {
    const [hit] = searcher.search("check in");
    expect(hit?.matchedTerms).toEqual(["check"]);
  });

  it("does not autocomplete once the word is finished with a space", () => {
    const [hit] = searcher.search("kiosk ");
    expect(hit?.matchedTerms).toEqual(["kiosk"]);
  });

  it("respects the limit option", () => {
    expect(searcher.search("check", { limit: 1 })).toHaveLength(1);
  });

  it("does not index link targets as words", () => {
    const record = toSearchableRecord(FIXTURE_ARTICLES[1]!);
    expect(record.fields.body).not.toContain("/help/");
    expect(record.fields.slug).toBe("verified letters");
  });
});

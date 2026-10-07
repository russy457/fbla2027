import { describe, it, expect } from "vitest";
import { levenshtein, withinEditDistance } from "./levenshtein";

describe("levenshtein", () => {
  it("is zero for identical strings", () => {
    expect(levenshtein("taco", "taco")).toBe(0);
  });

  it("equals the other length when one string is empty", () => {
    expect(levenshtein("", "taco")).toBe(4);
    expect(levenshtein("taco", "")).toBe(4);
  });

  it("counts a single substitution", () => {
    expect(levenshtein("taco", "tako")).toBe(1);
  });

  it("counts insertions and deletions", () => {
    expect(levenshtein("taco", "tacos")).toBe(1); // insertion
    expect(levenshtein("tacos", "taco")).toBe(1); // deletion
  });

  it("handles the classic kitten/sitting example", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
  });

  it("is symmetric", () => {
    expect(levenshtein("burger", "bunger")).toBe(levenshtein("bunger", "burger"));
  });
});

describe("withinEditDistance", () => {
  it("short-circuits on length difference", () => {
    expect(withinEditDistance("taco", "tacosss", 1)).toBe(false);
  });

  it("returns true at the boundary", () => {
    expect(withinEditDistance("taco", "tako", 1)).toBe(true);
    expect(withinEditDistance("taco", "taco", 0)).toBe(true);
  });

  it("returns false beyond the budget", () => {
    expect(withinEditDistance("taco", "pizza", 1)).toBe(false);
  });

  it("agrees with full distance for a range of pairs", () => {
    const pairs: Array<[string, string]> = [
      ["coffee", "cofee"],
      ["austin", "austen"],
      ["burger", "burgers"],
      ["thai", "tahi"]
    ];
    for (const [a, b] of pairs) {
      const d = levenshtein(a, b);
      expect(withinEditDistance(a, b, d)).toBe(true);
      expect(withinEditDistance(a, b, d - 1)).toBe(false);
    }
  });
});

import { describe, it, expect } from "vitest";
import { tokenize, termFrequencies, normalizeToken, STOP_WORDS } from "./tokenize";

describe("tokenize", () => {
  it("lowercases, strips punctuation, and splits on non-alphanumerics", () => {
    expect(tokenize("The Best Tacos!!! in Austin")).toEqual(["best", "taco", "austin"]);
  });

  it("drops stop words", () => {
    // "the", "and", "in" are stop words; "of" too
    expect(tokenize("the art of coffee and tea")).toEqual(["art", "coffee", "tea"]);
  });

  it("drops tokens shorter than 2 characters", () => {
    expect(tokenize("a b cd e")).toEqual(["cd"]);
  });

  it("returns an empty array for empty or punctuation-only input", () => {
    expect(tokenize("")).toEqual([]);
    expect(tokenize("   ")).toEqual([]);
    expect(tokenize("!!! ... ???")).toEqual([]);
  });

  it("preserves unicode letters and multi-digit numbers (single chars dropped)", () => {
    // "7" is a single character and is dropped by the min-length rule.
    expect(tokenize("Café 24/7 Münchën")).toEqual(["café", "24", "münchën"]);
  });

  it("folds simple plurals via normalizeToken", () => {
    expect(normalizeToken("tacos")).toBe("taco");
    expect(normalizeToken("dishes")).toBe("dish");
    expect(normalizeToken("bakeries")).toBe("bakery");
  });

  it("does not over-stem short or -ss words", () => {
    expect(normalizeToken("less")).toBe("less");
    expect(normalizeToken("class")).toBe("class");
    expect(normalizeToken("is")).toBe("is");
  });

  it("STOP_WORDS contains common english function words", () => {
    expect(STOP_WORDS.has("the")).toBe(true);
    expect(STOP_WORDS.has("taco")).toBe(false);
  });
});

describe("termFrequencies", () => {
  it("counts normalized term occurrences", () => {
    const freqs = termFrequencies("taco taco tacos burger");
    expect(freqs.get("taco")).toBe(3); // taco, taco, tacos->taco
    expect(freqs.get("burger")).toBe(1);
  });

  it("returns an empty map for empty input", () => {
    expect(termFrequencies("").size).toBe(0);
  });
});

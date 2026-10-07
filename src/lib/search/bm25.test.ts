import { describe, it, expect } from "vitest";
import { bm25TermScore, idf } from "./bm25";

describe("idf", () => {
  it("scores rarer terms higher", () => {
    const rare = idf(100, 1);
    const common = idf(100, 90);
    expect(rare).toBeGreaterThan(common);
  });

  it("stays non-negative even for ubiquitous terms", () => {
    expect(idf(100, 100)).toBeGreaterThanOrEqual(0);
  });

  it("returns zero for degenerate inputs", () => {
    expect(idf(0, 0)).toBe(0);
    expect(idf(10, 0)).toBe(0);
  });
});

describe("bm25TermScore", () => {
  const base = {
    docLength: 10,
    avgDocLength: 10,
    totalDocs: 100,
    docFrequency: 10
  };

  it("is zero when the term is absent", () => {
    expect(bm25TermScore({ ...base, termFrequency: 0 })).toBe(0);
  });

  it("increases with term frequency but saturates", () => {
    const tf1 = bm25TermScore({ ...base, termFrequency: 1 });
    const tf2 = bm25TermScore({ ...base, termFrequency: 2 });
    const tf10 = bm25TermScore({ ...base, termFrequency: 10 });
    expect(tf2).toBeGreaterThan(tf1);
    // saturation: going 1->2 adds more than 9->10
    const tf9 = bm25TermScore({ ...base, termFrequency: 9 });
    expect(tf2 - tf1).toBeGreaterThan(tf10 - tf9);
  });

  it("penalizes longer-than-average documents", () => {
    const shortDoc = bm25TermScore({ ...base, termFrequency: 3, docLength: 5 });
    const longDoc = bm25TermScore({ ...base, termFrequency: 3, docLength: 40 });
    expect(shortDoc).toBeGreaterThan(longDoc);
  });

  it("ignores length when b = 0", () => {
    const shortDoc = bm25TermScore({ ...base, termFrequency: 3, docLength: 5, b: 0 });
    const longDoc = bm25TermScore({ ...base, termFrequency: 3, docLength: 40, b: 0 });
    expect(shortDoc).toBeCloseTo(longDoc, 10);
  });
});

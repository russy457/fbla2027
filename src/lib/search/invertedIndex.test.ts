import { describe, it, expect } from "vitest";
import { InvertedIndex } from "./invertedIndex";

const idx = (): InvertedIndex => {
  const index = new InvertedIndex();
  index.addDocument("b1", new Map([["taco", 3], ["austin", 1]]));
  index.addDocument("b2", new Map([["taco", 1], ["tea", 2]]));
  index.addDocument("b3", new Map([["burger", 1]]));
  return index;
};

describe("InvertedIndex", () => {
  it("tracks posting lists with weighted term frequencies", () => {
    const index = idx();
    const taco = index.getPostings("taco");
    expect(taco?.get("b1")).toBe(3);
    expect(taco?.get("b2")).toBe(1);
    expect(index.getPostings("missing")).toBeNull();
  });

  it("computes document frequency from posting list size", () => {
    const index = idx();
    expect(index.documentFrequency("taco")).toBe(2);
    expect(index.documentFrequency("burger")).toBe(1);
    expect(index.documentFrequency("missing")).toBe(0);
  });

  it("computes weighted document lengths", () => {
    const index = idx();
    expect(index.documentLength("b1")).toBe(4); // 3 + 1
    expect(index.documentLength("b2")).toBe(3); // 1 + 2
    expect(index.documentLength("missing")).toBe(0);
  });

  it("reports total docs and average document length", () => {
    const index = idx();
    expect(index.totalDocs).toBe(3);
    expect(index.averageDocLength).toBeCloseTo((4 + 3 + 1) / 3, 10);
  });

  it("accumulates when the same document is added twice", () => {
    const index = new InvertedIndex();
    index.addDocument("b1", new Map([["taco", 1]]));
    index.addDocument("b1", new Map([["taco", 2]]));
    expect(index.getPostings("taco")?.get("b1")).toBe(3);
    expect(index.documentLength("b1")).toBe(3);
    expect(index.totalDocs).toBe(1);
  });

  it("exposes the vocabulary", () => {
    const index = idx();
    expect([...index.vocabulary()].sort()).toEqual(["austin", "burger", "taco", "tea"]);
  });

  it("handles an empty index gracefully", () => {
    const index = new InvertedIndex();
    expect(index.totalDocs).toBe(0);
    expect(index.averageDocLength).toBe(0);
    expect(index.getPostings("anything")).toBeNull();
  });
});

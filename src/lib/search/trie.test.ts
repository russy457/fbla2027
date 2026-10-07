import { describe, it, expect } from "vitest";
import { Trie } from "./trie";

const completionsByTerm = (trie: Trie, prefix: string) =>
  new Map(trie.completions(prefix).map((c) => [c.term, [...c.docIds].sort()]));

describe("Trie", () => {
  it("reports exact term membership", () => {
    const trie = new Trie();
    trie.insert("taco", "b1");
    expect(trie.has("taco")).toBe(true);
    expect(trie.has("tac")).toBe(false); // prefix, not a terminal term
    expect(trie.has("tacos")).toBe(false);
  });

  it("collects all completions under a prefix with their doc ids", () => {
    const trie = new Trie();
    trie.insert("taco", "b1");
    trie.insert("taco", "b2"); // same term, second doc
    trie.insert("tea", "b3");
    trie.insert("team", "b4");

    const ta = completionsByTerm(trie, "ta");
    expect(ta.get("taco")).toEqual(["b1", "b2"]);
    expect(ta.has("tea")).toBe(false); // "tea" is under "te", not "ta"

    const te = completionsByTerm(trie, "te");
    expect(te.get("tea")).toEqual(["b3"]);
    expect(te.get("team")).toEqual(["b4"]);
  });

  it("returns no completions for an unknown prefix", () => {
    const trie = new Trie();
    trie.insert("taco", "b1");
    expect(trie.completions("zzz")).toEqual([]);
  });

  it("treats the empty-string insert as a no-op", () => {
    const trie = new Trie();
    trie.insert("", "b1");
    expect(trie.completions("")).toEqual([]);
  });

  it("deduplicates the same (term, doc) pair", () => {
    const trie = new Trie();
    trie.insert("taco", "b1");
    trie.insert("taco", "b1");
    const ta = completionsByTerm(trie, "taco");
    expect(ta.get("taco")).toEqual(["b1"]);
  });
});

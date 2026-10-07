import { describe, it, expect } from "vitest";
import { splitIntoShards, mergeShards, DEFAULT_SHARD_CHARS } from "./indexArtifactCodec";
import { SearchEngine } from "./searchEngine";
import type { SearchableRecord, SerializedIndex } from "./types";

const sampleSerialized = (): SerializedIndex => {
  const records: SearchableRecord[] = [
    { id: "a", fields: { name: "Taco Town", city: "Austin" }, location: { lat: 30.27, lng: -97.74 } },
    { id: "b", fields: { name: "Tea House", city: "Austin" }, location: null }
  ];
  return SearchEngine.build(records).serialize();
};

describe("indexArtifactCodec", () => {
  it("round-trips a single-shard artifact", () => {
    const serialized = sampleSerialized();
    const shards = splitIntoShards(serialized);
    expect(shards).toHaveLength(1);
    expect(mergeShards(shards)).toEqual(serialized);
  });

  it("splits large artifacts into ordered shards and merges them back", () => {
    const serialized = sampleSerialized();
    const shards = splitIntoShards(serialized, 20); // tiny size forces many shards
    expect(shards.length).toBeGreaterThan(1);
    expect(shards.every((s, i) => s.index === i && s.total === shards.length)).toBe(true);
    expect(mergeShards(shards)).toEqual(serialized);
  });

  it("merges shards regardless of order", () => {
    const serialized = sampleSerialized();
    const shards = splitIntoShards(serialized, 30).reverse();
    expect(mergeShards(shards)).toEqual(serialized);
  });

  it("throws when a shard is missing", () => {
    const shards = splitIntoShards(sampleSerialized(), 30);
    expect(() => mergeShards(shards.slice(1))).toThrow();
  });

  it("throws on an empty shard list", () => {
    expect(() => mergeShards([])).toThrow();
  });

  it("always emits at least one shard, even for an empty index", () => {
    const empty = SearchEngine.build([]).serialize();
    const shards = splitIntoShards(empty);
    expect(shards).toHaveLength(1);
    expect(mergeShards(shards)).toEqual(empty);
  });

  it("keeps the default shard size under Firestore's document limit", () => {
    expect(DEFAULT_SHARD_CHARS).toBeLessThan(1_000_000);
  });
});

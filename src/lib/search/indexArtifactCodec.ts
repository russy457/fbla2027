/**
 * @file indexArtifactCodec.ts
 * @description Pure (no-Firebase) codec for the prebuilt search-index artifact.
 * The serialized index is JSON-stringified and split across N "shard" documents
 * so it can be stored in Firestore despite the ~1 MB per-document limit, then
 * concatenated and parsed on load. Kept Firebase-free so both the client
 * index loader (added in Tier 1) and the Node seed step can share it.
 */

import type { SerializedIndex } from "./types";

export const SEARCH_INDEX_COLLECTION = "searchIndex";

/**
 * Max characters per shard chunk. Conservative so predominantly-ASCII JSON stays
 * under Firestore's ~1 MB (UTF-8) per-document limit with headroom for the other
 * shard fields.
 */
export const DEFAULT_SHARD_CHARS = 800_000;

export interface ShardDoc {
  /** 0-based shard position. */
  index: number;
  /** Total shard count (identical on every shard). */
  total: number;
  /** Artifact format version (mirrors SerializedIndex.version). */
  version: number;
  /** A contiguous slice of the JSON-stringified SerializedIndex. */
  chunk: string;
}

/** Split a serialized index into ordered shard documents. */
export const splitIntoShards = (
  serialized: SerializedIndex,
  maxChars: number = DEFAULT_SHARD_CHARS
): ShardDoc[] => {
  const json = JSON.stringify(serialized);
  const chunks: string[] = [];
  for (let i = 0; i < json.length; i += maxChars) {
    chunks.push(json.slice(i, i + maxChars));
  }
  if (chunks.length === 0) chunks.push(""); // empty index still yields one shard
  return chunks.map((chunk, index) => ({
    index,
    total: chunks.length,
    version: serialized.version,
    chunk
  }));
};

/** Reassemble shard documents back into a serialized index. Order-independent. */
export const mergeShards = (shards: ShardDoc[]): SerializedIndex => {
  if (shards.length === 0) throw new Error("mergeShards: no shards provided");
  const ordered = [...shards].sort((a, b) => a.index - b.index);
  const total = ordered[0]!.total;
  if (ordered.length !== total) {
    throw new Error(`mergeShards: expected ${total} shards, got ${ordered.length}`);
  }
  for (let i = 0; i < ordered.length; i++) {
    if (ordered[i]!.index !== i) {
      throw new Error(`mergeShards: missing or duplicate shard at position ${i}`);
    }
  }
  return JSON.parse(ordered.map((s) => s.chunk).join("")) as SerializedIndex;
};

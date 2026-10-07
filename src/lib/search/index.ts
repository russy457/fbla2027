/**
 * index.ts
 * Public barrel for the in-house search engine (BM25 ranking, inverted index,
 * prefix trie for suggestions, Levenshtein typo tolerance, geohash distance).
 * Import from "@/lib/search" rather than reaching into individual modules.
 * Ported from the old app; the old business adapter and the Firestore index
 * loader were dropped because they were tied to the old domain.
 */
export { SearchEngine } from "./searchEngine";
export { InvertedIndex } from "./invertedIndex";
export { Trie } from "./trie";
export { tokenize, termFrequencies, normalizeToken, STOP_WORDS } from "./tokenize";
export { levenshtein, withinEditDistance } from "./levenshtein";
export { encodeGeohash, haversineMiles, sharedPrefixLength } from "./geo";
export { bm25TermScore, idf, DEFAULT_K1, DEFAULT_B } from "./bm25";
export {
  splitIntoShards,
  mergeShards,
  SEARCH_INDEX_COLLECTION,
  DEFAULT_SHARD_CHARS,
  type ShardDoc
} from "./indexArtifactCodec";
export type {
  GeoPoint,
  SearchableRecord,
  FieldWeights,
  SearchEngineOptions,
  SearchOptions,
  SearchResult,
  Suggestion,
  SerializedIndex
} from "./types";

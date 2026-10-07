/**
 * @file types.ts
 * @description Shared types for the in-house search engine. The engine is
 * deliberately decoupled from the app's domain models: it indexes generic
 * `SearchableRecord`s so it can be unit-tested in isolation and reused for any
 * document type. Domain adapters (organizations, opportunities) map records in Tier 1.
 */

/** A geographic point. Longitude/latitude in decimal degrees. */
export interface GeoPoint {
  lat: number;
  lng: number;
}

/**
 * A document the engine can index.
 *
 *   fields:  fieldName -> raw text. Each field is tokenized independently so
 *            per-field weights (e.g. name matters more than description) can be
 *            applied to term frequency.
 *   location: optional point for geo proximity ("near me") ranking/filtering.
 */
export interface SearchableRecord {
  id: string;
  fields: Record<string, string>;
  location?: GeoPoint | null;
}

/** Per-field multipliers applied to term frequency at index time. */
export type FieldWeights = Record<string, number>;

export interface SearchEngineOptions {
  /** Per-field TF multipliers. Missing fields default to weight 1. */
  fieldWeights?: FieldWeights;
  /** BM25 term-frequency saturation. Standard default 1.5. */
  k1?: number;
  /** BM25 length normalization (0 = none, 1 = full). Standard default 0.75. */
  b?: number;
}

export interface SearchOptions {
  /** Max results to return. Default 24. */
  limit?: number;
  /** Enable Levenshtein typo expansion for query terms. Default true. */
  fuzzy?: boolean;
  /**
   * Max edit distance for fuzzy expansion. Default: derived from term length
   * (>=8 chars -> 2, else 1). Fuzzy matches are score-penalized.
   */
  maxEditDistance?: number;
  /** Bias/filter results by proximity to this point. */
  near?: GeoPoint | null;
  /** When set with `near`, drop results beyond this many miles. */
  radiusMiles?: number;
}

export interface SearchResult {
  id: string;
  /** BM25 relevance score (higher = more relevant). */
  score: number;
  /** Present when `near` was supplied and the record has a location. */
  distanceMiles?: number;
}

export interface Suggestion {
  id: string;
  /** The matched completion term that produced this suggestion. */
  term: string;
  score: number;
}

/** Serialized index shape: the "compact prebuilt artifact" shipped to clients. */
export interface SerializedIndex {
  version: 1;
  options: Required<SearchEngineOptions>;
  totalDocs: number;
  avgDocLength: number;
  /** docId -> weighted document length. */
  docLengths: Record<string, number>;
  /** term -> (docId -> weighted term frequency). */
  postings: Record<string, Record<string, number>>;
  /** docId -> geohash (omitted when the doc has no location). */
  geohashes: Record<string, string>;
  /** docId -> [lat, lng] for precise distance (omitted when no location). */
  coordinates: Record<string, [number, number]>;
}

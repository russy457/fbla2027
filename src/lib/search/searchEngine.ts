/**
 * @file searchEngine.ts
 * @description The in-house search engine (ported from the old app). Composes the classic data
 * structures into one queryable unit:
 *
 *   build()   tokenize every field -> weighted inverted index + trie + geohash
 *   search()  tokenize query -> gather postings (+ fuzzy expansion) -> BM25
 *             rank -> optional geo filter -> top N
 *   suggest() trie prefix walk -> ranked completions (replaces fuse.js)
 *   serialize()/deserialize()  compact artifact for the client-side index
 *
 *           ┌────────── build ──────────┐        ┌──────── query ────────┐
 *   records │ tokenize -> weighted TF   │ index  │ tokenize -> postings   │ ranked
 *   ───────▶│ inverted index + trie     │ ──────▶│ + fuzzy -> BM25 -> geo │ ──────▶ ids
 *           │ + geohash per location    │        │ -> sort -> limit       │
 *           └───────────────────────────┘        └────────────────────────┘
 */

import { InvertedIndex } from "./invertedIndex";
import { Trie } from "./trie";
import { bm25TermScore } from "./bm25";
import { DEFAULT_K1, DEFAULT_B } from "./bm25";
import { withinEditDistance } from "./levenshtein";
import { encodeGeohash, haversineMiles } from "./geo";
import { tokenize, termFrequencies } from "./tokenize";
import type {
  GeoPoint,
  SearchableRecord,
  SearchEngineOptions,
  SearchOptions,
  SearchResult,
  Suggestion,
  SerializedIndex
} from "./types";

/** Score multiplier applied to fuzzy (typo) matches so exact matches win. */
const FUZZY_PENALTY = 0.55;
const DEFAULT_LIMIT = 24;
const GEOHASH_PRECISION = 7;

const resolveOptions = (options?: SearchEngineOptions): Required<SearchEngineOptions> => ({
  fieldWeights: options?.fieldWeights ?? {},
  k1: options?.k1 ?? DEFAULT_K1,
  b: options?.b ?? DEFAULT_B
});

export class SearchEngine {
  private readonly index: InvertedIndex;
  private readonly trie: Trie;
  private readonly geohashes: Map<string, string>;
  private readonly coordinates: Map<string, GeoPoint>;
  private readonly options: Required<SearchEngineOptions>;

  private constructor(
    index: InvertedIndex,
    trie: Trie,
    geohashes: Map<string, string>,
    coordinates: Map<string, GeoPoint>,
    options: Required<SearchEngineOptions>
  ) {
    this.index = index;
    this.trie = trie;
    this.geohashes = geohashes;
    this.coordinates = coordinates;
    this.options = options;
  }

  /** Build an index from records. O(total tokens). */
  static build(records: SearchableRecord[], options?: SearchEngineOptions): SearchEngine {
    const resolved = resolveOptions(options);
    const index = new InvertedIndex();
    const trie = new Trie();
    const geohashes = new Map<string, string>();
    const coordinates = new Map<string, GeoPoint>();

    for (const record of records) {
      const weighted = new Map<string, number>();
      for (const [field, text] of Object.entries(record.fields)) {
        const weight = resolved.fieldWeights[field] ?? 1;
        if (weight <= 0) continue;
        for (const [term, count] of termFrequencies(text)) {
          weighted.set(term, (weighted.get(term) ?? 0) + count * weight);
          trie.insert(term, record.id);
        }
      }
      index.addDocument(record.id, weighted);

      if (record.location && Number.isFinite(record.location.lat) && Number.isFinite(record.location.lng)) {
        geohashes.set(record.id, encodeGeohash(record.location.lat, record.location.lng, GEOHASH_PRECISION));
        coordinates.set(record.id, record.location);
      }
    }

    return new SearchEngine(index, trie, geohashes, coordinates, resolved);
  }

  /** Full-text relevance search. Returns IDs ranked by BM25 (+ optional geo). */
  search(query: string, opts: SearchOptions = {}): SearchResult[] {
    const queryTerms = unique(tokenize(query));
    const { near = null, radiusMiles, limit = DEFAULT_LIMIT } = opts;
    const fuzzy = opts.fuzzy ?? true;

    if (queryTerms.length === 0) return [];

    const scores = new Map<string, number>();
    for (const qTerm of queryTerms) {
      for (const { term, penalty } of this.matchTerms(qTerm, fuzzy, opts.maxEditDistance)) {
        const postings = this.index.getPostings(term);
        if (!postings) continue;
        const docFrequency = postings.size;
        for (const [docId, termFrequency] of postings) {
          const contribution = bm25TermScore({
            termFrequency,
            docLength: this.index.documentLength(docId),
            avgDocLength: this.index.averageDocLength,
            totalDocs: this.index.totalDocs,
            docFrequency,
            k1: this.options.k1,
            b: this.options.b
          }) * penalty;
          scores.set(docId, (scores.get(docId) ?? 0) + contribution);
        }
      }
    }

    const results: SearchResult[] = [];
    for (const [id, score] of scores) {
      const result: SearchResult = { id, score };
      if (near) {
        const point = this.coordinates.get(id);
        if (point) {
          result.distanceMiles = haversineMiles(near, point);
        } else if (radiusMiles !== undefined) {
          continue; // radius requested but this doc has no location -> exclude
        }
        if (radiusMiles !== undefined && result.distanceMiles !== undefined && result.distanceMiles > radiusMiles) {
          continue;
        }
      }
      results.push(result);
    }

    results.sort(compareResults);
    return results.slice(0, limit);
  }

  /** Autocomplete: rank document IDs whose terms complete `prefix`. */
  suggest(prefix: string, limit = 5): Suggestion[] {
    const normalized = normalizePrefix(prefix);
    if (!normalized) return [];

    const byDoc = new Map<string, { term: string; score: number }>();
    for (const completion of this.trie.completions(normalized)) {
      const extraChars = completion.term.length - normalized.length;
      // Shorter completions and more popular terms rank higher.
      const termScore = (completion.docIds.size) / (1 + extraChars);
      for (const docId of completion.docIds) {
        const existing = byDoc.get(docId);
        if (!existing || termScore > existing.score) {
          byDoc.set(docId, { term: completion.term, score: termScore });
        }
      }
    }

    return [...byDoc.entries()]
      .map(([id, { term, score }]): Suggestion => ({ id, term, score }))
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .slice(0, limit);
  }

  /** Expand a query term to (exact + fuzzy) index terms with score penalties. */
  private matchTerms(
    qTerm: string,
    fuzzy: boolean,
    maxEditDistanceOverride?: number
  ): Array<{ term: string; penalty: number }> {
    const matches: Array<{ term: string; penalty: number }> = [];
    const exact = this.index.getPostings(qTerm) !== null;
    if (exact) matches.push({ term: qTerm, penalty: 1 });

    if (fuzzy && qTerm.length >= 3) {
      const maxEdit = maxEditDistanceOverride ?? (qTerm.length >= 8 ? 2 : 1);
      for (const term of this.index.vocabulary()) {
        if (term === qTerm) continue; // exact already handled
        if (Math.abs(term.length - qTerm.length) > maxEdit) continue;
        if (withinEditDistance(qTerm, term, maxEdit)) {
          matches.push({ term, penalty: FUZZY_PENALTY });
        }
      }
    }
    return matches;
  }

  /** Serialize to the compact artifact shipped to the client. */
  serialize(): SerializedIndex {
    const postings: Record<string, Record<string, number>> = {};
    for (const [term, list] of this.index.entries()) {
      postings[term] = Object.fromEntries(list);
    }
    const docLengths: Record<string, number> = {};
    for (const [id, length] of this.index.documentLengths()) {
      docLengths[id] = length;
    }
    const geohashes: Record<string, string> = {};
    for (const [id, hash] of this.geohashes) geohashes[id] = hash;
    const coordinates: Record<string, [number, number]> = {};
    for (const [id, point] of this.coordinates) coordinates[id] = [point.lat, point.lng];

    return {
      version: 1,
      options: this.options,
      totalDocs: this.index.totalDocs,
      avgDocLength: this.index.averageDocLength,
      docLengths,
      postings,
      geohashes,
      coordinates
    };
  }

  /** Rebuild an engine from a serialized artifact (no re-tokenization). */
  static deserialize(data: SerializedIndex): SearchEngine {
    const index = new InvertedIndex();
    const trie = new Trie();

    // Regroup postings (term -> docId -> weight) into per-document term maps so
    // InvertedIndex recomputes its own length/avg stats, and rebuild the trie
    // from the same term -> docId pairs.
    const perDoc = new Map<string, Map<string, number>>();
    for (const [term, list] of Object.entries(data.postings)) {
      for (const [docId, weight] of Object.entries(list)) {
        trie.insert(term, docId);
        let docTerms = perDoc.get(docId);
        if (!docTerms) {
          docTerms = new Map();
          perDoc.set(docId, docTerms);
        }
        docTerms.set(term, weight);
      }
    }
    for (const [docId, docTerms] of perDoc) {
      index.addDocument(docId, docTerms);
    }

    const geohashes = new Map<string, string>(Object.entries(data.geohashes));
    const coordinates = new Map<string, GeoPoint>();
    for (const [id, [lat, lng]] of Object.entries(data.coordinates)) {
      coordinates.set(id, { lat, lng });
    }

    return new SearchEngine(index, trie, geohashes, coordinates, data.options);
  }
}

const unique = (items: string[]): string[] => [...new Set(items)];

const normalizePrefix = (prefix: string): string => {
  const tokens = tokenize(prefix);
  if (tokens.length === 0) {
    // tokenize drops <2 char fragments; fall back to a light manual normalize
    // so a 1-char prefix still autocompletes.
    return prefix.trim().toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  }
  return tokens[tokens.length - 1]!;
};

/** Deterministic ranking: score desc, then nearer, then id for stable order. */
const compareResults = (a: SearchResult, b: SearchResult): number => {
  if (b.score !== a.score) return b.score - a.score;
  const da = a.distanceMiles ?? Infinity;
  const db = b.distanceMiles ?? Infinity;
  if (da !== db) return da - db;
  return a.id.localeCompare(b.id);
};

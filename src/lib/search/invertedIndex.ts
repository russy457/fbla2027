/**
 * @file invertedIndex.ts
 * @description The inverted index: the heart of any full-text search engine.
 * Maps every term to the list of documents that contain it (a "posting list"),
 * along with the weighted term frequency used for BM25 scoring. Querying reads
 * only the posting lists for the query's terms: never the whole corpus: which
 * is exactly why this scales where "download everything and filter" does not.
 *
 *   postings:  term -> Map(docId -> weightedTf)
 *   docLength: docId -> Σ weighted token counts (for BM25 length norm)
 */

export class InvertedIndex {
  /** term -> (docId -> weighted term frequency) */
  private readonly postings = new Map<string, Map<string, number>>();
  /** docId -> weighted document length */
  private readonly docLengths = new Map<string, number>();

  /**
   * Add a document's weighted term frequencies. `weightedTerms` is term ->
   * weighted count (already multiplied by field weight by the caller). Adding
   * the same docId twice is treated as accumulation, so build once per doc.
   */
  addDocument(docId: string, weightedTerms: Map<string, number>): void {
    let length = this.docLengths.get(docId) ?? 0;
    for (const [term, weight] of weightedTerms) {
      let postingList = this.postings.get(term);
      if (!postingList) {
        postingList = new Map();
        this.postings.set(term, postingList);
      }
      postingList.set(docId, (postingList.get(docId) ?? 0) + weight);
      length += weight;
    }
    this.docLengths.set(docId, length);
  }

  /** Posting list for a term, or null if the term is unknown. */
  getPostings(term: string): Map<string, number> | null {
    return this.postings.get(term) ?? null;
  }

  /** Number of documents containing `term`. */
  documentFrequency(term: string): number {
    return this.postings.get(term)?.size ?? 0;
  }

  /** Weighted length of a document (0 if unknown). */
  documentLength(docId: string): number {
    return this.docLengths.get(docId) ?? 0;
  }

  get totalDocs(): number {
    return this.docLengths.size;
  }

  get averageDocLength(): number {
    if (this.docLengths.size === 0) return 0;
    let sum = 0;
    for (const length of this.docLengths.values()) sum += length;
    return sum / this.docLengths.size;
  }

  /** The full term vocabulary: used for fuzzy expansion. */
  vocabulary(): IterableIterator<string> {
    return this.postings.keys();
  }

  /** Iterate (docId, length) pairs: used when serializing. */
  documentLengths(): IterableIterator<[string, number]> {
    return this.docLengths.entries();
  }

  /** Iterate (term, postingList) pairs: used when serializing. */
  entries(): IterableIterator<[string, Map<string, number>]> {
    return this.postings.entries();
  }
}

/**
 * @file bm25.ts
 * @description BM25 (Okapi) relevance scoring: the ranking function modern
 * search engines use. It improves on raw TF-IDF with two tunables:
 *   k1: term-frequency saturation (a 10th occurrence adds less than the 2nd)
 *   b : document-length normalization (long docs don't win just by being long)
 *
 *   idf(t) = ln(1 + (N − df + 0.5) / (df + 0.5))
 *   score(t,d) = idf(t) · ( tf · (k1+1) ) / ( tf + k1·(1 − b + b·|d|/avgdl) )
 */

export const DEFAULT_K1 = 1.5;
export const DEFAULT_B = 0.75;

/**
 * Inverse document frequency. Rare terms (low df) score higher. The +0.5/+1
 * smoothing keeps idf positive even for terms in most documents.
 */
export const idf = (totalDocs: number, docFrequency: number): number => {
  if (totalDocs <= 0 || docFrequency <= 0) return 0;
  return Math.log(1 + (totalDocs - docFrequency + 0.5) / (docFrequency + 0.5));
};

/** BM25 contribution of a single term in a single document. */
export const bm25TermScore = (params: {
  termFrequency: number;
  docLength: number;
  avgDocLength: number;
  totalDocs: number;
  docFrequency: number;
  k1?: number;
  b?: number;
}): number => {
  const {
    termFrequency,
    docLength,
    avgDocLength,
    totalDocs,
    docFrequency,
    k1 = DEFAULT_K1,
    b = DEFAULT_B
  } = params;

  if (termFrequency <= 0) return 0;
  const inverseDf = idf(totalDocs, docFrequency);
  const lengthNorm = avgDocLength > 0 ? docLength / avgDocLength : 1;
  const denominator = termFrequency + k1 * (1 - b + b * lengthNorm);
  if (denominator === 0) return 0;
  return inverseDf * ((termFrequency * (k1 + 1)) / denominator);
};

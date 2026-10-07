/**
 * @file tokenize.ts
 * @description Text -> normalized tokens. This is the front door of the search
 * pipeline: indexing and querying MUST use the same tokenizer or terms won't
 * line up. Steps: lowercase -> split on non-alphanumeric -> drop stop words ->
 * drop very short tokens -> light suffix normalization (plural folding).
 */

/**
 * Common English stop words. Kept small and deliberate: removing too much hurts
 * recall on short names (e.g. "the food bank" -> "food bank").
 */
export const STOP_WORDS: ReadonlySet<string> = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "is",
  "it", "of", "on", "or", "that", "the", "to", "with"
]);

const MIN_TOKEN_LENGTH = 2;

/**
 * Very light stemmer: folds simple English plurals so "tacos" matches "taco".
 * Intentionally conservative: aggressive stemming (Porter) causes more wrong
 * matches than it fixes on short organization and shift names.
 */
export const normalizeToken = (token: string): string => {
  if (token.length > 3 && token.endsWith("ies")) {
    return `${token.slice(0, -3)}y`; // bakeries -> bakery
  }
  if (token.length > 3 && token.endsWith("es") && !token.endsWith("ses")) {
    return token.slice(0, -2); // dishes -> dish
  }
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) {
    return token.slice(0, -1); // tacos -> taco (but keep "less")
  }
  return token;
};

/**
 * Tokenize free text into normalized terms. Pure and deterministic.
 *
 *   tokenize("The Best Tacos!!! in Austin")  ->  ["best", "taco", "austin"]
 *
 * Unicode letters/numbers are preserved; everything else is a separator.
 */
export const tokenize = (text: string): string[] => {
  if (!text) return [];
  const lowered = text.toLowerCase();
  // Split on anything that is not a unicode letter or number.
  const rawTokens = lowered.split(/[^\p{L}\p{N}]+/u);
  const tokens: string[] = [];
  for (const raw of rawTokens) {
    if (raw.length < MIN_TOKEN_LENGTH) continue;
    if (STOP_WORDS.has(raw)) continue;
    tokens.push(normalizeToken(raw));
  }
  return tokens;
};

/**
 * Term-frequency map for a single field's text: term -> count. Used by the
 * inverted index when assembling weighted postings.
 */
export const termFrequencies = (text: string): Map<string, number> => {
  const freqs = new Map<string, number>();
  for (const token of tokenize(text)) {
    freqs.set(token, (freqs.get(token) ?? 0) + 1);
  }
  return freqs;
};

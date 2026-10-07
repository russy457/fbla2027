/**
 * highlight.ts
 * Splits plain text into segments marked "match" or not, so the UI can wrap
 * matched words in <mark> elements as React text nodes. Nothing here produces
 * HTML strings, which is why highlighting can never inject markup.
 *
 * A word matches when its normalized form (same tokenizer rules as search)
 * equals a matched term, or is within the same typo distance the search
 * engine allows (1 edit, 2 for terms of 8+ letters).
 */
import { STOP_WORDS, normalizeToken, withinEditDistance } from "@/lib/search";

export interface HighlightSegment {
  readonly text: string;
  readonly isMatch: boolean;
}

const MIN_FUZZY_LENGTH = 3;
const LONG_TERM_LENGTH = 8;

/** Mirrors SearchEngine's default fuzzy rule so highlights agree with ranking. */
const maxEditsFor = (term: string): number => (term.length >= LONG_TERM_LENGTH ? 2 : 1);

const wordMatches = (word: string, terms: readonly string[]): boolean => {
  const lowered = word.toLowerCase();
  if (lowered.length < 2 || STOP_WORDS.has(lowered)) return false;
  const normalized = normalizeToken(lowered);
  return terms.some(
    (term) =>
      term === normalized ||
      (term.length >= MIN_FUZZY_LENGTH &&
        Math.abs(term.length - normalized.length) <= maxEditsFor(term) &&
        withinEditDistance(term, normalized, maxEditsFor(term)))
  );
};

/**
 * "Check in at 9" with terms ["check"] ->
 *   [{text: "Check", isMatch: true}, {text: " in at 9", isMatch: false}]
 * Adjacent non-matching pieces are merged so the DOM stays small.
 */
export const splitHighlights = (text: string, terms: readonly string[]): readonly HighlightSegment[] => {
  if (terms.length === 0 || text.length === 0) return text ? [{ text, isMatch: false }] : [];

  // The capture group keeps the words in the split output, alternating with separators.
  const pieces = text.split(/([\p{L}\p{N}]+)/u).filter((piece) => piece.length > 0);
  return pieces.reduce<HighlightSegment[]>((segments, piece) => {
    const isMatch = /^[\p{L}\p{N}]+$/u.test(piece) && wordMatches(piece, terms);
    const previous = segments.at(-1);
    if (previous && !previous.isMatch && !isMatch) {
      return [...segments.slice(0, -1), { text: previous.text + piece, isMatch: false }];
    }
    return [...segments, { text: piece, isMatch }];
  }, []);
};

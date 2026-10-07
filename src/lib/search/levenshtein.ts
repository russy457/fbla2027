/**
 * @file levenshtein.ts
 * @description Classic edit-distance (Levenshtein) DP: the typo-tolerance
 * primitive. Algolia/Typesense give this for free; we implement it. Uses the
 * two-row optimization (O(min(m,n)) space) and a banded early-exit so callers
 * can ask "are these within k edits?" without computing the full matrix.
 *
 *   DP recurrence (rows = a, cols = b):
 *     d[i][j] = min(
 *       d[i-1][j]   + 1,            // deletion
 *       d[i][j-1]   + 1,            // insertion
 *       d[i-1][j-1] + (a[i]==b[j]?0:1) // substitution
 *     )
 */

/** Full Levenshtein distance between two strings. */
export const levenshtein = (a: string, b: string): number => {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Keep the shorter string as the inner (column) dimension for less memory.
  if (a.length > b.length) [a, b] = [b, a];

  // Indexes below are always inside 0..a.length, so the non-null assertions are safe.
  let prev = new Array<number>(a.length + 1);
  let curr = new Array<number>(a.length + 1);
  for (let i = 0; i <= a.length; i++) prev[i] = i;

  for (let j = 1; j <= b.length; j++) {
    curr[0] = j;
    const bChar = b.charCodeAt(j - 1);
    for (let i = 1; i <= a.length; i++) {
      const cost = a.charCodeAt(i - 1) === bChar ? 0 : 1;
      curr[i] = Math.min(prev[i]! + 1, curr[i - 1]! + 1, prev[i - 1]! + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[a.length]!;
};

/**
 * Fast "within k edits?" check. Short-circuits on the length difference and
 * bails out of a row once every cell exceeds `max`, so near-misses are cheap.
 */
export const withinEditDistance = (a: string, b: string, max: number): boolean => {
  if (max < 0) return false;
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > max) return false;

  if (a.length > b.length) [a, b] = [b, a];

  // Indexes below are always inside 0..a.length, so the non-null assertions are safe.
  let prev = new Array<number>(a.length + 1);
  let curr = new Array<number>(a.length + 1);
  for (let i = 0; i <= a.length; i++) prev[i] = i;

  for (let j = 1; j <= b.length; j++) {
    curr[0] = j;
    let rowMin = curr[0];
    const bChar = b.charCodeAt(j - 1);
    for (let i = 1; i <= a.length; i++) {
      const cost = a.charCodeAt(i - 1) === bChar ? 0 : 1;
      curr[i] = Math.min(prev[i]! + 1, curr[i - 1]! + 1, prev[i - 1]! + cost);
      if (curr[i]! < rowMin) rowMin = curr[i]!;
    }
    if (rowMin > max) return false; // whole row already exceeds the budget
    [prev, curr] = [curr, prev];
  }
  return prev[a.length]! <= max;
};

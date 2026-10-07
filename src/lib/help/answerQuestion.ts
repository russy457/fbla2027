/**
 * answerQuestion.ts
 * The Tier 0 assistant (SPEC 9.6 "Assistant panel", D7): a question is
 * answered by searching help articles, never by calling an AI model. The
 * answer is the top three matching articles, labeled "From Help Center",
 * which is also the documented fallback for the Tier 1 askAssistant op.
 *
 * Input length follows the AI input limit in SPEC 8.4 (2,000 characters) so
 * the Ask box behaves the same before and after the AI assistant ships. The
 * value is kept local because the shared config module is still being
 * reshaped; when it settles, read the limit from @fbla/shared instead.
 */
import type { HelpLibrary } from "./helpLibrary";
import type { HelpSearchHit } from "./types";

export const MAX_QUESTION_CHARS = 2000;
/** Show the character counter once the question is this close to the limit. */
export const COUNTER_THRESHOLD = Math.floor(MAX_QUESTION_CHARS * 0.9);
export const HELP_ANSWER_LABEL = "From Help Center";
const ANSWER_ARTICLE_COUNT = 3;

export type HelpAnswer =
  | { readonly kind: "empty-question" }
  | { readonly kind: "too-long"; readonly message: string }
  | { readonly kind: "no-match" }
  | { readonly kind: "articles"; readonly label: string; readonly hits: readonly HelpSearchHit[] };

/** Answer a question from the Help Center. Pure: same input, same answer. */
export const answerFromHelpCenter = (question: string, library: HelpLibrary): HelpAnswer => {
  const trimmed = question.trim();
  if (trimmed.length === 0) return { kind: "empty-question" };
  if (trimmed.length > MAX_QUESTION_CHARS) {
    // Same copy as the INPUT_TOO_LONG catalog entry (SPEC 10.10).
    return { kind: "too-long", message: "Keep it under 2,000 characters." };
  }
  // A trailing space tells search the last word is finished (no autocompletion).
  const hits = library.search(`${trimmed} `, { limit: ANSWER_ARTICLE_COUNT });
  return hits.length === 0 ? { kind: "no-match" } : { kind: "articles", label: HELP_ANSWER_LABEL, hits };
};

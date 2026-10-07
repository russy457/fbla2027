/**
 * retrieval.ts
 * Picks the help articles an assistant answer is grounded on (SPEC 8.4).
 *
 *   retrieveArticles(corpus, question)  top BM25 matches for the question,
 *                                       the same ranking as Help Center search
 *
 * The question is searched with a trailing space so the last word is treated
 * as finished (no search-as-you-type completions). The grounding set is the
 * top GROUNDING_ARTICLE_COUNT hits; the deterministic fallback shows the top
 * FALLBACK_ARTICLE_COUNT (SPEC: "top 3 BM25 help articles").
 */
import type { HelpArticle } from "../../../src/lib/help/types";
import type { HelpCorpus } from "./helpCorpus";

export const GROUNDING_ARTICLE_COUNT = 4;
export const FALLBACK_ARTICLE_COUNT = 3;

/** Most ranked articles for a question, best first (empty when nothing matches). */
export const retrieveArticles = (corpus: HelpCorpus, question: string, limit = GROUNDING_ARTICLE_COUNT): readonly HelpArticle[] =>
  corpus.searcher.search(`${question.trim()} `, { limit }).map((hit) => hit.article);

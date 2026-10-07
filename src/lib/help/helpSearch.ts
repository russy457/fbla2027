/**
 * helpSearch.ts
 * Help Center search (SPEC 8.5, PORT_LEDGER "helpAdapter"): adapts help
 * articles to the shared BM25 SearchEngine in src/lib/search and adds two
 * things the generic engine does not do on its own:
 *
 *   1. Field boosts. A word in the title counts 5x, a tag 3x, the summary 2x,
 *      the body 1x, so "kiosk" ranks the kiosk article above one that only
 *      mentions the kiosk in passing.
 *      On top of BM25, a hit whose title contains the typed words gets up to
 *      +50% (TITLE_COVERAGE_BOOST), because common words like "hours"
 *      have low BM25 weight yet a title match is still the best answer.
 *   2. Search as you type. If the last word looks unfinished ("chec"), its
 *      trie completions ("check", "checkin") are searched too at half weight,
 *      so results appear before the word is complete.
 *
 * Typo tolerance comes from the engine (Levenshtein expansion, penalized).
 */
// Relative (not "@/lib/search") so Cloud Functions can bundle this file for askAssistant retrieval.
import { STOP_WORDS, SearchEngine, tokenize, type SearchableRecord } from "../search";
import type { HelpArticle, HelpSearchHit } from "./types";

/** Per-field term-frequency multipliers (title and tag boosts). */
export const HELP_FIELD_WEIGHTS = Object.freeze({ title: 5, tags: 3, slug: 2, summary: 2, body: 1 });

/** Completions of an unfinished last word count half as much as typed words. */
const COMPLETION_WEIGHT = 0.5;
const MAX_COMPLETIONS = 8;
const MIN_PREFIX_LENGTH = 2;
const DEFAULT_RESULT_LIMIT = 10;
/** Maximum extra share of score for a title containing every typed word. */
const TITLE_COVERAGE_BOOST = 0.5;

/** Fraction (0 to 1) of typed terms that appear in the title. */
const titleCoverage = (title: string, typedTerms: ReadonlySet<string>): number => {
  const titleTerms = new Set(tokenize(title));
  const covered = [...typedTerms].filter((term) => titleTerms.has(term)).length;
  return covered / typedTerms.size;
};

/** Remove Markdown link targets so URLs like "/help/kiosk-check-in" don't add fake words. */
const stripLinkTargets = (markdown: string): string => markdown.replace(/\]\([^)]*\)/g, "]");

/** Adapter: one HelpArticle -> one generic SearchableRecord. */
export const toSearchableRecord = (article: HelpArticle): SearchableRecord => ({
  id: article.slug,
  fields: {
    title: article.title,
    tags: article.tags.join(" "),
    slug: article.slug.replace(/-/g, " "),
    summary: article.summary,
    body: stripLinkTargets(article.body)
  }
});

export interface HelpSearchOptions {
  readonly limit?: number;
}

export interface HelpSearcher {
  search(query: string, options?: HelpSearchOptions): readonly HelpSearchHit[];
}

/**
 * The last word of the query if the user is still typing it (no trailing
 * space). Stop words are never completed: "check in" must not expand "in"
 * to "inside" and "into", which would flood results with noise.
 */
const unfinishedLastWord = (query: string): string | null => {
  if (/\s$/.test(query)) return null;
  const words = query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const last = words.at(-1);
  if (last === undefined || last.length < MIN_PREFIX_LENGTH || STOP_WORDS.has(last)) return null;
  return last;
};

/** Build a searcher over a fixed article list. The index is built once here. */
export const createHelpSearcher = (articles: readonly HelpArticle[]): HelpSearcher => {
  const engine = SearchEngine.build(articles.map(toSearchableRecord), { fieldWeights: HELP_FIELD_WEIGHTS });
  const bySlug = new Map(articles.map((article) => [article.slug, article]));
  const everyResult = { limit: articles.length };

  /** Completion terms for an unfinished last word, excluding words already typed. */
  const completionTerms = (query: string, typedTerms: ReadonlySet<string>): readonly string[] => {
    const prefix = unfinishedLastWord(query);
    if (!prefix) return [];
    const terms = engine.suggest(prefix, MAX_COMPLETIONS).map((suggestion) => suggestion.term);
    return [...new Set(terms)].filter((term) => !typedTerms.has(term));
  };

  const search = (query: string, options: HelpSearchOptions = {}): readonly HelpSearchHit[] => {
    const typedTerms = new Set(tokenize(query));
    if (typedTerms.size === 0) return [];

    const scores = new Map<string, number>();
    for (const hit of engine.search(query, everyResult)) scores.set(hit.id, hit.score);

    const completions = completionTerms(query, typedTerms);
    if (completions.length > 0) {
      // Exact matches only: the completions are real index terms already.
      for (const hit of engine.search(completions.join(" "), { ...everyResult, fuzzy: false })) {
        scores.set(hit.id, (scores.get(hit.id) ?? 0) + hit.score * COMPLETION_WEIGHT);
      }
    }

    const matchedTerms = Object.freeze([...typedTerms, ...completions]);
    return [...scores.entries()]
      .flatMap(([slug, score]): HelpSearchHit[] => {
        const article = bySlug.get(slug);
        if (!article) return [];
        const boosted = score * (1 + TITLE_COVERAGE_BOOST * titleCoverage(article.title, typedTerms));
        return [{ article, score: boosted, matchedTerms }];
      })
      .sort((a, b) => b.score - a.score || a.article.title.localeCompare(b.article.title))
      .slice(0, options.limit ?? DEFAULT_RESULT_LIMIT);
  };

  return Object.freeze({ search });
};

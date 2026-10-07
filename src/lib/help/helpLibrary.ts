/**
 * helpLibrary.ts
 * One object that bundles everything the Help UI needs: the article list,
 * lookup by slug, BM25 search, route suggestions, and grouping by audience.
 * Components receive a HelpLibrary (tests pass a small fixture library; the
 * app uses getHelpLibrary(), which parses and indexes the bundled articles
 * once, the first time help is opened).
 */
import { createHelpSearcher, type HelpSearchOptions } from "./helpSearch";
import { loadHelpArticles } from "./loadArticles";
import { suggestedSlugsForRoute } from "./routeContext";
import type { HelpArticle, HelpRole, HelpSearchHit } from "./types";

export interface HelpLibrary {
  readonly articles: readonly HelpArticle[];
  getArticle(slug: string): HelpArticle | undefined;
  search(query: string, options?: HelpSearchOptions): readonly HelpSearchHit[];
  /** Articles suggested for a browser path; unknown slugs are skipped. */
  suggestionsFor(pathname: string): readonly HelpArticle[];
  /** Articles whose primary audience is `role` (the first role listed). */
  byPrimaryRole(role: HelpRole): readonly HelpArticle[];
}

export const createHelpLibrary = (articles: readonly HelpArticle[]): HelpLibrary => {
  const bySlug = new Map(articles.map((article) => [article.slug, article]));
  const searcher = createHelpSearcher(articles);
  const resolve = (slugs: readonly string[]): readonly HelpArticle[] =>
    slugs.flatMap((slug) => {
      const article = bySlug.get(slug);
      return article ? [article] : [];
    });

  return Object.freeze({
    articles,
    getArticle: (slug: string) => bySlug.get(slug),
    search: (query: string, options?: HelpSearchOptions) => searcher.search(query, options),
    suggestionsFor: (pathname: string) => resolve(suggestedSlugsForRoute(pathname)),
    byPrimaryRole: (role: HelpRole) => articles.filter((article) => article.roles[0] === role)
  });
};

let cachedLibrary: HelpLibrary | null = null;

/** The app-wide library over the bundled articles, built lazily and reused. */
export const getHelpLibrary = (): HelpLibrary => {
  cachedLibrary ??= createHelpLibrary(loadHelpArticles());
  return cachedLibrary;
};

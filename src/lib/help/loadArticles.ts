/**
 * loadArticles.ts
 * Bundles every src/content/help/*.md file into the app at build time with
 * Vite's import.meta.glob (raw text, eager), then parses them. SPEC 8.5
 * describes a separate build step that writes index.json; bundling the raw
 * Markdown achieves the same result (articles ship with the app, the BM25
 * index is built once at load) without a new script.
 *
 * Articles are sorted by title so browse lists are stable. Duplicate slugs or
 * related links to missing articles throw, so content mistakes fail tests.
 */
import { parseArticle } from "./parseArticle";
import type { HelpArticle } from "./types";

const RAW_ARTICLES = import.meta.glob<string>("../../content/help/*.md", {
  query: "?raw",
  import: "default",
  eager: true
});

/** Throws if two articles share a slug or a related link points nowhere. */
export const assertArticleSetIsConsistent = (articles: readonly HelpArticle[]): void => {
  const slugs = new Set<string>();
  for (const article of articles) {
    if (slugs.has(article.slug)) throw new Error(`Duplicate help article slug "${article.slug}".`);
    slugs.add(article.slug);
  }
  for (const article of articles) {
    const missing = article.related.filter((slug) => !slugs.has(slug));
    if (missing.length > 0) {
      throw new Error(`Help article "${article.slug}" links to missing article(s): ${missing.join(", ")}.`);
    }
  }
};

/** Parse a map of {path: raw markdown} into a sorted, validated article list. */
export const parseArticleFiles = (files: Readonly<Record<string, string>>): readonly HelpArticle[] => {
  const articles = Object.entries(files)
    .map(([path, raw]) => parseArticle(raw, path))
    .sort((a, b) => a.title.localeCompare(b.title));
  assertArticleSetIsConsistent(articles);
  return Object.freeze(articles);
};

/** All bundled help articles. */
export const loadHelpArticles = (): readonly HelpArticle[] => parseArticleFiles(RAW_ARTICLES);

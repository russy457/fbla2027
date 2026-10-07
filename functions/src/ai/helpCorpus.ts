/**
 * helpCorpus.ts
 * The help articles the assistant is grounded on (SPEC 8.4, 8.5). The source
 * of truth is src/content/help/*.md, the same files the web Help Center
 * bundles. scripts/build-functions.mjs copies them to functions-dist/help/;
 * tests and local scripts read them straight from src/content/help.
 *
 * Parsing and BM25 search reuse the web app's pure modules
 * (src/lib/help/parseArticle.ts, helpSearch.ts, src/lib/search), so the
 * server ranks articles exactly as the Help Center search box does.
 *
 * The corpus is read once per Functions instance and cached.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createHelpSearcher, type HelpSearcher } from "../../../src/lib/help/helpSearch";
import { parseArticle } from "../../../src/lib/help/parseArticle";
import type { HelpArticle } from "../../../src/lib/help/types";

export interface HelpCorpus {
  readonly articles: readonly HelpArticle[];
  readonly searcher: HelpSearcher;
  getArticle(slug: string): HelpArticle | undefined;
}

/** Builds a corpus from already parsed articles (tests pass small fixtures). */
export const createHelpCorpus = (articles: readonly HelpArticle[]): HelpCorpus => {
  const bySlug = new Map(articles.map((article) => [article.slug, article]));
  return Object.freeze({ articles, searcher: createHelpSearcher(articles), getArticle: (slug: string) => bySlug.get(slug) });
};

/** Reads and parses every .md file in `dir`. Throws naming the file on bad content. */
export const readHelpArticles = (dir: string): readonly HelpArticle[] =>
  readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => parseArticle(readFileSync(join(dir, name), "utf8"), name));

/**
 * Where the articles live at runtime, first match wins:
 *   HELP_CONTENT_DIR (override), <bundle>/../help (deploy dir), ./help
 *   (Functions working directory), ./src/content/help (repo root: tests, scripts).
 */
export const helpContentCandidates = (env: Readonly<Record<string, string | undefined>>, cwd: string, bundleDir: string | null): string[] =>
  [env.HELP_CONTENT_DIR, bundleDir === null ? undefined : join(bundleDir, "..", "help"), join(cwd, "help"), join(cwd, "src", "content", "help")].filter(
    (dir): dir is string => typeof dir === "string" && dir.length > 0
  );

/** __dirname exists in the CommonJS Functions bundle, not in ESM test runs. */
const bundleDir = (): string | null => (typeof __dirname === "string" ? __dirname : null);

let cached: HelpCorpus | null = null;

/** The production corpus, loaded on first use. Throws if no article folder is found. */
export const getHelpCorpus = (): HelpCorpus => {
  if (cached) return cached;
  const dir = helpContentCandidates(process.env, process.cwd(), bundleDir()).find((candidate) => existsSync(candidate));
  if (!dir) throw new Error("help articles not found; run npm run build:functions (copies src/content/help to functions-dist/help)");
  cached = createHelpCorpus(readHelpArticles(dir));
  return cached;
};

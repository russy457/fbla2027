/**
 * types.ts
 * Shared types for the Help Center (SPEC#subsystems 8.5 "Search and help").
 * A HelpArticle is one parsed Markdown file from src/content/help. Everything
 * here is readonly because articles are static content loaded once per page
 * load; nothing in the app should edit them after parsing.
 */

/** Who an article is written for. "all" means visitors, volunteers, and coordinators. */
export type HelpRole = "volunteer" | "coordinator" | "all";

export const HELP_ROLES: readonly HelpRole[] = Object.freeze(["volunteer", "coordinator", "all"]);

export interface HelpArticle {
  /** URL-safe id, also the file name and the error catalog helpSlug. */
  readonly slug: string;
  readonly title: string;
  /** One-sentence description shown in result lists. */
  readonly summary: string;
  /** Extra search keywords (boosted in ranking). */
  readonly tags: readonly string[];
  readonly roles: readonly HelpRole[];
  /** Slugs listed under the article's trailing "Related articles" heading. */
  readonly related: readonly string[];
  /** Markdown body with the front matter and related list removed. */
  readonly body: string;
}

/** One ranked search hit plus the terms that matched (used for highlighting). */
export interface HelpSearchHit {
  readonly article: HelpArticle;
  readonly score: number;
  /** Normalized query terms (and autocompletions) that produced this hit. */
  readonly matchedTerms: readonly string[];
}

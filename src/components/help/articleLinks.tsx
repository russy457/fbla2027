/**
 * articleLinks.tsx
 * Help lists are shared by the full Help page and the slide-over panel, but
 * "opening" an article differs: the page navigates to /help/:slug, while the
 * panel swaps the article in place so the user keeps their screen. Lists
 * take a RenderArticleLink function so each host decides how a link behaves.
 */
import type { ReactElement, ReactNode } from "react";
import { Link } from "react-router-dom";
import type { HelpArticle } from "@/lib/help";

export type RenderArticleLink = (article: HelpArticle, content: ReactNode, className: string) => ReactElement;

/** URL of an article's full page. */
export const articlePath = (slug: string): string => `/help/${encodeURIComponent(slug)}`;

/** Default renderer: a router link to the article's own page. */
export const renderPageArticleLink: RenderArticleLink = (article, content, className) => (
  <Link to={articlePath(article.slug)} className={className}>
    {content}
  </Link>
);

/** Plain-language audience label shown next to titles. */
export const audienceLabel = (article: HelpArticle): string => {
  const primary = article.roles[0];
  if (primary === "coordinator") return "For coordinators";
  if (primary === "volunteer") return "For volunteers";
  return "For everyone";
};

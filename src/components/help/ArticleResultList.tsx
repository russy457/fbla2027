/**
 * ArticleResultList.tsx
 * An ordered list of help articles (search hits or suggestions). Each row is
 * one large link target: highlighted title, plain-text summary, and the
 * audience label. Rows are separated by hairlines rather than boxed cards so
 * the list reads like an index.
 */
import type { ReactElement } from "react";
import { CaretRight } from "@phosphor-icons/react";
import type { HelpArticle } from "@/lib/help";
import { audienceLabel, renderPageArticleLink, type RenderArticleLink } from "./articleLinks";
import { HighlightedText } from "./HighlightedText";

interface ArticleResultListProps {
  readonly articles: readonly HelpArticle[];
  /** Terms to highlight; empty for suggestions. */
  readonly terms?: readonly string[];
  readonly renderLink?: RenderArticleLink;
  /** Accessible name for the list, e.g. "Search results". */
  readonly label: string;
  /** Compact rows (no summary) for the narrow panel. */
  readonly compact?: boolean;
}

const ROW_CLASS =
  "group flex min-h-touch w-full items-start gap-3 py-4 text-left transition-colors duration-(--duration-fast) " +
  "hover:bg-surface-sunken focus-visible:bg-surface-sunken -mx-2 px-2 rounded-md";

export const ArticleResultList = ({
  articles,
  terms = [],
  renderLink = renderPageArticleLink,
  label,
  compact = false
}: ArticleResultListProps): ReactElement => (
  <ol aria-label={label} className="flex flex-col divide-y divide-border">
    {articles.map((article) => (
      <li key={article.slug}>
        {renderLink(
          article,
          <>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-base font-semibold text-fg group-hover:text-accent">
                <HighlightedText text={article.title} terms={terms} />
              </span>
              {compact ? null : (
                <span className="text-sm text-fg-muted">
                  <HighlightedText text={article.summary} terms={terms} />
                </span>
              )}
              <span className="text-xs font-medium text-fg-subtle">{audienceLabel(article)}</span>
            </span>
            <CaretRight
              aria-hidden="true"
              size={18}
              className="mt-1 shrink-0 text-fg-subtle transition-transform duration-(--duration-fast) group-hover:translate-x-0.5"
            />
          </>,
          ROW_CLASS
        )}
      </li>
    ))}
  </ol>
);

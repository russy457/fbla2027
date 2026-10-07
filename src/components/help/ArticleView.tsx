/**
 * ArticleView.tsx
 * One help article: audience label, title, summary lead, the body rendered
 * by the safe MarkdownView, and the related-articles list. Used full-page at
 * /help/:slug (title is the page h1) and inside the quick help panel (title
 * is an h3 under the panel's h2), which `titleLevel` controls.
 */
import { useMemo, type ReactElement } from "react";
import { parseMarkdown, type HelpArticle, type HelpLibrary } from "@/lib/help";
import { ArticleResultList } from "./ArticleResultList";
import { audienceLabel, renderPageArticleLink, type RenderArticleLink } from "./articleLinks";
import { MarkdownView } from "./MarkdownView";
import { PageHeader } from "@/components/ui/PageHeader";

interface ArticleViewProps {
  readonly article: HelpArticle;
  readonly library: HelpLibrary;
  readonly titleLevel?: 1 | 3;
  readonly renderLink?: RenderArticleLink;
}

export const ArticleView = ({
  article,
  library,
  titleLevel = 1,
  renderLink = renderPageArticleLink
}: ArticleViewProps): ReactElement => {
  const blocks = useMemo(() => parseMarkdown(article.body), [article.body]);
  const related = useMemo(
    () => article.related.flatMap((slug) => library.getArticle(slug) ?? []),
    [article.related, library]
  );
  const Title = titleLevel === 1 ? "h1" : "h3";
  const SubHeading = titleLevel === 1 ? "h2" : "h4";
  const titleId = `help-article-${article.slug}`;

  return (
    <article aria-labelledby={titleId} className="flex max-w-[68ch] flex-col">
      {titleLevel === 1 ? (
        <PageHeader id={titleId} title={article.title}>{article.summary}</PageHeader>
      ) : (
        <>
          <p className="text-sm font-medium text-fg-subtle">{audienceLabel(article)}</p>
          <Title id={titleId} className="mt-1 text-xl font-semibold tracking-tight text-fg">{article.title}</Title>
          <p className="mt-3 text-lg text-fg-muted">{article.summary}</p>
        </>
      )}
      <div className="mt-6 border-t border-border pt-6">
        <MarkdownView blocks={blocks} headingOffset={titleLevel === 1 ? 0 : 1} />
      </div>
      {related.length > 0 ? (
        <nav aria-labelledby={`${titleId}-related`} className="mt-10 border-t border-border pt-6">
          <SubHeading id={`${titleId}-related`} className="text-sm font-semibold text-fg">
            Related articles
          </SubHeading>
          <div className="mt-2">
            <ArticleResultList articles={related} renderLink={renderLink} label="Related articles" compact />
          </div>
        </nav>
      ) : null}
    </article>
  );
};

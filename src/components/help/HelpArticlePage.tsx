/**
 * HelpArticlePage.tsx
 * Full-page view of one article at /help/:slug. The slug comes from the URL,
 * so it is only ever used as a Map key (never rendered as HTML or used to
 * build a file path). Unknown slugs get a plain "not found" message with a
 * way back to the topic list instead of an error screen.
 */
import type { ReactElement } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { buttonClassName } from "@/components/ui/buttonStyles";
import type { HelpLibrary } from "@/lib/help";
import { ArticleView } from "./ArticleView";

interface HelpArticlePageProps {
  readonly library: HelpLibrary;
  readonly slug: string;
}

const BackToTopics = (): ReactElement => (
  <Link to="/help" className={buttonClassName("quiet", "-ml-3 self-start")}>
    <ArrowLeft aria-hidden="true" size={16} />
    All help topics
  </Link>
);

export const HelpArticlePage = ({ library, slug }: HelpArticlePageProps): ReactElement => {
  const article = library.getArticle(slug);

  if (!article) {
    return (
      <section aria-labelledby="help-missing-title" className="flex max-w-2xl flex-col gap-4">
        <BackToTopics />
        <h1 id="help-missing-title" className="text-3xl font-semibold tracking-tight text-fg">
          We couldn't find that article
        </h1>
        <p className="text-lg text-fg-muted">The link may be old. Search the Help Center or browse its topics.</p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <BackToTopics />
      <ArticleView article={article} library={library} />
    </div>
  );
};

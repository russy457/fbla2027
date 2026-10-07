/**
 * AssistantAnswerView.tsx
 * Renders one ai.askAssistant answer (SPEC 9.6, D7): the source label ("AI
 * answer, may be wrong" or "From Help Center"), the answer as plain text,
 * and the cited help articles as links. The answer is a React text node, so
 * any markup the model produced is shown literally, never interpreted (G16).
 * Cited slugs that are not bundled articles are dropped.
 */
import type { ReactElement } from "react";
import { BookOpenText, Sparkle } from "@phosphor-icons/react";
import type { AskAssistantOutput } from "@fbla/shared";
import { HELP_ANSWER_LABEL, type HelpArticle, type HelpLibrary } from "@/lib/help";
import { cn } from "@/lib/cn";
import { ArticleResultList } from "./ArticleResultList";
import type { RenderArticleLink } from "./articleLinks";

export const AI_ANSWER_LABEL = "AI answer, may be wrong";

interface AssistantAnswerViewProps {
  readonly result: AskAssistantOutput;
  readonly library: HelpLibrary;
  readonly renderLink: RenderArticleLink;
}

export const AssistantAnswerView = ({ result, library, renderLink }: AssistantAnswerViewProps): ReactElement => {
  const isAi = result.source === "ai";
  const articles = result.articles.flatMap((cited): HelpArticle[] => {
    const article = library.getArticle(cited.slug);
    return article ? [article] : [];
  });
  return (
    <div className="flex flex-col gap-2" data-testid="assistant-answer">
      <p
        className={cn(
          "inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-xs font-semibold",
          isAi ? "bg-status-warning-subtle text-status-warning" : "bg-accent-subtle text-accent"
        )}
      >
        {isAi ? <Sparkle aria-hidden="true" size={14} weight="bold" /> : <BookOpenText aria-hidden="true" size={14} weight="bold" />}
        {isAi ? AI_ANSWER_LABEL : HELP_ANSWER_LABEL}
      </p>
      <p className={cn("whitespace-pre-line text-sm", result.limited ? "font-semibold text-fg" : "text-fg")}>{result.answer}</p>
      {articles.length > 0 ? (
        <>
          <p className="text-xs font-semibold text-fg-muted">{isAi ? "Sources" : "Matching articles"}</p>
          <ArticleResultList articles={articles} renderLink={renderLink} label="Cited help articles" compact />
        </>
      ) : null}
    </div>
  );
};

/**
 * HelpCenterAnswer.tsx
 * The local, deterministic answer (SPEC 8.4 fallback, D7): the top Help
 * Center articles for a question, labeled "From Help Center", or the empty,
 * too-long, and no-match messages. `notice` explains why the server
 * assistant was not used (for example a lost connection).
 */
import type { ReactElement } from "react";
import { BookOpenText } from "@phosphor-icons/react";
import type { HelpAnswer } from "@/lib/help";
import { ArticleResultList } from "./ArticleResultList";
import type { RenderArticleLink } from "./articleLinks";

interface HelpCenterAnswerProps {
  readonly answer: HelpAnswer;
  readonly notice: string | null;
  readonly renderLink: RenderArticleLink;
}

const AnswerBody = ({ answer, renderLink }: { answer: HelpAnswer; renderLink: RenderArticleLink }): ReactElement => {
  if (answer.kind === "articles") {
    return (
      <div className="flex flex-col gap-2">
        <p className="inline-flex items-center gap-1.5 self-start rounded-full bg-accent-subtle px-2.5 py-1 text-xs font-semibold text-accent">
          <BookOpenText aria-hidden="true" size={14} weight="bold" />
          {answer.label}
        </p>
        <p className="text-sm text-fg">These articles answer questions like yours:</p>
        <ArticleResultList
          articles={answer.hits.map((hit) => hit.article)}
          terms={answer.hits[0]?.matchedTerms ?? []}
          renderLink={renderLink}
          label="Suggested answers"
          compact
        />
      </div>
    );
  }
  if (answer.kind === "empty-question") return <p className="text-sm text-fg">Type a question first, for example "when does check-in open".</p>;
  if (answer.kind === "too-long") return <p className="text-sm font-semibold text-status-danger">{answer.message}</p>;
  return (
    <p className="text-sm text-fg">
      <span className="font-semibold">No articles match.</span> Try other words, or browse the topics.
    </p>
  );
};

export const HelpCenterAnswer = ({ answer, notice, renderLink }: HelpCenterAnswerProps): ReactElement => (
  <div className="flex flex-col gap-3">
    {notice ? <p className="text-sm font-semibold text-status-warning">{notice} Here are matching help articles instead.</p> : null}
    <AnswerBody answer={answer} renderLink={renderLink} />
  </div>
);

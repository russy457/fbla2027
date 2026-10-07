/**
 * AssistantPanel.tsx
 * The "Ask a question" box (SPEC 9.6, D7). In Tier 0 every answer comes from
 * Help Center search and is labeled "From Help Center"; no AI is called. A
 * note says the AI assistant is coming soon and needs sign-in. The question
 * counter appears near the 2,000-character limit, and answers are announced
 * through a polite live region. Answers are plain text plus article links.
 */
import { useId, useState, type FormEvent, type ReactElement } from "react";
import { BookOpenText, Sparkle } from "@phosphor-icons/react";
import { buttonClassName } from "@/components/ui/buttonStyles";
import {
  answerFromHelpCenter,
  COUNTER_THRESHOLD,
  MAX_QUESTION_CHARS,
  type HelpAnswer,
  type HelpLibrary
} from "@/lib/help";
import { ArticleResultList } from "./ArticleResultList";
import { renderPageArticleLink, type RenderArticleLink } from "./articleLinks";

interface AssistantPanelProps {
  readonly library: HelpLibrary;
  readonly renderLink?: RenderArticleLink;
  /** Heading level so the section nests under the host's headings. */
  readonly headingLevel?: 2 | 3;
}

const numberFormat = new Intl.NumberFormat("en-US");

const AnswerView = ({ answer, renderLink }: { answer: HelpAnswer; renderLink: RenderArticleLink }) => {
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
  if (answer.kind === "empty-question") {
    return <p className="text-sm text-fg">Type a question first, for example "when does check-in open".</p>;
  }
  if (answer.kind === "too-long") {
    return <p className="text-sm font-semibold text-status-danger">{answer.message}</p>;
  }
  if (answer.kind === "no-match") {
    return (
      <p className="text-sm text-fg">
        <span className="font-semibold">No articles match.</span> Try other words, or browse the topics.
      </p>
    );
  }
  // Exhaustive: every HelpAnswer kind is handled above.
  return null;
};

export const AssistantPanel = ({
  library,
  renderLink = renderPageArticleLink,
  headingLevel = 2
}: AssistantPanelProps): ReactElement => {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<HelpAnswer | null>(null);
  const baseId = useId();
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const isTooLong = question.length > MAX_QUESTION_CHARS;
  const showCounter = question.length >= COUNTER_THRESHOLD;
  const errorId = `${baseId}-error`;
  const counterId = `${baseId}-counter`;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAnswer(answerFromHelpCenter(question, library));
  };

  return (
    <section aria-labelledby={`${baseId}-title`} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Heading id={`${baseId}-title`} className="text-lg font-semibold tracking-tight text-fg">
          Ask a question
        </Heading>
        <p className="text-sm text-fg-muted">Answers come from Help Center articles.</p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-2">
        <label htmlFor={`${baseId}-question`} className="text-sm font-semibold text-fg">
          Your question
        </label>
        <textarea
          id={`${baseId}-question`}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={3}
          aria-invalid={isTooLong || undefined}
          aria-describedby={[showCounter ? counterId : "", isTooLong ? errorId : ""].join(" ").trim() || undefined}
          className="min-h-24 w-full resize-y rounded-md border border-border-strong bg-surface px-3 py-2 text-base text-fg aria-invalid:border-status-danger"
        />
        {showCounter ? (
          <p id={counterId} className={isTooLong ? "text-sm font-semibold text-status-danger" : "text-sm text-fg-muted"}>
            {numberFormat.format(question.length)} of {numberFormat.format(MAX_QUESTION_CHARS)} characters
          </p>
        ) : null}
        {isTooLong ? (
          <p id={errorId} role="alert" className="text-sm font-semibold text-status-danger">
            Keep it under 2,000 characters.
          </p>
        ) : null}
        <button type="submit" disabled={isTooLong} className={buttonClassName("primary", "self-start")}>
          Ask
        </button>
      </form>

      <div aria-live="polite" className="empty:hidden">
        {answer ? <AnswerView answer={answer} renderLink={renderLink} /> : null}
      </div>

      <p className="flex items-start gap-2 border-t border-border pt-4 text-sm text-fg-muted">
        <Sparkle aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
        <span>Sign in to ask the AI assistant (coming soon).</span>
      </p>
    </section>
  );
};

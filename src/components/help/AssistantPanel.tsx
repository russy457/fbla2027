/**
 * AssistantPanel.tsx
 * The "Ask a question" box (SPEC 9.6, D7), on /help and in the Quick help
 * slide-over (header button or the "?" key), so it is reachable from any page.
 *
 *   signed in + finished profile   asks ai.askAssistant: an answer grounded on
 *                                  help articles, labeled "AI answer, may be
 *                                  wrong" (or "From Help Center" when the
 *                                  server fell back), with cited article links
 *   everyone else                  answers locally from Help Center search
 *                                  (top 3 articles) plus "Sign in to ask" or
 *                                  "Finish your profile" as the way forward
 *
 * If the call fails (offline, rate limited) the local answer is shown with
 * the error, so a question is never left unanswered. The counter appears
 * near the 2,000-character limit, answers are announced through a polite
 * live region, and every answer is plain text (G16).
 */
import { useId, useState, type FormEvent, type ReactElement } from "react";
import { Sparkle } from "@phosphor-icons/react";
import { Link, useLocation } from "react-router-dom";
import type { AskAssistantOutput, OpInput } from "@fbla/shared";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { api, toApiUserError } from "@/lib/api";
import { answerFromHelpCenter, COUNTER_THRESHOLD, MAX_QUESTION_CHARS, type HelpAnswer, type HelpLibrary } from "@/lib/help";
import { useSession } from "@/store/authStore";
import { AssistantAnswerView } from "./AssistantAnswerView";
import { HelpCenterAnswer } from "./HelpCenterAnswer";
import { renderPageArticleLink, type RenderArticleLink } from "./articleLinks";
import { accessFromSession, useSignedInAccess, type AssistantAccess } from "./useAssistantAccess";

export type AskAssistantFn = (input: OpInput<"ai", "askAssistant">) => Promise<AskAssistantOutput>;

interface AssistantPanelProps {
  readonly library: HelpLibrary;
  readonly renderLink?: RenderArticleLink;
  /** Heading level so the section nests under the host's headings. */
  readonly headingLevel?: 2 | 3;
  /** Injected in tests; the app calls the ai.askAssistant op. */
  readonly ask?: AskAssistantFn;
  /** Injected in tests; the app reads the session and profile. */
  readonly access?: AssistantAccess;
}

type PanelState =
  | { readonly kind: "idle" }
  | { readonly kind: "pending" }
  | { readonly kind: "local"; readonly answer: HelpAnswer; readonly notice: string | null }
  | { readonly kind: "remote"; readonly result: AskAssistantOutput };

const numberFormat = new Intl.NumberFormat("en-US");
const defaultAsk: AskAssistantFn = (input) => api.ai.askAssistant(input);

const AccessNote = ({ access, pathname }: { access: AssistantAccess; pathname: string }): ReactElement | null => {
  if (access === "ready" || access === "checking") return null;
  const isSignedOut = access === "signed-out";
  const to = isSignedOut ? `/login?next=${encodeURIComponent(pathname)}` : `/onboarding?next=${encodeURIComponent(pathname)}`;
  return (
    <p className="flex items-start gap-2 border-t border-border pt-4 text-sm text-fg-muted">
      <Sparkle aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
      <span>
        <Link to={to} className="font-semibold text-accent underline underline-offset-2">
          {isSignedOut ? "Sign in to ask" : "Finish your profile"}
        </Link>{" "}
        the assistant for a written answer. Until then, answers come from Help Center articles.
      </span>
    </p>
  );
};

type PanelViewProps = Omit<AssistantPanelProps, "access"> & { readonly access: AssistantAccess };

const AssistantPanelView = ({ library, renderLink = renderPageArticleLink, headingLevel = 2, ask = defaultAsk, access }: PanelViewProps): ReactElement => {
  const [question, setQuestion] = useState("");
  const [state, setState] = useState<PanelState>({ kind: "idle" });
  const { pathname } = useLocation();
  const baseId = useId();
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const isTooLong = question.length > MAX_QUESTION_CHARS;
  const showCounter = question.length >= COUNTER_THRESHOLD;
  const errorId = `${baseId}-error`;
  const counterId = `${baseId}-counter`;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const local = answerFromHelpCenter(question, library);
    // Empty and over-long questions never reach the server.
    if (access !== "ready" || local.kind === "empty-question" || local.kind === "too-long") {
      setState({ kind: "local", answer: local, notice: null });
      return;
    }
    setState({ kind: "pending" });
    try {
      setState({ kind: "remote", result: await ask({ question: question.trim(), route: pathname }) });
    } catch (error) {
      setState({ kind: "local", answer: local, notice: toApiUserError(error).message });
    }
  };

  const renderState = (): ReactElement | null => {
    if (state.kind === "pending") return <p className="text-sm text-fg-muted">Finding an answer...</p>;
    if (state.kind === "remote") return <AssistantAnswerView result={state.result} library={library} renderLink={renderLink} />;
    if (state.kind === "local") return <HelpCenterAnswer answer={state.answer} notice={state.notice} renderLink={renderLink} />;
    return null;
  };

  return (
    <section aria-labelledby={`${baseId}-title`} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Heading id={`${baseId}-title`} className="text-lg font-semibold tracking-tight text-fg">
          Ask a question
        </Heading>
        <p className="text-sm text-fg-muted">
          {access === "ready" ? "The assistant answers from Help Center articles and links its sources." : "Answers come from Help Center articles."}
        </p>
      </div>

      <form onSubmit={(event) => void handleSubmit(event)} noValidate className="flex flex-col gap-2">
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
        <button type="submit" disabled={isTooLong || state.kind === "pending"} className={buttonClassName("primary", "self-start")}>
          Ask
        </button>
      </form>

      <div aria-live="polite" aria-busy={state.kind === "pending"} className="empty:hidden">
        {renderState()}
      </div>

      <AccessNote access={access} pathname={pathname} />
    </section>
  );
};

/** Reads the profile only for signed-in people, then renders the panel. */
const SignedInAssistantPanel = (props: PanelViewProps & { readonly uid: string }): ReactElement => {
  const access = useSignedInAccess(props.uid);
  return <AssistantPanelView {...props} access={access} />;
};

export const AssistantPanel = ({ access, ...props }: AssistantPanelProps): ReactElement => {
  const session = useSession();
  if (access) return <AssistantPanelView {...props} access={access} />;
  const fromSession = accessFromSession(session);
  if (fromSession === null && session.status === "user") return <SignedInAssistantPanel {...props} access="checking" uid={session.user.uid} />;
  return <AssistantPanelView {...props} access={fromSession ?? "checking"} />;
};

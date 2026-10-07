/**
 * assistantAnswer.ts
 * The askAssistant decision flow (SPEC 8.4, D7), with no Firestore or network
 * of its own so every branch is unit-testable:
 *
 *   1. retrieve the top help articles for the question (BM25),
 *   2. no AI (off, missing key or model) or no matching article -> fallback,
 *   3. count the call against the per-user and global limits; over the
 *      personal limit -> fallback with limited: true, over the global cap ->
 *      fallback,
 *   4. ask the model with only those articles and the route in the prompt,
 *      within the timeout; any failure (429, timeout, refusal, bad JSON,
 *      truncated) -> fallback,
 *   5. keep only cited slugs that were in the grounding set (a model cannot
 *      invent a link), clean the answer to plain text, and return it.
 *
 * The fallback is deterministic: the top 3 articles labeled "From Help Center".
 */
import { ASSISTANT_ANSWER_MAX, ASSISTANT_MAX_ARTICLES, type AskAssistantOutput, type AssistantArticle } from "@fbla/shared";
import type { HelpArticle } from "../../../src/lib/help/types";
import { AssistantModelError, parseAssistantReply, type AssistantModel, type ModelFailureKind } from "./assistantModel";
import type { HelpCorpus } from "./helpCorpus";
import { FALLBACK_ARTICLE_COUNT, GROUNDING_ARTICLE_COUNT, retrieveArticles } from "./retrieval";
import { buildSystemPrompt } from "./systemPrompt";
import type { UsageVerdict } from "./aiUsage";

export const FALLBACK_ANSWER = "These Help Center articles best match your question.";
export const LIMITED_ANSWER = "You've reached today's assistant limit; here are matching help articles.";
export const NO_MATCH_ANSWER = "No help articles match that question. Try other words, or browse the Help Center topics.";

export type FallbackReason = "ai-off" | "no-articles" | "user-limit" | "global-cap" | ModelFailureKind;

export interface AnswerParams {
  readonly question: string;
  /** Sanitized route (or null). */
  readonly route: string | null;
  readonly corpus: HelpCorpus;
  /** null when AI is off or misconfigured. */
  readonly model: AssistantModel | null;
  readonly maxOutputTokens: number;
  readonly timeoutMs: number;
  /** Counts one AI call; called only when the model will be asked. */
  readonly consumeUsage: () => Promise<UsageVerdict>;
  /** Told why a fallback was used (for the structured log line). */
  readonly onFallback?: (reason: FallbackReason) => void;
}

const toLink = (article: HelpArticle): AssistantArticle => ({ slug: article.slug, title: article.title });

/** Plain text only: strips tags and control characters, collapses blank runs, clips the length. */
export const toPlainAnswer = (raw: string): string => {
  const text = raw
    .replace(/<[^>]*>/g, "")
    // Control characters other than tab and newline (code points 0-8, 11-31, 127).
    .replace(new RegExp("[\\u0000-\\u0008\\u000B-\\u001F\\u007F]", "g"), "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.length <= ASSISTANT_ANSWER_MAX ? text : `${text.slice(0, ASSISTANT_ANSWER_MAX - 1).trimEnd()}…`;
};

const fallback = (articles: readonly HelpArticle[], limited: boolean): AskAssistantOutput => {
  const top = articles.slice(0, FALLBACK_ARTICLE_COUNT).map(toLink);
  const answer = limited ? LIMITED_ANSWER : top.length > 0 ? FALLBACK_ANSWER : NO_MATCH_ANSWER;
  return { answer, source: "help", limited, articles: top };
};

/** Never longer than timeoutMs, even if a provider ignores its own timeout. Tier 2 lane B: also used by shiftPlannerParse. */
export const withTimeout = <T>(work: Promise<T>, timeoutMs: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new AssistantModelError("timeout")), timeoutMs);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
};

/** Cited articles in citation order, restricted to the grounding set; the top hit when none were valid. */
const citedArticles = (grounding: readonly HelpArticle[], citedSlugs: readonly string[]): readonly HelpArticle[] => {
  const bySlug = new Map(grounding.map((article) => [article.slug, article]));
  const cited = [...new Set(citedSlugs)].flatMap((slug) => {
    const article = bySlug.get(slug);
    return article ? [article] : [];
  });
  return (cited.length > 0 ? cited : grounding.slice(0, 1)).slice(0, ASSISTANT_MAX_ARTICLES);
};

export const answerQuestion = async (params: AnswerParams): Promise<AskAssistantOutput> => {
  const grounding = retrieveArticles(params.corpus, params.question, GROUNDING_ARTICLE_COUNT);
  const fallBack = (reason: FallbackReason, limited = false): AskAssistantOutput => {
    params.onFallback?.(reason);
    return fallback(grounding, limited);
  };

  if (params.model === null) return fallBack("ai-off");
  if (grounding.length === 0) return fallBack("no-articles");

  const verdict = await params.consumeUsage();
  if (verdict === "user-limit") return fallBack("user-limit", true);
  if (verdict === "global-cap") return fallBack("global-cap");

  try {
    const raw = await withTimeout(
      params.model.complete({
        system: buildSystemPrompt(grounding, params.route),
        question: params.question,
        maxOutputTokens: params.maxOutputTokens,
        timeoutMs: params.timeoutMs
      }),
      params.timeoutMs
    );
    const reply = parseAssistantReply(raw);
    const answer = toPlainAnswer(reply.answer);
    if (answer === "") return fallBack("bad-output");
    return { answer, source: "ai", limited: false, articles: citedArticles(grounding, reply.citedSlugs).map(toLink) };
  } catch (error) {
    return fallBack(error instanceof AssistantModelError ? error.kind : "network");
  }
};

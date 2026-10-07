/**
 * aiOps.ts
 * Schemas for ai.askAssistant (SPEC#fn-askassistant, SPEC 8.4, D7).
 *
 * The question limit (2,000 characters, DEFAULT_CONFIG.aiMaxInputChars) is
 * enforced by the handler so an over-long question returns the friendly
 * INPUT_TOO_LONG code instead of a generic INVALID_INPUT. The schema only
 * caps the raw size so a hostile client cannot post megabytes.
 *
 * Output: `source` says who wrote the answer ("ai" = the model, grounded on
 * help articles; "help" = the deterministic fallback, the top help articles).
 * `limited` is true when the caller hit their personal assistant limit.
 * `articles` are the help articles the answer cites, shown as links.
 */
import { z } from "zod";

/** Hard cap on the raw question; the real limit (config) is checked in the handler. */
export const ASSISTANT_QUESTION_HARD_CAP = 20_000;
/** Longest route string accepted as page context. */
export const ASSISTANT_ROUTE_MAX = 512;
/** Longest answer returned to the browser. */
export const ASSISTANT_ANSWER_MAX = 4_000;
/** Most articles cited with one answer. */
export const ASSISTANT_MAX_ARTICLES = 5;

export const ASSISTANT_SOURCES = ["ai", "help"] as const;
export type AssistantSource = (typeof ASSISTANT_SOURCES)[number];

export const askAssistantInput = z
  .object({
    question: z.string().trim().min(1).max(ASSISTANT_QUESTION_HARD_CAP),
    route: z.string().max(ASSISTANT_ROUTE_MAX).optional()
  })
  .strict();

export const assistantArticleSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1).max(200)
});
export type AssistantArticle = z.infer<typeof assistantArticleSchema>;

export const askAssistantOutput = z.object({
  answer: z.string().max(ASSISTANT_ANSWER_MAX),
  source: z.enum(ASSISTANT_SOURCES),
  limited: z.boolean(),
  articles: z.array(assistantArticleSchema).max(ASSISTANT_MAX_ARTICLES)
});
export type AskAssistantOutput = z.infer<typeof askAssistantOutput>;

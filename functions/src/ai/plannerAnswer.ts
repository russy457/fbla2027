/**
 * plannerAnswer.ts
 * The ai.shiftPlannerParse decision flow (SPEC 8.4 fallbacks table, Tier 2),
 * with no Firestore or network of its own so every branch is unit-testable:
 *
 *   1. no AI (off, missing key or model)            -> parser
 *   2. count the call against the per-user and global AI limits;
 *      over the personal limit -> parser with limited: true,
 *      over the global cap     -> parser
 *   3. ask the model (no user data in the prompt, structured JSON output,
 *      within the timeout); 429, timeout, refusal, truncation, bad JSON, or a
 *      reply that fails plannerDraftSchema -> parser
 *   4. otherwise the model's draft and its cleaned description, source "ai".
 *
 * The parser is the Tier 1 deterministic parser from shared/plannerParse.ts,
 * so the coordinator always gets a usable pre-fill. Nothing is ever saved.
 */
import { parsePlannerText, type ShiftPlannerParseOutput } from "@fbla/shared";
import { withTimeout } from "./assistantAnswer";
import { AssistantModelError, type AssistantModel, type ModelFailureKind } from "./assistantModel";
import type { UsageVerdict } from "./aiUsage";
import { buildPlannerPrompt } from "./plannerPrompt";
import { PLANNER_REPLY_JSON_SCHEMA, cleanDescription, draftFromReply, parsePlannerReply } from "./plannerReply";

export type PlannerFallbackReason = "ai-off" | "user-limit" | "global-cap" | ModelFailureKind;

export interface PlanShiftParams {
  readonly text: string;
  /** Today (YYYY-MM-DD) in the org's zone. */
  readonly referenceDate: string;
  readonly timeZone: string;
  /** null when AI is off or misconfigured. */
  readonly model: AssistantModel | null;
  readonly maxInputChars: number;
  readonly maxOutputTokens: number;
  readonly timeoutMs: number;
  /** Counts one AI call; called only when the model will be asked. */
  readonly consumeUsage: () => Promise<UsageVerdict>;
  readonly onFallback?: (reason: PlannerFallbackReason) => void;
}

export const planShift = async (params: PlanShiftParams): Promise<ShiftPlannerParseOutput> => {
  const parser = (reason: PlannerFallbackReason, limited = false): ShiftPlannerParseOutput => {
    params.onFallback?.(reason);
    const draft = parsePlannerText(params.text, { referenceDate: params.referenceDate, maxInputChars: params.maxInputChars });
    return { draft, description: null, source: "parser", limited };
  };

  if (params.model === null) return parser("ai-off");
  const verdict = await params.consumeUsage();
  if (verdict === "user-limit") return parser("user-limit", true);
  if (verdict === "global-cap") return parser("global-cap");

  try {
    const raw = await withTimeout(
      params.model.complete({
        system: buildPlannerPrompt(params.referenceDate, params.timeZone),
        question: params.text,
        maxOutputTokens: params.maxOutputTokens,
        timeoutMs: params.timeoutMs,
        output: { name: "shift_draft", schema: PLANNER_REPLY_JSON_SCHEMA }
      }),
      params.timeoutMs
    );
    const reply = parsePlannerReply(raw);
    return { draft: draftFromReply(reply, params.referenceDate), description: cleanDescription(reply.description), source: "ai", limited: false };
  } catch (error) {
    return parser(error instanceof AssistantModelError ? error.kind : "network");
  }
};

/**
 * plannerOps.ts
 * Schemas for ai.shiftPlannerParse (SPEC 5.2, SPEC 8.4, SPEC#screen-planner
 * 9.14, Tier 2). A coordinator of `orgId` sends one plain-English sentence;
 * the answer is the same PlannerDraft the deterministic parser makes, so the
 * form pre-fill code does not care who wrote it.
 *
 *   source "ai"      the model's draft, validated against plannerDraftSchema
 *   source "parser"  the deterministic parser (AI off, over a limit, timeout,
 *                    refusal, or output that failed validation)
 *
 * `description` is an optional short listing description the model may
 * write; the parser never writes one (null). `limited` is true when the
 * caller hit their personal AI limit, so the UI can say why the parser
 * answered. The text limit (2,000 characters, config aiMaxInputChars) is
 * enforced by the handler as INPUT_TOO_LONG; the schema caps only the raw size.
 */
import { z } from "zod";
import { plannerDraftSchema } from "../../plannerParse";
import { docIdSchema } from "../common";

/** Hard cap on the raw text; the real limit (config) is checked in the handler. */
export const PLANNER_TEXT_HARD_CAP = 20_000;
/** Longest generated listing description (fits the opportunity description field). */
export const PLANNER_DESCRIPTION_MAX = 600;

export const PLANNER_SOURCES = ["ai", "parser"] as const;
export type PlannerSource = (typeof PLANNER_SOURCES)[number];

export const shiftPlannerParseInput = z
  .object({
    orgId: docIdSchema,
    text: z.string().trim().min(1).max(PLANNER_TEXT_HARD_CAP)
  })
  .strict();
export type ShiftPlannerParseInput = z.infer<typeof shiftPlannerParseInput>;

export const shiftPlannerParseOutput = z.object({
  draft: plannerDraftSchema,
  description: z.string().min(1).max(PLANNER_DESCRIPTION_MAX).nullable(),
  source: z.enum(PLANNER_SOURCES),
  limited: z.boolean()
});
export type ShiftPlannerParseOutput = z.infer<typeof shiftPlannerParseOutput>;

/**
 * plannerAiPrefill.ts
 * Maps an ai.shiftPlannerParse result (Tier 2 lane B, SPEC 8.4) onto the same
 * form pre-fill the deterministic parser uses (plannerPrefill.ts), adding
 * the optional AI-written description, plus the line that tells the
 * coordinator who wrote the draft and why (AI, or the parser as fallback).
 * Still pre-fill only: nothing is saved until the coordinator presses Save.
 */
import type { ShiftPlannerParseOutput } from "@fbla/shared";
import { prefillFromDraft, type PlannerPrefill, type PrefillField } from "./plannerPrefill";

export const prefillFromAi = (result: ShiftPlannerParseOutput): PlannerPrefill => {
  const base = prefillFromDraft(result.draft);
  if (result.description === null) return base;
  return { ...base, description: result.description, filled: new Set<PrefillField>([...base.filled, "description"]) };
};

/** Who drafted the fields, in plain words. */
export const aiSourceNote = (result: Pick<ShiftPlannerParseOutput, "source" | "limited">): string => {
  if (result.source === "ai") return "Drafted with AI. Check every highlighted field before you save.";
  if (result.limited) return "You've reached today's AI limit, so the standard reader filled what it could.";
  return "AI isn't available right now, so the standard reader filled what it could.";
};

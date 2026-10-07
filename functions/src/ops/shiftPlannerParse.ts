/**
 * shiftPlannerParse.ts
 * ai.shiftPlannerParse (SPEC 5.2, SPEC 8.4, SPEC#screen-planner 9.14, Tier 2):
 * turns a coordinator's plain-English shift request into a PlannerDraft
 * (plus an optional listing description) with the LLM, falling back to the
 * deterministic parser on any failure. It only drafts: the client pre-fills
 * the new-shift form and the coordinator saves with the form's own buttons.
 *
 * Gate: coordinatorOfOrg(orgId). The org is loaded from the input id (a
 * create-type op, SPEC 4.4) and the caller must be its owner or coordinator,
 * so a coordinator of org A gets PERMISSION_DENIED for org B, and kiosk
 * tokens are refused. "Today" for relative dates is the request clock's date
 * in the org's time zone. Limits match askAssistant: a request rate limit
 * (bucket "planner") that also covers parser answers, plus the shared AI
 * usage caps (aiUsage, 20/hour, 100/day, global daily cap) that decide
 * whether the model may be asked. Text over 2,000 characters is
 * INPUT_TOO_LONG. The text itself is never logged.
 *
 * Settings and the model are injectable (createShiftPlannerParseOp) so
 * emulator tests use fake models and never call a real LLM API.
 */
import { AppError, localDateIn } from "@fbla/shared";
import { consumeAiUsage } from "../ai/aiUsage";
import type { AssistantModel } from "../ai/assistantModel";
import { readAiSettings, type AiSettings } from "../ai/aiSettings";
import { planShift } from "../ai/plannerAnswer";
import { modelFromSettings } from "../ai/providers";
import { coordinatorOf } from "../lib/auth";
import { defineCallable } from "../lib/defineCallable";
import { orgResource } from "../lib/orgAuth";
import type { RateLimitRule } from "../lib/rateLimit";

/** Planner requests per coordinator per window, AI or not. */
export const PLANNER_RATE_LIMIT: RateLimitRule = {
  bucket: "planner",
  max: () => 30,
  windowSec: () => 600
};

export interface ShiftPlannerParseDeps {
  readonly settings: () => AiSettings;
  readonly model: (settings: AiSettings) => AssistantModel | null;
}

const productionDeps: ShiftPlannerParseDeps = {
  settings: () => readAiSettings(process.env),
  model: modelFromSettings
};

export const createShiftPlannerParseOp = (deps: ShiftPlannerParseDeps = productionDeps) =>
  defineCallable({
    endpoint: "ai",
    op: "shiftPlannerParse",
    auth: coordinatorOf(orgResource((input: { orgId: string }) => input.orgId)),
    rateLimit: PLANNER_RATE_LIMIT,
    handler: async ({ input, caller, clock, deps: server, fn, requestId, resource }) => {
      const { config } = server.env;
      if (input.text.length > config.aiMaxInputChars) throw new AppError("INPUT_TOO_LONG");
      const settings = deps.settings();
      const timeZone = resource.data.timeZone;
      return planShift({
        text: input.text,
        referenceDate: localDateIn(clock.now(), timeZone),
        timeZone,
        model: deps.model(settings),
        maxInputChars: config.aiMaxInputChars,
        maxOutputTokens: config.aiMaxOutputTokens,
        timeoutMs: settings.timeoutMs,
        consumeUsage: () => consumeAiUsage(server.db, caller.uid, config, clock.nowMs()),
        onFallback: (reason) => server.log.info(`${fn} fallback`, { fn, uid: caller.uid, orgId: resource.id, reason, requestId })
      });
    }
  });

export const shiftPlannerParse = createShiftPlannerParseOp();

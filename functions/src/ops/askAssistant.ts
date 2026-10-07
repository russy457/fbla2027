/**
 * askAssistant.ts
 * ai.askAssistant (SPEC#fn-askassistant, SPEC 8.4, D7): intelligent Q&A for
 * the Help Center, grounded on help articles.
 *
 * Gate: signed in with a complete profile (SPEC 8.4 caller column; the G11
 * profile gate runs in defineCallable). Two separate limits apply:
 *   - a request rate limit (bucket "assistant") that also covers fallback
 *     answers, so the endpoint cannot be hammered even with AI off,
 *   - the AI usage limits in aiUsage (20/hour, 100/day per user, global
 *     daily cap) that decide whether the model may be asked.
 * Over-long questions are refused with INPUT_TOO_LONG (SPEC 10.10). The
 * answer itself comes from ai/assistantAnswer.ts.
 *
 * Settings, the model, and the article corpus are injectable
 * (createAskAssistantOp) so emulator tests run deterministic fallbacks and a
 * fake model, and never call a real LLM API.
 */
import { AppError } from "@fbla/shared";
import { sanitizeRoute } from "../../../src/lib/help/routeContext";
import { consumeAiUsage } from "../ai/aiUsage";
import { answerQuestion } from "../ai/assistantAnswer";
import type { AssistantModel } from "../ai/assistantModel";
import { readAiSettings, type AiSettings } from "../ai/aiSettings";
import { getHelpCorpus, type HelpCorpus } from "../ai/helpCorpus";
import { modelFromSettings } from "../ai/providers";
import { profileComplete } from "../lib/auth";
import { defineCallable } from "../lib/defineCallable";
import type { Logger } from "../lib/deps";
import type { RateLimitRule } from "../lib/rateLimit";

/** Questions per user per window, AI or not (keeps the endpoint cheap to protect). */
export const ASSISTANT_RATE_LIMIT: RateLimitRule = {
  bucket: "assistant",
  max: () => 30,
  windowSec: () => 600
};

export interface AskAssistantDeps {
  readonly settings: () => AiSettings;
  readonly model: (settings: AiSettings) => AssistantModel | null;
  readonly corpus: () => HelpCorpus;
}

const productionDeps: AskAssistantDeps = {
  settings: () => readAiSettings(process.env),
  model: modelFromSettings,
  corpus: getHelpCorpus
};

let misconfigurationLogged = false;

/** One clear log line when AI_ENABLED is true but the key or model is missing (SPEC X10). */
const logMisconfigurationOnce = (settings: AiSettings, log: Logger): void => {
  if (misconfigurationLogged || settings.unavailableReason === null || settings.unavailableReason === "disabled") return;
  misconfigurationLogged = true;
  log.warn(`askAssistant: AI_ENABLED is true but ${settings.unavailableReason} for provider ${settings.provider}; answering from help articles`, {
    provider: settings.provider,
    reason: settings.unavailableReason
  });
};

export const createAskAssistantOp = (deps: AskAssistantDeps = productionDeps) =>
  defineCallable({
    endpoint: "ai",
    op: "askAssistant",
    auth: profileComplete(),
    rateLimit: ASSISTANT_RATE_LIMIT,
    handler: async ({ input, caller, clock, deps: server, fn, requestId }) => {
      const { config } = server.env;
      if (input.question.length > config.aiMaxInputChars) throw new AppError("INPUT_TOO_LONG");

      const settings = deps.settings();
      logMisconfigurationOnce(settings, server.log);
      return answerQuestion({
        question: input.question,
        route: input.route === undefined ? null : sanitizeRoute(input.route),
        corpus: deps.corpus(),
        model: deps.model(settings),
        maxOutputTokens: config.aiMaxOutputTokens,
        timeoutMs: settings.timeoutMs,
        consumeUsage: () => consumeAiUsage(server.db, caller.uid, config, clock.nowMs()),
        // No question text in logs: it may contain personal details.
        onFallback: (reason) => server.log.info(`${fn} fallback`, { fn, uid: caller.uid, reason, requestId })
      });
    }
  });

export const askAssistant = createAskAssistantOp();

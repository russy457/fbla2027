/**
 * aiUsageDocs.ts
 * Server-only AI usage counters (SPEC 3.21): aiUsage/{uid} holds one user's
 * hourly and daily assistant calls, aiUsage/_global the site-wide daily count
 * that turns AI off for everyone once AI_GLOBAL_DAILY_CAP is reached. Days are
 * UTC dates (YYYY-MM-DD) so the cap resets at the same moment for everyone.
 */
import { z } from "zod";
import { timestampSchema, ymdSchema } from "./common";

/** Document id of the site-wide counter. */
export const AI_GLOBAL_USAGE_ID = "_global";

export const aiUsageDocSchema = z.object({
  hourWindowStart: timestampSchema,
  hourCount: z.number().int().min(0),
  day: ymdSchema,
  dayCount: z.number().int().min(0)
});
export type AiUsageDoc = z.infer<typeof aiUsageDocSchema>;

export const aiGlobalUsageDocSchema = z.object({
  day: ymdSchema,
  count: z.number().int().min(0)
});
export type AiGlobalUsageDoc = z.infer<typeof aiGlobalUsageDocSchema>;

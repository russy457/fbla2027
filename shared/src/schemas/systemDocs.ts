/**
 * systemDocs.ts
 * Server-only bookkeeping documents for Tier 0 (SPEC 3.21): rate limit
 * counters, the runDueJobs lease, job run history (admin-readable), and the
 * demo clock (readable by every signed-in client, including kiosks).
 */
import { z } from "zod";
import { timestampSchema } from "./common";

/** rateLimits/{uid}_{bucket}: fixed window counter. */
export const rateLimitDocSchema = z.object({ windowStart: timestampSchema, count: z.number().int().min(0) });
export type RateLimitDoc = z.infer<typeof rateLimitDocSchema>;

/** jobLeases/runDueJobs: one runner at a time (SPEC#fn-runduejobs-detail). */
export const jobLeaseDocSchema = z.object({ holder: z.string(), expiresAt: timestampSchema });
export type JobLeaseDoc = z.infer<typeof jobLeaseDocSchema>;

export const JOB_OUTCOMES = ["ok", "partial", "error", "skipped-lease"] as const;
export type JobOutcome = (typeof JOB_OUTCOMES)[number];

export const jobProcessedSchema = z.object({
  cutoffs: z.number().int().min(0),
  finalized: z.number().int().min(0),
  seriesExtended: z.number().int().min(0)
});
export type JobProcessed = z.infer<typeof jobProcessedSchema>;

/** jobRuns/{runId} */
export const jobRunDocSchema = z.object({
  trigger: z.enum(["schedule", "admin"]),
  startedAt: timestampSchema,
  finishedAt: timestampSchema,
  processed: jobProcessedSchema,
  more: z.boolean(),
  errors: z.array(z.object({ id: z.string(), code: z.string() })),
  outcome: z.enum(JOB_OUTCOMES)
});
export type JobRunDoc = z.infer<typeof jobRunDocSchema>;

/** demoClock/global: offset honored only in demo mode (SPEC#clock). */
export const demoClockDocSchema = z.object({ offsetMs: z.number().int(), setBy: z.string(), setAt: timestampSchema });
export type DemoClockDoc = z.infer<typeof demoClockDocSchema>;

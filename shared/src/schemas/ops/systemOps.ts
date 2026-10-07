/**
 * systemOps.ts
 * Schemas for ping (every endpoint) and the Tier 0 admin ops
 * (SPEC#fn-runduejobs, admin.setDemoClock).
 */
import { z } from "zod";
import { JOB_OUTCOMES, jobProcessedSchema } from "../systemDocs";

const MAX_ECHO_LENGTH = 100;
/** Largest demo clock jump allowed in one call: one week. */
const MAX_OFFSET_MS = 7 * 24 * 60 * 60 * 1000;

export const pingInput = z.object({ echo: z.string().max(MAX_ECHO_LENGTH).optional() }).strict();
export const pingOutput = z.object({
  pong: z.literal(true),
  fn: z.string(),
  uid: z.string(),
  time: z.string(),
  echo: z.string().nullable()
});

export const runDueJobsInput = z.object({}).strict();
export const runDueJobsOutput = z.object({
  runId: z.string(),
  outcome: z.enum(JOB_OUTCOMES),
  processed: jobProcessedSchema,
  more: z.boolean()
});

/** Exactly one of offsetMs (absolute, 0 resets) or advanceMinutes (relative). */
export const setDemoClockInput = z
  .object({
    offsetMs: z.number().int().min(-MAX_OFFSET_MS).max(MAX_OFFSET_MS).optional(),
    advanceMinutes: z.number().int().min(-1440).max(1440).optional()
  })
  .strict()
  .refine((value) => (value.offsetMs === undefined) !== (value.advanceMinutes === undefined), {
    message: "send offsetMs or advanceMinutes, not both",
    path: ["offsetMs"]
  });
export const setDemoClockOutput = z.object({ offsetMs: z.number().int(), now: z.string() });

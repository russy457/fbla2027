/**
 * seriesOps.ts
 * Schemas for recurring series ops (Tier 2, SPEC 5.2):
 *   coordinator.upsertSeries        create or edit the one series of an opportunity
 *   coordinator.extendSeries        materialize shifts 8 weeks ahead (also runDueJobs)
 *   volunteer.signupSeries          sign up for every upcoming date at once
 *   volunteer.extendSeriesSignup    add only the dates after the last coversThrough
 * Whole-series results report each date's outcome instead of throwing, so one
 * full Saturday never hides the eleven that worked (SPEC 9.4).
 */
import { z } from "zod";
import { docIdSchema, ymdSchema } from "../common";
import { seriesRuleSchema } from "../seriesDocs";

export const upsertSeriesInput = z
  .object({
    opportunityId: docIdSchema,
    rule: seriesRuleSchema,
    capacity: z.number().int().min(1).max(200),
    startsOn: ymdSchema,
    endsOn: ymdSchema.nullable().optional()
  })
  .strict();
export type UpsertSeriesInput = z.output<typeof upsertSeriesInput>;

export const upsertSeriesOutput = z.object({
  seriesId: z.string(),
  created: z.boolean(),
  /** New shifts created by this call. */
  materialized: z.number().int(),
  /** Future shifts without volunteers moved to the new times or capacity. */
  rescheduled: z.number().int(),
  /** Future shifts without volunteers removed because the rule no longer has their date. */
  removed: z.number().int(),
  /** Future shifts left unchanged because volunteers already signed up (edit or cancel them one by one). */
  keptWithVolunteers: z.number().int()
});

export const extendSeriesInput = z.object({ seriesId: docIdSchema }).strict();
export const extendSeriesOutput = z.object({ created: z.number().int(), materializedThrough: z.string() });

export const seriesSignupInput = z.object({ seriesId: docIdSchema }).strict();

export const SERIES_SIGNUP_OUTCOMES = ["confirmed", "waitlisted", "skipped"] as const;
export type SeriesSignupOutcome = (typeof SERIES_SIGNUP_OUTCOMES)[number];

export const seriesSignupResultSchema = z.object({
  instanceId: z.string(),
  /** Calendar date in the org zone. */
  date: ymdSchema,
  outcome: z.enum(SERIES_SIGNUP_OUTCOMES),
  /** The catalog code a skipped date would have thrown (SHIFT_FULL, AGE_BELOW_MIN, ...). */
  reason: z.string().optional()
});
export type SeriesSignupResult = z.infer<typeof seriesSignupResultSchema>;

export const seriesSignupOutput = z.object({
  results: z.array(seriesSignupResultSchema),
  /** Last series date this signup has covered, or null when the series has no dates yet. */
  coversThrough: ymdSchema.nullable()
});
export type SeriesSignupOutput = z.infer<typeof seriesSignupOutput>;

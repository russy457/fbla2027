/**
 * seriesDocs.ts
 * Recurring series documents (Tier 2, SPEC 3.7) and the per-volunteer
 * whole-series signup record.
 *
 *   series/{seriesId}                  the repeat rule an opportunity's shifts
 *                                      are materialized from, 8 weeks ahead
 *   seriesSignups/{seriesId}_{uid}     how far a volunteer's "whole series"
 *                                      signup reaches (coversThrough), so
 *                                      extendSeriesSignup only adds later dates
 *
 * The rule is read in the organization's time zone (stored on the series), so
 * "Saturdays 9:00 to 13:00" stays 9:00 local across daylight saving changes.
 * SPEC 3.7 names a weekly rule; `frequency` (weekly, biweekly, monthly) and
 * `monthWeek` extend it and default to plain weekly, so a SPEC-shaped rule
 * still parses.
 */
import { z } from "zod";
import { timestampSchema, ymdSchema } from "./common";

const auditFields = { createdAt: timestampSchema, updatedAt: timestampSchema };

export const SERIES_FREQUENCIES = ["weekly", "biweekly", "monthly"] as const;
export type SeriesFrequency = (typeof SERIES_FREQUENCIES)[number];

/** Which occurrence of the weekday in a month: 1st to 4th, or -1 for the last. */
export const MONTH_WEEKS = [1, 2, 3, 4, -1] as const;
export type MonthWeek = (typeof MONTH_WEEKS)[number];

/** 24-hour local clock time, for example "09:00". */
export const clockTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "must be a time like 09:00" });

/** Weekdays use the JavaScript numbering: 0 = Sunday ... 6 = Saturday (SPEC 3.7). */
export const seriesRuleSchema = z
  .object({
    frequency: z.enum(SERIES_FREQUENCIES).default("weekly"),
    weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    startTime: clockTimeSchema,
    endTime: clockTimeSchema,
    monthWeek: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(-1)]).optional()
  })
  .strict();
export type SeriesRule = z.output<typeof seriesRuleSchema>;
export type SeriesRuleInput = z.input<typeof seriesRuleSchema>;

export const SERIES_STATUSES = ["active", "ended"] as const;

/** series/{seriesId}: public read, Function-only writes (SPEC 4.3). */
export const seriesDocSchema = z.object({
  orgId: z.string(),
  opportunityId: z.string(),
  rule: seriesRuleSchema,
  capacity: z.number().int().min(1).max(200),
  startsOn: ymdSchema,
  endsOn: ymdSchema.nullable(),
  /** The org's IANA zone when the series was saved; every date in the rule is read in it. */
  timeZone: z.string(),
  /** Exclusive end: shifts exist for every rule date before this instant. */
  materializedThrough: timestampSchema,
  /** materializedThrough - 7 days; null once every date through endsOn exists. */
  nextExtendAt: timestampSchema.nullable(),
  status: z.enum(SERIES_STATUSES),
  createdBy: z.string(),
  ...auditFields
});
export type SeriesDoc = z.infer<typeof seriesDocSchema>;

/** seriesSignups/{seriesId}_{uid}: readable by the volunteer only. */
export const seriesSignupDocSchema = z.object({
  seriesId: z.string(),
  orgId: z.string(),
  uid: z.string(),
  /** Last rule date (org zone) the whole-series signup has tried; later dates need extendSeriesSignup. */
  coversThrough: ymdSchema.nullable(),
  ...auditFields
});
export type SeriesSignupDoc = z.infer<typeof seriesSignupDocSchema>;

/** The seriesSignups document id for a volunteer. */
export const seriesSignupIdFor = (seriesId: string, uid: string): string => `${seriesId}_${uid}`;

/**
 * seriesForm.ts
 * Pure helpers for the Tier 2 series and ranking screens:
 *   toSeriesInput        what the coordinator typed -> upsertSeries input,
 *                        with the same checks the server answers with
 *                        SERIES_RULE_INVALID (shared seriesRuleProblem)
 *   seriesFormFromDoc    a saved series back into form values
 *   seriesOutcomeView    a whole-series result -> status chip (D14 tones)
 *   rankReasonText       a ranking "why" chip in plain words
 */
import {
  MAX_CAPACITY,
  isValidYmd,
  seriesRuleProblem,
  type MonthWeek,
  type RankReason,
  type SeriesDoc,
  type SeriesFrequency,
  type SeriesRule,
  type SeriesSignupResult
} from "@fbla/shared";
import { CAUSE_AREA_LABELS } from "./causeAreas";

export interface SeriesFormValues {
  readonly frequency: SeriesFrequency;
  readonly weekdays: readonly number[];
  readonly monthWeek: MonthWeek;
  readonly startTime: string;
  readonly endTime: string;
  readonly capacity: string;
  readonly startsOn: string;
  /** "" means no end date. */
  readonly endsOn: string;
}

export type SeriesField = "weekdays" | "startTime" | "endTime" | "capacity" | "startsOn" | "endsOn";

export interface SeriesInput {
  readonly rule: SeriesRule;
  readonly capacity: number;
  readonly startsOn: string;
  readonly endsOn: string | null;
}

export type SeriesFormResult = { readonly ok: true; readonly input: SeriesInput } | { readonly ok: false; readonly field: SeriesField; readonly message: string };

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const fail = (field: SeriesField, message: string): SeriesFormResult => ({ ok: false, field, message });

/** Which field a shared rule problem belongs to, so the message lands next to it. */
const fieldForProblem = (problem: string): SeriesField => {
  if (problem.startsWith("Pick each weekday")) return "weekdays";
  if (problem.startsWith("The last date")) return "endsOn";
  return "endTime";
};

export const toSeriesInput = (values: SeriesFormValues): SeriesFormResult => {
  if (values.weekdays.length === 0) return fail("weekdays", "Pick at least one day.");
  if (!TIME_PATTERN.test(values.startTime)) return fail("startTime", "Enter a start time like 09:00.");
  if (!TIME_PATTERN.test(values.endTime)) return fail("endTime", "Enter an end time like 13:00.");
  const capacity = Number(values.capacity);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > MAX_CAPACITY) return fail("capacity", `Enter a whole number from 1 to ${MAX_CAPACITY}.`);
  if (!isValidYmd(values.startsOn)) return fail("startsOn", "Pick the first date.");
  if (values.endsOn !== "" && !isValidYmd(values.endsOn)) return fail("endsOn", "Pick a last date, or leave it empty.");
  const rule: SeriesRule = {
    frequency: values.frequency,
    weekdays: [...values.weekdays].sort((a, b) => a - b),
    startTime: values.startTime,
    endTime: values.endTime,
    ...(values.frequency === "monthly" ? { monthWeek: values.monthWeek } : {})
  };
  const endsOn = values.endsOn === "" ? null : values.endsOn;
  const problem = seriesRuleProblem(rule, values.startsOn, endsOn);
  if (problem !== null) return fail(fieldForProblem(problem), problem);
  return { ok: true, input: { rule, capacity, startsOn: values.startsOn, endsOn } };
};

export const seriesFormFromDoc = (series: Pick<SeriesDoc, "rule" | "capacity" | "startsOn" | "endsOn">): SeriesFormValues => ({
  frequency: series.rule.frequency,
  weekdays: series.rule.weekdays,
  monthWeek: series.rule.monthWeek ?? 1,
  startTime: series.rule.startTime,
  endTime: series.rule.endTime,
  capacity: String(series.capacity),
  startsOn: series.startsOn,
  endsOn: series.endsOn ?? ""
});

export type ChipTone = "success" | "warning" | "neutral";

const SKIP_REASONS: Readonly<Record<string, string>> = {
  SHIFT_FULL: "Full",
  WAITLIST_CLOSED: "Waitlist closed",
  SHIFT_CANCELLED: "Cancelled by organization",
  SHIFT_STARTED: "Already started",
  AGE_BELOW_MIN: "Below the minimum age",
  MINOR_UNVERIFIED_ORG: "Open to under-18s after verification",
  SIGNUP_CANCELLED_BEFORE: "You cancelled this date"
};

/** The chip for one date of a whole-series signup (SPEC 9.4: confirmed / waitlisted / skipped). */
export const seriesOutcomeView = (result: Pick<SeriesSignupResult, "outcome" | "reason">): { tone: ChipTone; label: string } => {
  if (result.outcome === "confirmed") return { tone: "success", label: "Signed up" };
  if (result.outcome === "waitlisted") return { tone: "warning", label: "Waitlisted" };
  return { tone: "neutral", label: `Skipped: ${SKIP_REASONS[result.reason ?? ""] ?? "Not available"}` };
};

const WEEKDAY_WORDS: Readonly<Record<string, string>> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };

/** A "why" chip on the ranked volunteers panel. Never mentions reliability, age, or location detail. */
export const rankReasonText = (reason: RankReason): string => {
  switch (reason.kind) {
    case "interest":
      return `Cares about ${CAUSE_AREA_LABELS[reason.causeArea].toLowerCase()}`;
    case "skills":
      return `Skills: ${reason.skills.join(", ")}`;
    case "availability":
      return `Free ${WEEKDAY_WORDS[reason.weekday]} ${reason.block}s`;
    case "nearby":
      return "Lives nearby";
    case "virtual":
      return "Virtual shift";
    case "past-volunteer":
      return "Volunteered with you";
  }
};

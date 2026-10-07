/**
 * plannerPrefill.ts
 * Maps a planner draft (shared/plannerParse.ts, SPEC#screen-planner 9.14)
 * onto the new-shift form: title, cause area, and place go to the
 * opportunity form; date, start, end, and volunteer count go to the shift
 * form. Only recognized fields are filled; `filled` names them so the form
 * can highlight each one for the coordinator to check. Nothing is submitted
 * from here: the coordinator reviews and presses the form's own buttons.
 *
 * Warnings become plain hints. A weekly recurrence sets `repeatsWeekly`, and
 * the new-shift page then opens the Tier 2 repeat form instead of one shift.
 */
import { MAX_CAPACITY, type CauseArea, type PlannerDraft, type PlannerWarning } from "@fbla/shared";

// Tier 2 lane B: "description" is filled only by the AI planner (ai.shiftPlannerParse).
export type PrefillField = "title" | "causeArea" | "location" | "date" | "startTime" | "endTime" | "capacity" | "description";

export interface PlannerPrefill {
  readonly title?: string;
  readonly causeArea?: CauseArea;
  /** Free text such as "the food bank"; goes in Street address for the coordinator to complete. */
  readonly location?: string;
  readonly date?: string;
  readonly startTime?: string;
  readonly endTime?: string;
  readonly capacity?: number;
  /** Tier 2 lane B: AI-written listing description (never from the deterministic parser). */
  readonly description?: string;
  readonly filled: ReadonlySet<PrefillField>;
  readonly hints: readonly string[];
  // Tier 2 lane A: "every Saturday" in the sentence; the page preselects "Repeats".
  readonly repeatsWeekly?: true;
}

const WARNING_HINTS: Readonly<Record<PlannerWarning, string>> = {
  "input-truncated": "Only the first 2,000 characters were read.",
  "count-capped": `Shifts hold at most ${MAX_CAPACITY} people, so the volunteer count was lowered.`,
  "count-invalid": "A count of zero was ignored. Enter how many people you need.",
  "time-assumed": "No AM or PM was given, so we guessed. Check the times.",
  "ends-next-day": "The end time is after midnight, so the shift ends the next day.",
  "time-range-invalid": "The start and end times were the same, so the end time was left blank.",
  "weekday-mismatch": "The weekday and the date disagree. We used the date.",
  "reference-date-invalid": "We couldn't work out today's date, so relative days like Saturday were skipped."
};

const WEEKLY_HINT = "This repeats every week, so the schedule below is set to Repeats. Check the days, then save.";

/** "HH:mm" plus minutes, wrapping past midnight. */
const addMinutes = (hhmm: string, minutes: number): string => {
  const [hours = 0, mins = 0] = hhmm.split(":").map(Number);
  const total = (hours * 60 + mins + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

export const prefillFromDraft = (draft: PlannerDraft): PlannerPrefill => {
  const endTime = draft.endTime ?? (draft.startTime !== null && draft.durationMinutes !== null ? addMinutes(draft.startTime, draft.durationMinutes) : null);
  const values = {
    title: draft.title,
    causeArea: draft.causeArea,
    location: draft.location,
    date: draft.date,
    startTime: draft.startTime,
    endTime,
    capacity: draft.volunteersNeeded
  };
  const entries = Object.entries(values).filter(([, value]) => value !== null) as Array<[PrefillField, string | number]>;
  const hints = [...draft.warnings.map((warning) => WARNING_HINTS[warning]), ...(draft.recurrence === "weekly" ? [WEEKLY_HINT] : [])];
  const repeats = draft.recurrence === "weekly" ? { repeatsWeekly: true as const } : {};
  return { ...(Object.fromEntries(entries) as Omit<PlannerPrefill, "filled" | "hints">), filled: new Set(entries.map(([field]) => field)), hints, ...repeats };
};

/** Field labels for the "We filled in ..." summary, in form order. */
const FIELD_LABELS: Readonly<Record<PrefillField, string>> = {
  title: "title",
  causeArea: "cause area",
  location: "place",
  date: "date",
  startTime: "start time",
  endTime: "end time",
  capacity: "volunteers needed",
  description: "description"
};

/** "We filled in title, date, and start time. Check each highlighted field." */
export const prefillSummary = (prefill: PlannerPrefill): string => {
  const names = (Object.keys(FIELD_LABELS) as PrefillField[]).filter((field) => prefill.filled.has(field)).map((field) => FIELD_LABELS[field]);
  if (names.length === 0) return "We couldn't find shift details in that. Try something like: need 12 people Sat 9-1 sorting at the food bank.";
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")}${names.length > 2 ? "," : ""} and ${names.at(-1)}`;
  return `We filled in ${list}. Check each highlighted field, then save.`;
};

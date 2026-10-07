/**
 * plannerReply.ts
 * The output contract for ai.shiftPlannerParse (SPEC 8.4, Tier 2). The model
 * returns a flat JSON object (PLANNER_REPLY_JSON_SCHEMA, sent as the
 * provider's structured-output format); this file validates it strictly
 * with zod and turns it into the shared PlannerDraft, deriving the fields the
 * model is not trusted to compute (weekday, duration, matched, warnings).
 * The final draft is checked once more against plannerDraftSchema, the same
 * schema the deterministic parser's output satisfies.
 *
 * Any problem (not JSON, extra keys, wrong types, a date before today in the
 * org's zone) throws AssistantModelError("bad-output"), which makes the op
 * answer with the deterministic parser instead.
 */
import { z } from "zod";
import {
  PLANNER_DESCRIPTION_MAX,
  PLANNER_FIELDS,
  PLANNER_MAX_LOCATION_CHARS,
  PLANNER_MAX_TITLE_CHARS,
  PLANNER_MAX_VOLUNTEERS,
  causeAreaSchema,
  plannerDraftSchema,
  ymdSchema,
  type PlannerDraft,
  type PlannerWarning
} from "@fbla/shared";
import { toPlainAnswer } from "./assistantAnswer";
import { AssistantModelError } from "./assistantModel";

const MINUTES_PER_DAY = 1440;
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
/** Generous so a slightly long description is clipped rather than failing the whole draft. */
const DESCRIPTION_RAW_MAX = 2_000;

export const plannerReplySchema = z
  .object({
    title: z.string().trim().min(1).max(PLANNER_MAX_TITLE_CHARS).nullable(),
    volunteersNeeded: z.number().int().min(1).max(PLANNER_MAX_VOLUNTEERS).nullable(),
    date: ymdSchema.nullable(),
    startTime: hhmm.nullable(),
    endTime: hhmm.nullable(),
    location: z.string().trim().min(1).max(PLANNER_MAX_LOCATION_CHARS).nullable(),
    causeArea: causeAreaSchema.nullable(),
    weekly: z.boolean(),
    description: z.string().trim().min(1).max(DESCRIPTION_RAW_MAX).nullable()
  })
  .strict();
export type PlannerReply = z.infer<typeof plannerReplySchema>;

const nullable = (type: string, extra: Record<string, unknown> = {}) => ({ type: [type, "null"], ...extra });

/** The same contract as JSON Schema for structured output (every key required, nulls allowed). */
export const PLANNER_REPLY_JSON_SCHEMA = Object.freeze({
  type: "object",
  properties: {
    title: nullable("string", { description: "Short shift title, at most 80 characters." }),
    volunteersNeeded: nullable("integer", { description: "How many volunteers are needed (1-200)." }),
    date: nullable("string", { description: "Shift date as YYYY-MM-DD." }),
    startTime: nullable("string", { description: "Start time, 24-hour HH:MM." }),
    endTime: nullable("string", { description: "End time, 24-hour HH:MM." }),
    location: nullable("string", { description: "Place as written, at most 120 characters." }),
    causeArea: nullable("string", { enum: [...causeAreaSchema.options, null] }),
    weekly: { type: "boolean", description: "True only if the text says the shift repeats every week." },
    description: nullable("string", { description: "One to three plain sentences for the volunteer listing." })
  },
  required: ["title", "volunteersNeeded", "date", "startTime", "endTime", "location", "causeArea", "weekly", "description"],
  additionalProperties: false
});

const toMinutes = (value: string): number => {
  const [hours = 0, minutes = 0] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

const weekdayOf = (ymd: string): number => new Date(`${ymd}T12:00:00Z`).getUTCDay();

interface TimeFields {
  readonly endTime: string | null;
  readonly durationMinutes: number | null;
  readonly warnings: readonly PlannerWarning[];
}

/** Same rules as the parser: equal times drop the end; an earlier end runs past midnight. */
const timeFields = (start: string | null, end: string | null): TimeFields => {
  if (start === null || end === null) return { endTime: end, durationMinutes: null, warnings: [] };
  if (start === end) return { endTime: null, durationMinutes: null, warnings: ["time-range-invalid"] };
  const gap = toMinutes(end) - toMinutes(start);
  return gap > 0 ? { endTime: end, durationMinutes: gap, warnings: [] } : { endTime: end, durationMinutes: gap + MINUTES_PER_DAY, warnings: ["ends-next-day"] };
};

/** Validates raw model text (JSON, optionally in a ```json fence) against the reply schema. */
export const parsePlannerReply = (raw: string): PlannerReply => {
  const unfenced = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let json: unknown;
  try {
    json = JSON.parse(unfenced);
  } catch {
    throw new AssistantModelError("bad-output", "reply is not JSON");
  }
  const parsed = plannerReplySchema.safeParse(json);
  if (!parsed.success) throw new AssistantModelError("bad-output", "reply does not match the schema");
  return parsed.data;
};

/** Plain-text description clipped to the listing limit, or null. */
export const cleanDescription = (raw: string | null): string | null => {
  if (raw === null) return null;
  const text = toPlainAnswer(raw).replace(/\s+/g, " ").trim();
  if (text === "") return null;
  return text.length <= PLANNER_DESCRIPTION_MAX ? text : `${text.slice(0, PLANNER_DESCRIPTION_MAX - 1).trimEnd()}…`;
};

/** Builds the shared draft from a validated reply. `referenceDate` is today in the org zone. */
export const draftFromReply = (reply: PlannerReply, referenceDate: string): PlannerDraft => {
  if (reply.date !== null && reply.date < referenceDate) throw new AssistantModelError("bad-output", "date is in the past");
  const times = timeFields(reply.startTime, reply.endTime);
  const fields = {
    title: reply.title,
    volunteersNeeded: reply.volunteersNeeded,
    date: reply.date,
    weekday: reply.date === null ? null : weekdayOf(reply.date),
    recurrence: reply.weekly ? ("weekly" as const) : null,
    startTime: reply.startTime,
    endTime: times.endTime,
    durationMinutes: times.durationMinutes,
    location: reply.location,
    causeArea: reply.causeArea
  };
  const draft = { ...fields, matched: PLANNER_FIELDS.filter((field) => fields[field] !== null), warnings: [...times.warnings] };
  const checked = plannerDraftSchema.safeParse(draft);
  if (!checked.success) throw new AssistantModelError("bad-output", "draft does not match plannerDraftSchema");
  return checked.data;
};

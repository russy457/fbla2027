/**
 * plannerParse.ts
 * Deterministic shift-planner parser (SPEC#ai 8.4, SPEC#screen-planner 9.14).
 * Turns one coordinator sentence such as
 *   "need 12 people Sat 9-1 sorting at the food bank"
 * into a structured draft: count, date or weekday, recurrence, time range,
 * location text, cause area, and a short title. Every field is nullable so
 * the form can show what was recognized and leave the rest for the
 * coordinator. The function is pure: no clock reads, no I/O, no randomness.
 * "Today" comes in as `referenceDate`, a YYYY-MM-DD local date in the org's
 * time zone, so the same input always gives the same draft.
 *
 * It is Tier 1 on the client and the Tier 2 fallback on the server: when
 * ai.shiftPlannerParse is off, rate limited, times out, or returns output
 * that fails `plannerDraftSchema`, the Function answers with this parser.
 *
 * Usage, client (coordinator planner form):
 *   const referenceDate = localDateIn(new Date(clock.nowMs()), org.timeZone);
 *   const draft = parsePlannerText(input, { referenceDate });
 *   // Fill each form field that is not null and highlight draft.matched;
 *   // show draft.warnings as hints next to the affected fields.
 *
 * Usage, server (ai.shiftPlannerParse fallback):
 *   const fallback = () => ({ source: "parser", draft: parsePlannerText(text, { referenceDate, maxInputChars: config.aiMaxInputChars }) });
 *   const parsed = plannerDraftSchema.safeParse(modelJson);
 *   return parsed.success ? { source: "ai", draft: parsed.data } : fallback();
 *
 * Input limit: text longer than `maxInputChars` (default
 * DEFAULT_CONFIG.aiMaxInputChars, 2,000) is cut to that length before parsing
 * and the draft carries the "input-truncated" warning. The function never
 * throws for any string.
 *
 * Time rules (documented here because the UI copy depends on them):
 * - "9am", "9 a.m.", "9a", "9:30pm", and "noon" are explicit.
 * - Hours 0 and 13-23, and hours written with a leading zero ("08:00"), are
 *   24-hour clock times and are explicit.
 * - Any other bare hour 1-12 is ambiguous. With no clue at all, 1-6 and 12
 *   mean PM (afternoon shifts, noon) and 7-11 mean AM.
 * - In a range, an ambiguous side takes the AM or PM reading that makes the
 *   shift shortest while still moving forward in time: "9-1" is 9:00-13:00,
 *   "2-5pm" is 14:00-17:00, "9-1pm" is 9:00-13:00, "11pm-2" ends at 2:00.
 * - A range whose end is still before its start runs past midnight; the
 *   duration counts into the next day and "ends-next-day" is added.
 * - A single time needs a clue to count as a time: a meridiem, "noon", a
 *   colon ("18:30"), or a lead-in such as "at" or "starting".
 */
import { z } from "zod";
import { DEFAULT_CONFIG } from "./config";
import { causeAreaSchema, ymdSchema, type CauseArea } from "./schemas/common";
import { isValidYmd } from "./time";

/** Fields the parser can fill, in form order; `matched` lists a subset. */
export const PLANNER_FIELDS = [
  "title",
  "volunteersNeeded",
  "date",
  "weekday",
  "recurrence",
  "startTime",
  "endTime",
  "durationMinutes",
  "location",
  "causeArea"
] as const;
export const plannerFieldSchema = z.enum(PLANNER_FIELDS);
export type PlannerField = z.infer<typeof plannerFieldSchema>;

/**
 * Hints for the coordinator. Each code maps to UI copy next to a field:
 * - input-truncated: text was longer than the input limit and was cut.
 * - count-capped: count was above the per-shift capacity and was lowered.
 * - count-invalid: a count of zero was ignored.
 * - time-assumed: no AM/PM clue, so the default rules picked one.
 * - ends-next-day: the end time is earlier than the start, so it ends after midnight.
 * - time-range-invalid: start and end were the same, so the end was dropped.
 * - weekday-mismatch: a weekday and an explicit date disagree; the date wins.
 * - reference-date-invalid: options.referenceDate is not a real YYYY-MM-DD, so
 *   relative and year-less dates ("Sat", "tomorrow", "Oct 12") stay null.
 */
export const PLANNER_WARNINGS = [
  "input-truncated",
  "count-capped",
  "count-invalid",
  "time-assumed",
  "ends-next-day",
  "time-range-invalid",
  "weekday-mismatch",
  "reference-date-invalid"
] as const;
export const plannerWarningSchema = z.enum(PLANNER_WARNINGS);
export type PlannerWarning = z.infer<typeof plannerWarningSchema>;

/** Same ceiling as instance capacity (instanceDocSchema.capacity max). */
export const PLANNER_MAX_VOLUNTEERS = 200;
/** Same ceiling as opportunity titles (opportunityDocSchema.title max). */
export const PLANNER_MAX_TITLE_CHARS = 80;
/** Same ceiling as an address line (addressSchema.line1 max). */
export const PLANNER_MAX_LOCATION_CHARS = 120;

const MINUTES_PER_DAY = 1440;
const NOON_MINUTES = 720;

const hhmmSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "must be a time as HH:MM" });

/**
 * The draft shape. The Tier 2 AI op validates model output against this same
 * schema, so a draft looks the same whether the parser or the model made it.
 */
export const plannerDraftSchema = z.object({
  title: z.string().min(1).max(PLANNER_MAX_TITLE_CHARS).nullable(),
  volunteersNeeded: z.number().int().min(1).max(PLANNER_MAX_VOLUNTEERS).nullable(),
  date: ymdSchema.nullable(),
  /** 0 = Sunday ... 6 = Saturday. */
  weekday: z.number().int().min(0).max(6).nullable(),
  recurrence: z.literal("weekly").nullable(),
  startTime: hhmmSchema.nullable(),
  endTime: hhmmSchema.nullable(),
  durationMinutes: z.number().int().min(1).max(MINUTES_PER_DAY).nullable(),
  location: z.string().min(1).max(PLANNER_MAX_LOCATION_CHARS).nullable(),
  causeArea: causeAreaSchema.nullable(),
  matched: z.array(plannerFieldSchema).readonly(),
  warnings: z.array(plannerWarningSchema).readonly()
});
export type PlannerDraft = Readonly<z.infer<typeof plannerDraftSchema>>;

export interface PlannerParseOptions {
  /** Today as YYYY-MM-DD in the org time zone; relative dates resolve from it. */
  readonly referenceDate: string;
  /** Longest input parsed; defaults to DEFAULT_CONFIG.aiMaxInputChars. */
  readonly maxInputChars?: number;
  /** When only a start time is found, the end is start + this many minutes. */
  readonly defaultDurationMinutes?: number;
}

/* ------------------------------------------------------------------------ */
/* Span bookkeeping: each extractor claims the text it used, so later       */
/* extractors (and the title) never reuse the same characters.              */
/* ------------------------------------------------------------------------ */

interface Span {
  readonly start: number;
  readonly end: number;
}

const overlapsAny = (span: Span, taken: readonly Span[]): boolean =>
  taken.some((other) => span.start < other.end && other.start < span.end);

const spanOf = (match: RegExpExecArray): Span => ({ start: match.index, end: match.index + match[0].length });

/** First match of `source` that does not overlap claimed text and passes `accept`. */
const findFree = (
  text: string,
  source: string,
  taken: readonly Span[],
  accept: (match: RegExpExecArray) => boolean
): RegExpExecArray | null => {
  const pattern = new RegExp(source, "gi");
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (!overlapsAny(spanOf(match), taken) && accept(match)) return match;
  }
  return null;
};

const always = (): boolean => true;

/** Characters that may not sit right before a number we read as a count, time, or date. */
const NOT_AFTER = String.raw`(?<![\w:/.\-])`;

/* ------------------------------------------------------------------------ */
/* Calendar helpers (UTC arithmetic on plain dates, never the local clock)  */
/* ------------------------------------------------------------------------ */

const pad2 = (value: number): string => String(value).padStart(2, "0");

const toYmd = (year: number, month: number, day: number): string => `${year}-${pad2(month)}-${pad2(day)}`;

const ymdToUtc = (ymd: string): Date => {
  const [year, month, day] = ymd.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day));
};

const addDays = (ymd: string, days: number): string => {
  const base = ymdToUtc(ymd);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
};

const weekdayOf = (ymd: string): number => ymdToUtc(ymd).getUTCDay();

/** The first date strictly after `referenceDate` that falls on `weekday`. */
const nextWeekday = (referenceDate: string, weekday: number): string => {
  const ahead = (weekday - weekdayOf(referenceDate) + 7) % 7;
  return addDays(referenceDate, ahead === 0 ? 7 : ahead);
};

/** Month and day with no year: this year if not yet past, else next year. */
const nextMonthDay = (referenceDate: string, month: number, day: number): string | null => {
  const year = Number(referenceDate.slice(0, 4));
  const thisYear = toYmd(year, month, day);
  const candidate = thisYear >= referenceDate ? thisYear : toYmd(year + 1, month, day);
  return isValidYmd(candidate) ? candidate : null;
};

/* ------------------------------------------------------------------------ */
/* Dates                                                                    */
/* ------------------------------------------------------------------------ */

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;
const MONTH_SOURCE =
  "(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)";

interface DateHit {
  readonly date: string;
  readonly span: Span;
}

/** Applies `resolve` to the first free match whose resolution is a real date. */
const firstResolved = (
  text: string,
  source: string,
  taken: readonly Span[],
  resolve: (match: RegExpExecArray) => string | null
): DateHit | null => {
  let date: string | null = null;
  const match = findFree(text, source, taken, (candidate) => {
    date = resolve(candidate);
    return date !== null;
  });
  return match && date ? { date, span: spanOf(match) } : null;
};

const fullYear = (raw: string): number => (raw.length === 2 ? 2000 + Number(raw) : Number(raw));

/**
 * Explicit dates, tried in this order: ISO "2026-10-12", US numeric "10/12"
 * or "10/12/2026", month name "Oct 12" or "October 12th, 2026", then
 * "today"/"tonight"/"tomorrow". Year-less and relative forms need a valid
 * reference date.
 */
const extractDate = (text: string, referenceDate: string | null, taken: readonly Span[]): DateHit | null => {
  const iso = firstResolved(text, String.raw`\b(\d{4})-(\d{2})-(\d{2})\b`, taken, (m) => {
    const ymd = `${m[1]}-${m[2]}-${m[3]}`;
    return isValidYmd(ymd) ? ymd : null;
  });
  if (iso) return iso;

  const fromParts = (month: number, day: number, year: string | undefined): string | null => {
    if (year) {
      const ymd = toYmd(fullYear(year), month, day);
      return isValidYmd(ymd) ? ymd : null;
    }
    return referenceDate ? nextMonthDay(referenceDate, month, day) : null;
  };

  const numeric = firstResolved(text, NOT_AFTER + String.raw`(\d{1,2})/(\d{1,2})(?:/(\d{4}|\d{2}))?(?![\w/])`, taken, (m) =>
    fromParts(Number(m[1]), Number(m[2]), m[3])
  );
  if (numeric) return numeric;

  const named = firstResolved(
    text,
    String.raw`\b${MONTH_SOURCE}\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?(?![\w])`,
    taken,
    (m) => fromParts(MONTHS.indexOf((m[1] as string).slice(0, 3).toLowerCase() as (typeof MONTHS)[number]) + 1, Number(m[2]), m[3])
  );
  if (named) return named;

  return firstResolved(text, String.raw`\b(today|tonight|tomorrow)\b`, taken, (m) => {
    if (!referenceDate) return null;
    return /^tom/i.test(m[1] as string) ? addDays(referenceDate, 1) : referenceDate;
  });
};

/* ------------------------------------------------------------------------ */
/* Weekdays and recurrence                                                  */
/* ------------------------------------------------------------------------ */

/** Index into this list is the JS weekday (0 = Sunday); keys are 2-letter prefixes. */
const WEEKDAY_PREFIXES = ["su", "mo", "tu", "we", "th", "fr", "sa"] as const;

const WEEKDAY_SOURCE =
  "(sunday|sun|monday|mon|tuesday|tues|tue|wednesday|weds|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat)";

interface WeekdayHit {
  readonly weekday: number;
  readonly weekly: boolean;
  readonly span: Span;
}

/**
 * "Sat", "Sat.", "Saturday", "on Saturday", "next Sat": one occurrence.
 * "every Saturday", "each Sat", "Saturdays": weekly.
 */
const extractWeekday = (text: string, taken: readonly Span[]): WeekdayHit | null => {
  const match = findFree(text, String.raw`\b(?:(every|each|on|this|next)\s+)?${WEEKDAY_SOURCE}(s)?\b\.?`, taken, always);
  if (!match) return null;
  const prefix = (match[2] as string).slice(0, 2).toLowerCase();
  const weekday = WEEKDAY_PREFIXES.indexOf(prefix as (typeof WEEKDAY_PREFIXES)[number]);
  const weekly = /^e/i.test(match[1] ?? "") || match[3] !== undefined;
  return { weekday, weekly, span: spanOf(match) };
};

/** "weekly", "every week", "each week". */
const extractWeeklyWord = (text: string, taken: readonly Span[]): Span | null => {
  const match = findFree(text, String.raw`\b(?:weekly|(?:every|each)\s+week)\b`, taken, always);
  return match ? spanOf(match) : null;
};

/* ------------------------------------------------------------------------ */
/* Times                                                                    */
/* ------------------------------------------------------------------------ */

/** One clock time; groups: noon, hour, minutes, meridiem. */
const TIME_TOKEN = String.raw`(?:(noon)\b|(\d{1,2})(?::([0-5]\d))?(?![\d:])\s*(a\.?m\.?|p\.?m\.?|a|p)?(?![a-z]))`;

const COUNT_NOUNS =
  "(?:volunteers?|vols|people|persons|helpers?|spots?|slots?|seats?|folks|hands|workers?|openings?|positions?)";

interface ClockTime {
  /** True when the text alone fixes the time (meridiem, noon, or 24-hour form). */
  readonly explicit: boolean;
  /** Possible minutes after midnight: one value when explicit, AM and PM readings otherwise. */
  readonly candidates: readonly number[];
}

/** Reads one TIME_TOKEN from four groups; null when the numbers are not a clock time. */
const readClock = (noon: string | undefined, hourRaw: string | undefined, minuteRaw: string | undefined, meridiem: string | undefined): ClockTime | null => {
  if (noon) return { explicit: true, candidates: [NOON_MINUTES] };
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw ?? "0");
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    const offset = /^p/i.test(meridiem) ? NOON_MINUTES : 0;
    return { explicit: true, candidates: [(hour % 12) * 60 + minute + offset] };
  }
  if (hour > 23) return null;
  if (hour === 0 || hour > 12 || (hourRaw as string).startsWith("0")) {
    return { explicit: true, candidates: [hour * 60 + minute] };
  }
  const am = (hour % 12) * 60 + minute;
  // Default reading with no clue: 1-6 and 12 are afternoon, 7-11 are morning.
  const pmFirst = hour <= 6 || hour === 12;
  return { explicit: false, candidates: pmFirst ? [am + NOON_MINUTES, am] : [am, am + NOON_MINUTES] };
};

/** Minutes from `from` forward to `to`, in 1..1440 (equal times count as a full day). */
const forwardGap = (from: number, to: number): number => ((to - from + MINUTES_PER_DAY - 1) % MINUTES_PER_DAY) + 1;

/** The candidate that gives the smallest forward gap, measured by `gapOf`. */
const closest = (candidates: readonly number[], gapOf: (value: number) => number): number =>
  candidates.reduce((best, value) => (gapOf(value) < gapOf(best) ? value : best));

interface TimeHit {
  readonly start: number;
  readonly end: number | null;
  readonly assumed: boolean;
  readonly span: Span;
}

/** Resolves AM/PM on both sides of a range (see the header for the rules). */
const resolveRange = (from: ClockTime, to: ClockTime): { start: number; end: number } => {
  if (!from.explicit && to.explicit) {
    const end = to.candidates[0] as number;
    return { start: closest(from.candidates, (value) => forwardGap(value, end)), end };
  }
  const start = from.candidates[0] as number;
  return { start, end: closest(to.candidates, (value) => forwardGap(start, value)) };
};

const RANGE_SOURCE =
  NOT_AFTER +
  String.raw`(?:from\s+)?${TIME_TOKEN}\s*(?:-|\bto\b|\buntil\b|\btill\b|\bthru\b|\bthrough\b)\s*${TIME_TOKEN}(?!\s*(?:more\s+)?${COUNT_NOUNS}\b)`;

const SINGLE_SOURCE =
  NOT_AFTER + String.raw`(?:(at|from|starting(?:\s+at)?|starts?\s+at|begins?\s+at)\s+)?${TIME_TOKEN}`;

/** A time range ("9-1", "from 9 to 12", "10a-2p"), else a single start time ("at 9am"). */
const extractTimes = (text: string, taken: readonly Span[]): TimeHit | null => {
  let range: { from: ClockTime; to: ClockTime } | null = null;
  const rangeMatch = findFree(text, RANGE_SOURCE, taken, (m) => {
    const from = readClock(m[1], m[2], m[3], m[4]);
    const to = readClock(m[5], m[6], m[7], m[8]);
    range = from && to ? { from, to } : null;
    return range !== null;
  });
  if (rangeMatch && range) {
    const { from, to } = range as { from: ClockTime; to: ClockTime };
    return { ...resolveRange(from, to), assumed: !from.explicit && !to.explicit, span: spanOf(rangeMatch) };
  }

  let single: ClockTime | null = null;
  const singleMatch = findFree(text, SINGLE_SOURCE, taken, (m) => {
    single = readClock(m[2], m[3], m[4], m[5]);
    // A lone number ("8", "18") is only a time with "noon", a meridiem, a lead-in word, or a colon.
    return single !== null && [m[1], m[2], m[4], m[5]].some((group) => group !== undefined);
  });
  if (singleMatch && single) {
    const clock = single as ClockTime;
    return { start: clock.candidates[0] as number, end: null, assumed: !clock.explicit, span: spanOf(singleMatch) };
  }
  return null;
};

const formatClock = (minutes: number): string => {
  const wrapped = minutes % MINUTES_PER_DAY;
  return `${pad2(Math.floor(wrapped / 60))}:${pad2(wrapped % 60)}`;
};

/* ------------------------------------------------------------------------ */
/* Volunteer count                                                          */
/* ------------------------------------------------------------------------ */

const NUMBER_WORDS: Readonly<Record<string, number>> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  dozen: 12
};

const NUMBER_SOURCE = String.raw`(\d{1,4}|(?:a\s+)?dozen|${Object.keys(NUMBER_WORDS)
  .filter((word) => word !== "dozen")
  .join("|")})`;

const readNumber = (raw: string): number => {
  const word = raw.toLowerCase().replace(/^a\s+/, "");
  return NUMBER_WORDS[word] ?? Number(word);
};

interface CountHit {
  readonly count: number;
  readonly span: Span;
}

/**
 * "8 volunteers", "12 people", "two helpers", "a dozen volunteers",
 * "8 spots", "10 adult volunteers" (one describing word allowed), then
 * "need 12" with no noun.
 */
const extractCount = (text: string, taken: readonly Span[]): CountHit | null => {
  const withNoun = findFree(text, NOT_AFTER + String.raw`${NUMBER_SOURCE}\s+(?:[a-z]+\s+)?${COUNT_NOUNS}(?![a-z])`, taken, always);
  const match =
    withNoun ??
    findFree(text, String.raw`\bneed(?:s|ed)?\s+(?:about\s+|around\s+|at\s+least\s+)?${NUMBER_SOURCE}(?![\w:/.\-])`, taken, always);
  return match ? { count: readNumber(match[1] as string), span: spanOf(match) } : null;
};

/* ------------------------------------------------------------------------ */
/* Location                                                                 */
/* ------------------------------------------------------------------------ */

/** Words that end a location phrase ("at the pantry every week"). */
const LOCATION_STOP = String.raw`\.(?:\s|$)|\s(?:need(?:s|ed)?|every|each|from|starting|weekly|between|looking|please)\b`;

interface LocationHit {
  readonly location: string;
  readonly span: Span;
}

/**
 * Text after "at" or "@", up to punctuation, a stop word, or the next piece
 * of text another extractor already claimed (a count, time, or day).
 */
const extractLocation = (text: string, taken: readonly Span[]): LocationHit | null => {
  const pattern = /(?:(?<!\w)at\s+|@\s*)(?![\s\d]|noon\b)([^,;!?\n()]+)/gi;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (overlapsAny({ start: match.index, end: match.index + 1 }, taken)) continue;
    const captureStart = match.index + match[0].length - (match[1] as string).length;
    const stopAt = (match[1] as string).search(new RegExp(LOCATION_STOP, "i"));
    let end = stopAt === -1 ? match.index + match[0].length : captureStart + stopAt;
    for (const span of taken) {
      if (span.start >= captureStart && span.start < end) end = span.start;
    }
    const location = text.slice(captureStart, end).trim().slice(0, PLANNER_MAX_LOCATION_CHARS).trim();
    if (/\p{L}/u.test(location)) {
      return { location, span: { start: match.index, end: captureStart + location.length } };
    }
  }
  return null;
};

/* ------------------------------------------------------------------------ */
/* Cause area                                                               */
/* ------------------------------------------------------------------------ */

/** Keyword stems per cause area id (shared CAUSE_AREAS). The earliest hit in the text wins. */
const CAUSE_KEYWORDS: ReadonlyArray<readonly [CauseArea, string]> = [
  ["hunger-food-security", "foods?|pantry|pantries|hunger|hungry|meals?|soup kitchen|groceries|grocery|canned|food bank"],
  ["education-youth", "tutor(?:s|ing)?|read(?:ing)?|literacy|school|homework|mentor(?:s|ing)?|youth|library|students?"],
  ["health-wellness", "health|clinic|hospital|blood drive|wellness|medical|nurses?"],
  ["environment", "parks?|clean-?ups?|litter|trash|recycl(?:e|ing)|trees?|garden(?:s|ing)?|beach|river|trails?|planting"],
  ["animal-welfare", "animals?|dogs?|cats?|puppies|kittens|pets?|shelter|humane|wildlife"],
  ["housing-homelessness", "homeless(?:ness)?|housing|habitat|home repairs?"],
  ["seniors", "seniors?|elderly|nursing home|retirement|aging"],
  ["arts-culture", "arts?|museum|mural|theat(?:er|re)|music|concert"],
  ["disaster-relief", "disaster|hurricane|flood(?:ing)?|tornado|wildfire|relief|red cross"],
  ["community-development", "community|neighbou?rhood|civic|block party"]
];

const detectCause = (text: string): CauseArea | null => {
  let best: { area: CauseArea; index: number } | null = null;
  for (const [area, words] of CAUSE_KEYWORDS) {
    const index = text.search(new RegExp(String.raw`\b(?:${words})\b`, "i"));
    if (index !== -1 && (best === null || index < best.index)) best = { area, index };
  }
  return best ? best.area : null;
};

/* ------------------------------------------------------------------------ */
/* Title                                                                    */
/* ------------------------------------------------------------------------ */

/** Words trimmed from the ends of a leftover phrase before it becomes the title. */
const FILLER_WORDS = new Set([
  "need", "needs", "needed", "needing", "we", "i", "our", "us", "looking", "for", "to", "help", "helping", "with",
  "on", "at", "the", "a", "an", "and", "please", "some", "volunteer", "volunteers", "people", "from", "in", "of",
  "is", "are", "will", "be", "who", "can", "want", "wanted", "hey", "hi", "-", "&", "+"
]);

const isFiller = (word: string): boolean => FILLER_WORDS.has(word.toLowerCase().replace(/[^\p{L}\p{N}'&+-]/gu, ""));

const trimFiller = (words: readonly string[]): readonly string[] => {
  let from = 0;
  let to = words.length;
  while (from < to && isFiller(words[from] as string)) from += 1;
  while (to > from && isFiller(words[to - 1] as string)) to -= 1;
  return words.slice(from, to);
};

const capTitle = (title: string): string => {
  if (title.length <= PLANNER_MAX_TITLE_CHARS) return title;
  const cut = title.slice(0, PLANNER_MAX_TITLE_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  return lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
};

/**
 * The title is the first leftover phrase (text no extractor claimed, split at
 * punctuation) that still has a letter after filler words are trimmed:
 * "Food sort every Saturday 9-12 ..." gives "Food sort", and
 * "need 12 people Sat 9-1 sorting at ..." gives "Sorting".
 */
const deriveTitle = (text: string, taken: readonly Span[]): string | null => {
  const sorted = [...taken].sort((a, b) => a.start - b.start);
  const gaps: string[] = [];
  let cursor = 0;
  for (const span of sorted) {
    gaps.push(text.slice(cursor, span.start));
    cursor = Math.max(cursor, span.end);
  }
  gaps.push(text.slice(cursor));
  for (const gap of gaps) {
    for (const piece of gap.split(/[,;!?\n()|]|\.(?=\s|$)|\s[-:]\s/)) {
      const words = trimFiller(piece.trim().split(/\s+/));
      const phrase = words.join(" ");
      if (/\p{L}/u.test(phrase)) {
        const title = capTitle(phrase);
        return title.charAt(0).toUpperCase() + title.slice(1);
      }
    }
  }
  return null;
};

/* ------------------------------------------------------------------------ */
/* Entry point                                                              */
/* ------------------------------------------------------------------------ */

const DASHES = /[\u2010-\u2015\u2212]/g;

interface TimeFields {
  readonly startTime: string | null;
  readonly endTime: string | null;
  readonly durationMinutes: number | null;
  readonly warnings: readonly PlannerWarning[];
}

const timeFields = (hit: TimeHit | null, defaultDurationMinutes: number | undefined): TimeFields => {
  if (!hit) return { startTime: null, endTime: null, durationMinutes: null, warnings: [] };
  const assumed: readonly PlannerWarning[] = hit.assumed ? ["time-assumed"] : [];
  const startTime = formatClock(hit.start);
  if (hit.end === null) {
    if (defaultDurationMinutes === undefined) return { startTime, endTime: null, durationMinutes: null, warnings: assumed };
    return { startTime, endTime: formatClock(hit.start + defaultDurationMinutes), durationMinutes: defaultDurationMinutes, warnings: assumed };
  }
  if (hit.end === hit.start) return { startTime, endTime: null, durationMinutes: null, warnings: [...assumed, "time-range-invalid"] };
  const nextDay: readonly PlannerWarning[] = hit.end < hit.start ? ["ends-next-day"] : [];
  return { startTime, endTime: formatClock(hit.end), durationMinutes: forwardGap(hit.start, hit.end), warnings: [...assumed, ...nextDay] };
};

const countFields = (hit: CountHit | null): { volunteersNeeded: number | null; warnings: readonly PlannerWarning[] } => {
  if (!hit) return { volunteersNeeded: null, warnings: [] };
  if (hit.count < 1) return { volunteersNeeded: null, warnings: ["count-invalid"] };
  if (hit.count > PLANNER_MAX_VOLUNTEERS) return { volunteersNeeded: PLANNER_MAX_VOLUNTEERS, warnings: ["count-capped"] };
  return { volunteersNeeded: hit.count, warnings: [] };
};

/**
 * Parses one planner sentence into a draft. Pure and deterministic: the same
 * text and options always give the same draft, and no string input throws.
 */
export const parsePlannerText = (text: string, options: PlannerParseOptions): PlannerDraft => {
  const maxChars = options.maxInputChars ?? DEFAULT_CONFIG.aiMaxInputChars;
  const truncated = text.length > maxChars;
  // Unicode dashes become "-" one for one, so claimed spans stay aligned with the input.
  const input = (truncated ? text.slice(0, maxChars) : text).replace(DASHES, "-");
  const referenceDate = isValidYmd(options.referenceDate) ? options.referenceDate : null;

  // Order matters: dates and days first so "Oct 12" is never a count or a time,
  // times before counts so "9-12" is never "9", and location after all of them
  // so it can stop where a count or day begins.
  const taken: Span[] = [];
  const claim = <T extends { readonly span: Span }>(hit: T | null): T | null => {
    if (hit) taken.push(hit.span);
    return hit;
  };
  const dateHit = claim(extractDate(input, referenceDate, taken));
  const weekdayHit = claim(extractWeekday(input, taken));
  const weeklySpan = extractWeeklyWord(input, taken);
  if (weeklySpan) taken.push(weeklySpan);
  const times = timeFields(claim(extractTimes(input, taken)), options.defaultDurationMinutes);
  const count = countFields(claim(extractCount(input, taken)));
  const locationHit = claim(extractLocation(input, taken));

  const weekdayDate = weekdayHit && referenceDate ? nextWeekday(referenceDate, weekdayHit.weekday) : null;
  const date = dateHit ? dateHit.date : weekdayDate;
  const weekday = dateHit ? weekdayOf(dateHit.date) : (weekdayHit?.weekday ?? null);
  const mismatch = dateHit !== null && weekdayHit !== null && weekdayHit.weekday !== weekday;

  const warnings: readonly PlannerWarning[] = [
    ...(truncated ? (["input-truncated"] as const) : []),
    ...count.warnings,
    ...times.warnings,
    ...(mismatch ? (["weekday-mismatch"] as const) : []),
    ...(referenceDate === null ? (["reference-date-invalid"] as const) : [])
  ];

  const fields = {
    title: deriveTitle(input, taken),
    volunteersNeeded: count.volunteersNeeded,
    date,
    weekday,
    recurrence: weekdayHit?.weekly || weeklySpan ? ("weekly" as const) : null,
    startTime: times.startTime,
    endTime: times.endTime,
    durationMinutes: times.durationMinutes,
    location: locationHit ? locationHit.location : null,
    causeArea: detectCause(input)
  };
  const matched = PLANNER_FIELDS.filter((field) => fields[field] !== null);
  return { ...fields, matched, warnings };
};

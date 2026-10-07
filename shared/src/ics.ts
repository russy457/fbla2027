/**
 * ics.ts
 * Per-signup calendar files (SPEC#ics 8.7, E2, X14). One VEVENT per
 * signup, written in the organization's time zone with a matching VTIMEZONE,
 * so a 9:00 AM shift stays 9:00 AM in any calendar app, across daylight
 * saving changes.
 *
 *   UID       {signupId}@{appHost}  (stable: re-downloading updates the event)
 *   SEQUENCE  instance.sequence, + 1 for a cancellation
 *   DTSTAMP   the caller's clock (never the wall clock here)
 *   cancelled METHOD:CANCEL + STATUS:CANCELLED (best effort: some calendar
 *             apps ignore cancellations; the UI says to delete the event)
 *
 * The VTIMEZONE lists the zone's real offset changes in the event's year,
 * computed from the IANA database through date-fns-tz, instead of hardcoding
 * US rules, so a non-US or no-DST zone is also correct.
 */
import { DAY_MS, MINUTE_MS } from "./time";

export interface SignupIcsInput {
  readonly signupId: string;
  /** Host of the app, for example "pitchin.web.app"; makes the UID globally unique. */
  readonly appHost: string;
  /** Product name for PRODID. */
  readonly productName: string;
  readonly title: string;
  readonly orgName: string;
  readonly description?: string | null;
  /** Street address, or null for virtual shifts (the org name is used instead). */
  readonly location: string | null;
  /** Link back to the shift in the app. */
  readonly url?: string | null;
  readonly startMs: number;
  readonly endMs: number;
  /** The organization's IANA zone (instance.timeZone). */
  readonly timeZone: string;
  /** instance.sequence: bumped by the organization on every time change or cancel. */
  readonly sequence: number;
  /** DTSTAMP, from the app clock. */
  readonly stampMs: number;
  /** True for the "Download cancellation" file. */
  readonly cancelled: boolean;
}

const CRLF = "\r\n";
/** RFC 5545 3.1: lines longer than 75 octets are folded. */
const MAX_LINE_OCTETS = 75;

/** RFC 5545 3.3.11 TEXT escaping. */
export const escapeIcsText = (value: string): string =>
  value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** UTF-8 length of one code point (shared/ has no DOM or Node types, so no TextEncoder). */
export const utf8Length = (char: string): number => {
  const codePoint = char.codePointAt(0) ?? 0;
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  return codePoint < 0x10000 ? 3 : 4;
};

/** Folds one content line at 75 octets without splitting a multi-byte character. */
export const foldIcsLine = (line: string): string => {
  const parts: string[] = [];
  let current = "";
  let octets = 0;
  for (const char of line) {
    const size = utf8Length(char);
    // Continuation lines start with one space, which counts toward their 75 octets.
    const limit = parts.length === 0 ? MAX_LINE_OCTETS : MAX_LINE_OCTETS - 1;
    if (octets + size > limit) {
      parts.push(current);
      current = "";
      octets = 0;
    }
    current += char;
    octets += size;
  }
  parts.push(current);
  return parts.join(`${CRLF} `);
};

/** "+0530" / "-0600" from an offset in ms. */
export const formatIcsOffset = (offsetMs: number): string => {
  const sign = offsetMs < 0 ? "-" : "+";
  const totalMinutes = Math.abs(offsetMs) / MINUTE_MS;
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return `${sign}${hours}${minutes}`;
};

const pad2 = (value: number): string => String(value).padStart(2, "0");

/**
 * "20261017T090000" from a Date's UTC fields. Built by hand (not with
 * date-fns-tz) because the library re-reads wall times in the machine's own
 * zone, which shifts a time that falls in the machine's DST gap by an hour.
 */
const utcFields = (ms: number): string => {
  const at = new Date(ms);
  return `${at.getUTCFullYear()}${pad2(at.getUTCMonth() + 1)}${pad2(at.getUTCDate())}T${pad2(at.getUTCHours())}${pad2(at.getUTCMinutes())}${pad2(at.getUTCSeconds())}`;
};

const utcStamp = (ms: number): string => `${utcFields(ms)}Z`;
/** Wall-clock time in `timeZone`, from the instant plus that zone's offset at the instant. */
const localStamp = (ms: number, timeZone: string): string => utcFields(ms + offsetAt(timeZone, ms));

export interface ZoneTransition {
  /** First instant (epoch ms) with the new offset. */
  readonly atMs: number;
  readonly fromOffsetMs: number;
  readonly toOffsetMs: number;
}

const zonePart = (timeZone: string, ms: number, style: "longOffset" | "short"): string =>
  new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: style })
    .formatToParts(new Date(ms))
    .filter((part) => part.type === "timeZoneName")
    .map((part) => part.value)
    .join("");

/**
 * The zone's UTC offset at an instant, in ms, straight from Intl ("GMT-06:00",
 * or "GMT" for zero). date-fns-tz offset helpers work from wall times and can
 * be an hour off right after a spring-forward change, so they are not used.
 */
const offsetAt = (timeZone: string, ms: number): number => {
  const text = zonePart(timeZone, ms, "longOffset");
  if (text === "GMT") return 0;
  const magnitude = (Number(text.slice(4, 6)) * 60 + Number(text.slice(7, 9))) * MINUTE_MS;
  return text[3] === "-" ? -magnitude : magnitude;
};

/** Narrows a change of offset found between lo and hi down to the exact millisecond. */
const findChange = (timeZone: string, loMs: number, hiMs: number): number => {
  const before = offsetAt(timeZone, loMs);
  let lo = loMs;
  let hi = hiMs;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (offsetAt(timeZone, mid) === before) lo = mid;
    else hi = mid;
  }
  return hi;
};

/** Every offset change in a calendar year (UTC year bounds), oldest first. */
export const zoneTransitionsInYear = (timeZone: string, year: number): ZoneTransition[] => {
  const yearStart = Date.UTC(year, 0, 1);
  const yearEnd = Date.UTC(year + 1, 0, 1);
  const transitions: ZoneTransition[] = [];
  for (let dayMs = yearStart; dayMs < yearEnd; dayMs += DAY_MS) {
    const next = Math.min(dayMs + DAY_MS, yearEnd);
    const from = offsetAt(timeZone, dayMs);
    const to = offsetAt(timeZone, next);
    if (from !== to) transitions.push({ atMs: findChange(timeZone, dayMs, next), fromOffsetMs: from, toOffsetMs: to });
  }
  return transitions;
};

const observance = (kind: "STANDARD" | "DAYLIGHT", localStart: string, fromMs: number, toMs: number, name: string): string[] => [
  `BEGIN:${kind}`,
  `DTSTART:${localStart}`,
  `TZOFFSETFROM:${formatIcsOffset(fromMs)}`,
  `TZOFFSETTO:${formatIcsOffset(toMs)}`,
  `TZNAME:${name}`,
  `END:${kind}`
];

/**
 * VTIMEZONE for `timeZone` covering the year of `atMs`: the offset in force
 * on Jan 1, then each change. An observance is DAYLIGHT when its offset is
 * above the year's lowest (standard) offset, which also handles southern
 * hemisphere zones where January is summer time.
 */
export const buildVTimezone = (timeZone: string, atMs: number): string[] => {
  const year = new Date(atMs + offsetAt(timeZone, atMs)).getUTCFullYear();
  const yearStart = Date.UTC(year, 0, 1);
  const startOffset = offsetAt(timeZone, yearStart);
  const transitions = zoneTransitionsInYear(timeZone, year);
  const standardOffset = Math.min(startOffset, ...transitions.map((transition) => transition.toOffsetMs));
  const kindOf = (offsetMs: number): "STANDARD" | "DAYLIGHT" => (offsetMs > standardOffset ? "DAYLIGHT" : "STANDARD");
  const nameAt = (ms: number): string => zonePart(timeZone, ms, "short");
  return [
    "BEGIN:VTIMEZONE",
    `TZID:${timeZone}`,
    ...observance(kindOf(startOffset), `${year}0101T000000`, startOffset, startOffset, nameAt(yearStart)),
    ...transitions.flatMap((transition) =>
      observance(
        kindOf(transition.toOffsetMs),
        // DTSTART is the wall-clock time of the change as read before it (RFC 5545 3.6.5).
        utcFields(transition.atMs + transition.fromOffsetMs),
        transition.fromOffsetMs,
        transition.toOffsetMs,
        nameAt(transition.atMs)
      )
    ),
    "END:VTIMEZONE"
  ];
};

/** The whole .ics file for one signup, CRLF line endings, folded at 75 octets. */
export const buildSignupIcs = (input: SignupIcsInput): string => {
  const tz = input.timeZone;
  const description = [input.description ?? null, `Organization: ${input.orgName}`, input.url ? `Details: ${input.url}` : null]
    .filter((part): part is string => part !== null && part.trim() !== "")
    .join("\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${escapeIcsText(input.productName)}//Volunteer shifts//EN`,
    "CALSCALE:GREGORIAN",
    `METHOD:${input.cancelled ? "CANCEL" : "PUBLISH"}`,
    ...buildVTimezone(tz, input.startMs),
    "BEGIN:VEVENT",
    `UID:${input.signupId}@${input.appHost}`,
    `SEQUENCE:${input.sequence + (input.cancelled ? 1 : 0)}`,
    `DTSTAMP:${utcStamp(input.stampMs)}`,
    `DTSTART;TZID=${tz}:${localStamp(input.startMs, tz)}`,
    `DTEND;TZID=${tz}:${localStamp(input.endMs, tz)}`,
    `SUMMARY:${escapeIcsText(input.title)}`,
    `LOCATION:${escapeIcsText(input.location ?? input.orgName)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    ...(input.url ? [`URL:${input.url}`] : []),
    `STATUS:${input.cancelled ? "CANCELLED" : "CONFIRMED"}`,
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR"
  ];
  return `${lines.map(foldIcsLine).join(CRLF)}${CRLF}`;
};

/** A safe download name, for example "sort-and-pack-food-boxes.ics" or "...-cancelled.ics". */
export const icsFileName = (title: string, cancelled: boolean): string => {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "shift"}${cancelled ? "-cancelled" : ""}.ics`;
};

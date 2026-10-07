/**
 * match.ts
 * How well a shift fits a volunteer (SPEC#ai 8.4 "match score"; SPEC 9.2
 * Explore "Recommended"). Volunteers' own recommendations are ranked on the
 * client from their private profile, WITHOUT reliability (T3); the Tier 2
 * coordinator ranking multiplies this same score by reliability.
 *
 * Score in [0, 1], a weighted sum of four signals, each also returned as a
 * reason so the UI can say why ("one-line why"):
 *   interest      0.40  the shift's cause area is one of the volunteer's interests
 *   skills        0.25  share of the shift's skills the volunteer listed
 *   availability  0.20  the volunteer marked that weekday and time block free
 *   nearby        0.15  shared geohash prefix with their ZIP centroid (or virtual)
 * Weekday and time block are read in the shift's own zone (SPEC 7.5).
 */
import { formatInTimeZone } from "date-fns-tz";
import type { CauseArea } from "./schemas/common";
import type { Availability } from "./schemas/userDocs";

export const MATCH_WEIGHTS = Object.freeze({ interest: 0.4, skills: 0.25, availability: 0.2, nearby: 0.15 });

export const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];
export const TIME_BLOCKS = ["morning", "afternoon", "evening"] as const;
export type TimeBlock = (typeof TIME_BLOCKS)[number];

/** Hours (local, 24 h) where the afternoon and evening blocks begin. */
const AFTERNOON_FROM_HOUR = 12;
const EVENING_FROM_HOUR = 17;

/** Geohash precision 5 cells are about 5 km; 4 about 40 km; 3 about 150 km. */
const NEARBY_PREFIX_SCORES: ReadonlyArray<readonly [number, number]> = [
  [5, 1],
  [4, 0.6],
  [3, 0.3]
];

/** Weekday of an instant in a zone, as an availability key. */
export const weekdayKeyOf = (atMs: number, timeZone: string): WeekdayKey => {
  // ISO day number: 1 = Monday ... 7 = Sunday.
  const isoDay = Number(formatInTimeZone(new Date(atMs), timeZone, "i"));
  return WEEKDAY_KEYS[isoDay - 1] as WeekdayKey;
};

/** Time block of an instant in a zone: before noon, noon to 5 PM, or later. */
export const timeBlockOf = (atMs: number, timeZone: string): TimeBlock => {
  const hour = Number(formatInTimeZone(new Date(atMs), timeZone, "H"));
  if (hour < AFTERNOON_FROM_HOUR) return "morning";
  return hour < EVENING_FROM_HOUR ? "afternoon" : "evening";
};

/** Number of leading characters two geohashes share. */
export const sharedGeohashPrefix = (a: string, b: string): number => {
  let length = 0;
  while (length < a.length && length < b.length && a[length] === b[length]) length += 1;
  return length;
};

export interface MatchProfile {
  readonly interests: readonly CauseArea[];
  readonly skills: readonly string[];
  readonly availability: Availability | null;
  /** Geohash (precision 5) of the volunteer's ZIP, or null. */
  readonly homeGeohash: string | null;
}

export interface MatchShift {
  readonly causeArea: CauseArea;
  readonly skills: readonly string[];
  readonly startMs: number;
  readonly timeZone: string;
  /** Geohash of the shift location, or null when unknown. */
  readonly geohash: string | null;
  readonly isVirtual: boolean;
}

export type MatchReason =
  | { readonly kind: "interest"; readonly causeArea: CauseArea }
  | { readonly kind: "skills"; readonly skills: readonly string[] }
  | { readonly kind: "availability"; readonly weekday: WeekdayKey; readonly block: TimeBlock }
  | { readonly kind: "nearby" }
  | { readonly kind: "virtual" };

export interface MatchResult {
  /** 0 to 1, rounded to 3 decimals. */
  readonly score: number;
  /** Strongest first (the order of the weights). */
  readonly reasons: readonly MatchReason[];
}

const normalizeSkill = (skill: string): string => skill.trim().toLowerCase();

const nearbyScore = (profile: MatchProfile, shift: MatchShift): number => {
  if (shift.isVirtual) return 1;
  if (profile.homeGeohash === null || shift.geohash === null) return 0;
  const shared = sharedGeohashPrefix(profile.homeGeohash, shift.geohash);
  return NEARBY_PREFIX_SCORES.find(([prefix]) => shared >= prefix)?.[1] ?? 0;
};

export const matchShift = (profile: MatchProfile, shift: MatchShift): MatchResult => {
  const reasons: MatchReason[] = [];
  let score = 0;

  if (profile.interests.includes(shift.causeArea)) {
    score += MATCH_WEIGHTS.interest;
    reasons.push({ kind: "interest", causeArea: shift.causeArea });
  }

  const mine = new Set(profile.skills.map(normalizeSkill));
  const sharedSkills = shift.skills.filter((skill) => mine.has(normalizeSkill(skill)));
  if (sharedSkills.length > 0) {
    score += MATCH_WEIGHTS.skills * (sharedSkills.length / shift.skills.length);
    reasons.push({ kind: "skills", skills: sharedSkills });
  }

  const weekday = weekdayKeyOf(shift.startMs, shift.timeZone);
  const block = timeBlockOf(shift.startMs, shift.timeZone);
  if (profile.availability?.[weekday][block] === true) {
    score += MATCH_WEIGHTS.availability;
    reasons.push({ kind: "availability", weekday, block });
  }

  const nearby = nearbyScore(profile, shift);
  if (nearby > 0) {
    score += MATCH_WEIGHTS.nearby * nearby;
    reasons.push({ kind: shift.isVirtual ? "virtual" : "nearby" });
  }

  return { score: Math.round(score * 1000) / 1000, reasons };
};

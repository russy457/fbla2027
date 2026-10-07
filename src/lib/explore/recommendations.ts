/**
 * recommendations.ts
 * "Recommended" shifts on Explore and "3 shifts that match you" after
 * onboarding (SPEC 9.2, SPEC 9.9, SPEC 8.4). Ranked on the client from the
 * volunteer's own private profile with the shared matchShift() score, never
 * with reliability (T3). Only shifts the person could actually join are
 * offered: not started, not cancelled, old enough, not a minor at an
 * unverified org, a seat or waitlist place open, and not already signed up.
 * Each pick carries a one-line "why".
 */
import {
  ageOn,
  decideSeat,
  matchShift,
  type MatchProfile,
  type MatchReason,
  type TimeBlock,
  type WeekdayKey
} from "@fbla/shared";
import { CAUSE_AREA_LABELS } from "@/lib/causeAreas";
import type { ExploreRow } from "./filters";

export interface Recommendation {
  readonly row: ExploreRow;
  readonly score: number;
  readonly why: string;
}

const WEEKDAY_NAMES: Readonly<Record<WeekdayKey, string>> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday"
};
const BLOCK_NAMES: Readonly<Record<TimeBlock, string>> = { morning: "mornings", afternoon: "afternoons", evening: "evenings" };

/** One plain sentence for the strongest reason. */
export const whyText = (reason: MatchReason): string => {
  switch (reason.kind) {
    case "interest":
      return `Matches your interest in ${CAUSE_AREA_LABELS[reason.causeArea].toLowerCase()}`;
    case "skills":
      return `Uses your skills: ${reason.skills.join(", ")}`;
    case "availability":
      return `Fits your free time on ${WEEKDAY_NAMES[reason.weekday]} ${BLOCK_NAMES[reason.block]}`;
    case "nearby":
      return "Close to your ZIP code";
    case "virtual":
      return "Virtual, so you can help from home";
  }
};

const ADULT_AGE = 18;

const canJoin = (row: ExploreRow, birthDate: string, nowMs: number): boolean => {
  const { instance } = row;
  if (instance.status !== "scheduled" || instance.start.toMillis() <= nowMs) return false;
  const age = ageOn(birthDate, instance.start.toDate(), instance.timeZone);
  if (age < instance.minAge || (age < ADULT_AGE && !instance.orgVerified)) return false;
  const seat = decideSeat({
    capacity: instance.capacity,
    signupCount: instance.signupCount,
    waitlistLength: instance.waitlist.length,
    nowMs,
    cutoffAtMs: instance.cutoffAt.toMillis()
  });
  return seat.kind !== "refused";
};

/** The top `count` matches with a score above zero, best first, soonest first on ties. */
export const recommendShifts = (
  rows: readonly ExploreRow[],
  profile: MatchProfile & { readonly birthDate: string },
  signedUpInstanceIds: ReadonlySet<string>,
  nowMs: number,
  count = 3
): Recommendation[] =>
  rows
    .filter((row) => row.opportunity !== null && !signedUpInstanceIds.has(row.instance.id) && canJoin(row, profile.birthDate, nowMs))
    .flatMap((row): Recommendation[] => {
      const opportunity = row.opportunity as NonNullable<ExploreRow["opportunity"]>;
      const match = matchShift(profile, {
        causeArea: opportunity.causeArea,
        skills: opportunity.skills,
        startMs: row.instance.start.toMillis(),
        timeZone: row.instance.timeZone,
        geohash: opportunity.location?.geo?.geohash ?? null,
        isVirtual: opportunity.type === "virtual"
      });
      const first = match.reasons[0];
      return first === undefined ? [] : [{ row, score: match.score, why: whyText(first) }];
    })
    .sort((a, b) => b.score - a.score || a.row.instance.start.toMillis() - b.row.instance.start.toMillis())
    .slice(0, count);

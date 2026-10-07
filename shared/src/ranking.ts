/**
 * ranking.ts
 * Coordinator volunteer ranking (Tier 2, SPEC#ai 8.4 "Ranking", H2). Pure
 * and deterministic: no AI. rankVolunteers loads candidates and calls this.
 *
 * Who can appear (privacy, T3/G14):
 *   - the org's past volunteers (a completed signup there), or anyone who
 *     turned on "discoverable" (SPEC 3.17 notificationPrefs.discoverable);
 *   - old enough for the shift on its date (minAge, age in the org zone);
 *   - minors only when the organization is verified.
 *
 * Score = match score (match.ts: interests, skills, availability, distance
 * from the coarse home geohash) x reliability (0.8 for new volunteers).
 * Candidates with no match signal at all are left out unless they have
 * volunteered here before. The "why" list never carries reliability, age,
 * or location: only the match reasons and "volunteered with you".
 */
import { matchShift, type MatchProfile, type MatchReason, type MatchShift } from "./match";
import { rankingReliability } from "./reliability";
import { HOUR_MS, ageOn } from "./time";

/** SPEC 5.2: at most 20 candidates per ranking. */
export const MAX_RANKED_CANDIDATES = 20;
/** SPEC 8.4: an invite ref is valid for 1 hour. */
export const RANK_REF_TTL_MS = HOUR_MS;
const ADULT_AGE = 18;

/** A "why" chip: a match reason, or a past shift with this organization. */
export type RankReason = MatchReason | { readonly kind: "past-volunteer" };

export interface RankCandidate {
  /** Opaque to this module (the server passes the uid and turns it into a ref later). */
  readonly key: string;
  readonly displayName: string;
  readonly birthDate: string;
  readonly profile: MatchProfile;
  readonly reliability: { readonly score: number | null; readonly isNew: boolean };
  readonly pastVolunteer: boolean;
  readonly discoverable: boolean;
}

export interface RankTarget extends MatchShift {
  readonly minAge: number;
  readonly orgVerified: boolean;
}

export interface RankedCandidate {
  readonly key: string;
  readonly displayName: string;
  /** match x reliability, 0 to 1, rounded to 3 decimals. */
  readonly score: number;
  readonly why: readonly RankReason[];
}

/** May this person be shown to the coordinator for this shift at all? */
export const isRankEligible = (candidate: RankCandidate, target: RankTarget): boolean => {
  if (!candidate.pastVolunteer && !candidate.discoverable) return false;
  const age = ageOn(candidate.birthDate, new Date(target.startMs), target.timeZone);
  if (age < target.minAge) return false;
  return age >= ADULT_AGE || target.orgVerified;
};

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

/** Eligible candidates, best first (ties by display name, then key, so the order is stable), at most `limit`. */
export const rankCandidates = (candidates: readonly RankCandidate[], target: RankTarget, limit: number = MAX_RANKED_CANDIDATES): RankedCandidate[] =>
  candidates
    .filter((candidate) => isRankEligible(candidate, target))
    .map((candidate) => {
      const match = matchShift(candidate.profile, target);
      const why: RankReason[] = candidate.pastVolunteer ? [...match.reasons, { kind: "past-volunteer" }] : [...match.reasons];
      return { candidate, match, ranked: { key: candidate.key, displayName: candidate.displayName, score: round3(match.score * rankingReliability(candidate.reliability)), why } };
    })
    .filter(({ candidate, match }) => match.score > 0 || candidate.pastVolunteer)
    .map(({ ranked }) => ranked)
    .sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName) || a.key.localeCompare(b.key))
    .slice(0, limit);

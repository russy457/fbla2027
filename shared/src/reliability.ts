/**
 * reliability.ts
 * The volunteer track record (SPEC#reliability 7.2, T3, D12). One pure
 * function used by recomputeVolunteerStats (stored on the private profile and
 * copied into coordinator contact snapshots) and by any screen that explains
 * the number.
 *
 *   window   = the last 20 finished signups, newest first, whose instanceStart
 *              is within the last 12 months
 *   finished = completed | no-show | (cancelled with lateCancel == true)
 *   score    = attended / (attended + noShows + 0.5 * lateCancels)
 *   isNew    = fewer than 3 finished signups in the window (score is null)
 *
 * Everything else is excluded by construction: excused (any reason), early
 * volunteer cancels and waitlist cancels (lateCancel false), system cancels
 * (waitlist-cutoff, org-cancelled), promotion releases, and signups that are
 * still open. Only a confirmed seat can carry lateCancel, so "never
 * confirmed" signups never count.
 *
 * Guardrails (T3): the result is never used to block a signup and never shown
 * in discovery, the kiosk, or any public surface.
 */
import { subMonths } from "date-fns";
import type { SignupStatus } from "./schemas/common";

/** How many finished signups the window keeps. */
export const RELIABILITY_WINDOW_SIZE = 20;
/** How far back the window looks, in calendar months. */
export const RELIABILITY_WINDOW_MONTHS = 12;
/** Fewer finished signups than this marks a "New volunteer" with no score. */
export const RELIABILITY_MIN_HISTORY = 3;
/** Score used for ranking when a volunteer is new (SPEC 7.2, Tier 2 ranking). */
export const NEW_VOLUNTEER_RANKING_SCORE = 0.8;
/** A late cancel weighs half a no-show. */
const LATE_CANCEL_WEIGHT = 0.5;

/** The fields of a signup the formula reads. */
export interface ReliabilitySignup {
  readonly status: SignupStatus;
  readonly lateCancel: boolean;
  /** Shift start, epoch ms. */
  readonly instanceStartMs: number;
}

export interface ReliabilityResult {
  readonly attended: number;
  readonly noShows: number;
  readonly lateCancels: number;
  /** attended + noShows + lateCancels: the shifts the window counts. */
  readonly total: number;
  /** Between 0 and 1, rounded to 3 decimals; null while isNew. */
  readonly score: number | null;
  readonly isNew: boolean;
  /** Start of the oldest signup in the window (epoch ms), or null when the window is empty. */
  readonly windowFromMs: number | null;
}

/** True for signups the formula counts (SPEC 7.2 "finished"). */
export const isFinishedForReliability = (signup: Pick<ReliabilitySignup, "status" | "lateCancel">): boolean =>
  signup.status === "completed" || signup.status === "no-show" || (signup.status === "cancelled" && signup.lateCancel);

const roundScore = (value: number): number => Math.round(value * 1000) / 1000;

/** Computes the track record from any list of the volunteer's signups (order does not matter). */
export const computeReliability = (signups: readonly ReliabilitySignup[], nowMs: number): ReliabilityResult => {
  const oldestAllowedMs = subMonths(new Date(nowMs), RELIABILITY_WINDOW_MONTHS).getTime();
  const window = signups
    .filter((signup) => isFinishedForReliability(signup) && signup.instanceStartMs >= oldestAllowedMs)
    .sort((a, b) => b.instanceStartMs - a.instanceStartMs)
    .slice(0, RELIABILITY_WINDOW_SIZE);

  const attended = window.filter((signup) => signup.status === "completed").length;
  const noShows = window.filter((signup) => signup.status === "no-show").length;
  const lateCancels = window.filter((signup) => signup.status === "cancelled").length;
  const total = attended + noShows + lateCancels;
  const isNew = total < RELIABILITY_MIN_HISTORY;
  const denominator = attended + noShows + LATE_CANCEL_WEIGHT * lateCancels;
  const oldest = window[window.length - 1];
  return {
    attended,
    noShows,
    lateCancels,
    total,
    score: isNew ? null : roundScore(attended / denominator),
    isNew,
    windowFromMs: oldest === undefined ? null : oldest.instanceStartMs
  };
};

/**
 * Neutral display text (D12): "Attended 8 of 10 recent shifts", or
 * "New volunteer" while there are fewer than 3 finished shifts. Never a
 * colored score badge.
 */
export const reliabilitySummary = (reliability: Pick<ReliabilityResult, "attended" | "total" | "isNew">): string =>
  // Not new means at least 3 counted shifts, so the noun is always plural.
  reliability.isNew ? "New volunteer" : `Attended ${reliability.attended} of ${reliability.total} recent shifts`;

/** The value ranking uses: the score, or 0.8 for a new volunteer (SPEC 7.2). */
export const rankingReliability = (reliability: Pick<ReliabilityResult, "score" | "isNew">): number =>
  reliability.isNew || reliability.score === null ? NEW_VOLUNTEER_RANKING_SCORE : reliability.score;

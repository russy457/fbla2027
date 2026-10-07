/**
 * waitlist.ts
 * Seat and waitlist rules (SPEC#fn-signup 5.3, SPEC 6.1 rows 1-3, SPEC 7.3)
 * as pure functions, so volunteer.signup, cancelSignup, the capacity-increase
 * promotion in updateInstance, and the signup button (D5 "Join waitlist (#N)")
 * all decide the same way.
 *
 *   seat free                                 -> confirmed (walk-up after the cutoff)
 *   no seat, before cutoff, waitlist has room -> waitlisted (waitlist length <= capacity)
 *   no seat, at or after cutoff               -> WAITLIST_CLOSED
 *   no seat, before cutoff, waitlist full     -> SHIFT_FULL
 *
 * Promotion takes the lowest seq first and happens only before the cutoff;
 * after it, freed seats go to walk-up signups.
 */
import type { WaitlistEntry } from "./schemas/shiftDocs";

export interface SeatInput {
  readonly capacity: number;
  /** Seats taken: confirmed + checked-in + completed. */
  readonly signupCount: number;
  readonly waitlistLength: number;
  readonly nowMs: number;
  readonly cutoffAtMs: number;
}

export type SeatDecision =
  | { readonly kind: "confirmed"; readonly walkUp: boolean }
  | { readonly kind: "waitlisted"; readonly position: number }
  | { readonly kind: "refused"; readonly code: "WAITLIST_CLOSED" | "SHIFT_FULL" };

/** True while the waitlist is open: strictly before cutoffAt (start - 2 h). */
export const isBeforeCutoff = (nowMs: number, cutoffAtMs: number): boolean => nowMs < cutoffAtMs;

/** What a new signup gets (SPEC 5.3 steps 4-6). The caller has already refused cancelled or started shifts. */
export const decideSeat = (input: SeatInput): SeatDecision => {
  if (input.signupCount < input.capacity) return { kind: "confirmed", walkUp: !isBeforeCutoff(input.nowMs, input.cutoffAtMs) };
  if (!isBeforeCutoff(input.nowMs, input.cutoffAtMs)) return { kind: "refused", code: "WAITLIST_CLOSED" };
  if (input.waitlistLength < input.capacity) return { kind: "waitlisted", position: input.waitlistLength + 1 };
  return { kind: "refused", code: "SHIFT_FULL" };
};

/** 1-based place in line: one more than the number of entries with a smaller seq (SPEC 5.3). */
export const waitlistPosition = (waitlist: readonly Pick<WaitlistEntry, "seq">[], seq: number): number =>
  1 + waitlist.filter((entry) => entry.seq < seq).length;

/** The entries promoted into `freeSeats` seats, lowest seq first (SPEC 6.1 row 3). */
export const nextInLine = <T extends Pick<WaitlistEntry, "seq">>(waitlist: readonly T[], freeSeats: number): T[] =>
  [...waitlist].sort((a, b) => a.seq - b.seq).slice(0, Math.max(0, freeSeats));

/** Seats a promotion may fill now: none at or after the cutoff, otherwise every free seat. */
export const promotableSeats = (capacity: number, signupCount: number, nowMs: number, cutoffAtMs: number): number =>
  isBeforeCutoff(nowMs, cutoffAtMs) ? Math.max(0, capacity - signupCount) : 0;

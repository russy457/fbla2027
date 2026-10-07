/**
 * myShifts.ts
 * Sorts the volunteer's signups into what My Shifts shows (SPEC#screen-inventory
 * "My Shifts"): the next shift to act on, the rest of the upcoming ones, and
 * past ones. A shift stays "next" until its check-out window closes
 * (end + 30 min), so a checked-in volunteer can still check out after the
 * scheduled end. Cancelled signups are left out of both lists.
 */
import { DEFAULT_CONFIG, MINUTE_MS, type SignupStatus } from "@fbla/shared";

export interface ShiftSignupLike {
  readonly status: SignupStatus;
  readonly instanceStart: { toMillis(): number };
  readonly instanceEnd: { toMillis(): number };
}

export interface MyShiftGroups<T> {
  readonly next: T | null;
  readonly upcoming: readonly T[];
  readonly past: readonly T[];
}

const ACTIVE: ReadonlySet<SignupStatus> = new Set<SignupStatus>(["confirmed", "checked-in", "waitlisted"]);

export const groupMyShifts = <T extends ShiftSignupLike>(signups: readonly T[], nowMs: number): MyShiftGroups<T> => {
  const graceMs = DEFAULT_CONFIG.checkoutGraceMin * MINUTE_MS;
  const byStart = [...signups].sort((a, b) => a.instanceStart.toMillis() - b.instanceStart.toMillis());
  const isOpen = (signup: T): boolean => ACTIVE.has(signup.status) && signup.instanceEnd.toMillis() + graceMs >= nowMs;
  const open = byStart.filter(isOpen);
  const past = byStart.filter((signup) => signup.status !== "cancelled" && !isOpen(signup)).reverse();
  const [first, ...rest] = open;
  return { next: first ?? null, upcoming: rest, past };
};

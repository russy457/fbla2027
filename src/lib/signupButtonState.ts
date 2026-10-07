/**
 * signupButtonState.ts
 * The signup button matrix (SPEC#signup-matrix, D5) as one pure function, so
 * the rule order lives in one tested place and every shift card renders the
 * same answer. Conditions are evaluated top to bottom; the first match wins.
 *
 * Tier 1 adds the waitlist rows: with no seat, before the 2 h cutoff and
 * while the waitlist has room, "Join waitlist (#N)" where N is the place the
 * viewer would get (shared decideSeat, the same rule the server uses); a
 * waitlisted signup shows "Waitlisted #N of M" with Leave waitlist; a free
 * seat after the cutoff carries the walk-up note.
 */
import { DEFAULT_CONFIG, MINUTE_MS, ageOn, decideSeat, type SignupStatus } from "@fbla/shared";

export type SignupButtonKind =
  | "cancelled-by-org"
  | "signed-up"
  | "waitlisted"
  | "own-cancelled"
  | "attended"
  | "finished"
  | "started"
  | "age-restricted"
  | "minor-unverified"
  | "available"
  | "join-waitlist"
  | "full"
  | "signed-out";

export interface SignupButtonState {
  readonly kind: SignupButtonKind;
  /** Button text, exactly as D5 words it. */
  readonly label: string;
  /** True when pressing the button starts an action (sign up, or sign in first). */
  readonly actionable: boolean;
  /** Extra line under the button, if any. */
  readonly reason: string | null;
  /** True when a Cancel action belongs next to the button (D5 "Signed up" row). */
  readonly canCancel: boolean;
  /** Text of that action: "Cancel", or "Leave waitlist" for a waitlisted signup. */
  readonly cancelLabel: string;
}

export interface SignupButtonInput {
  readonly nowMs: number;
  readonly instance: {
    readonly status: "scheduled" | "cancelled" | "finalized";
    readonly startMs: number;
    readonly minAge: number;
    readonly orgVerified: boolean;
    readonly capacity: number;
    readonly signupCount: number;
    readonly timeZone: string;
    /** Waitlist closes here; defaults to start - 2 h (SPEC 7.3). */
    readonly cutoffAtMs?: number;
    /** People already waitlisted; defaults to 0. */
    readonly waitlistLength?: number;
  };
  /** The viewer's own signup on this shift, if any. */
  readonly signup: { readonly status: SignupStatus; readonly waitlistPosition: number | null; readonly waitlistSize: number | null } | null;
  /** The viewer's birth date (YYYY-MM-DD), or null when signed out. */
  readonly birthDate: string | null;
  readonly signedIn: boolean;
}

const ADULT_AGE = 18;

const state = (
  kind: SignupButtonKind,
  label: string,
  options: { actionable?: boolean; reason?: string | null; canCancel?: boolean; cancelLabel?: string } = {}
): SignupButtonState => ({
  kind,
  label,
  actionable: options.actionable ?? false,
  reason: options.reason ?? null,
  canCancel: options.canCancel ?? false,
  cancelLabel: options.cancelLabel ?? "Cancel"
});

/** Answers for a viewer who already has a signup on this shift. */
const fromOwnSignup = (signup: NonNullable<SignupButtonInput["signup"]>): SignupButtonState | null => {
  switch (signup.status) {
    case "confirmed":
    case "checked-in":
      return state("signed-up", "Signed up", { canCancel: signup.status === "confirmed" });
    case "waitlisted": {
      const place = signup.waitlistPosition === null ? "" : ` #${signup.waitlistPosition}`;
      const size = signup.waitlistSize === null ? "" : ` of ${signup.waitlistSize}`;
      return state("waitlisted", `Waitlisted${place}${size}`, {
        canCancel: true,
        cancelLabel: "Leave waitlist",
        reason: "If a spot opens before the waitlist closes (2 hours before the start), you move up automatically."
      });
    }
    case "cancelled":
      return state("own-cancelled", "Cancelled", { reason: "You cancelled this shift." });
    case "completed":
      return state("attended", "Completed", { reason: "Your hours for this shift are logged." });
    case "no-show":
    case "excused":
      return state("finished", "Shift ended");
  }
};

export const signupButtonState = (input: SignupButtonInput): SignupButtonState => {
  const { instance, signup, nowMs } = input;
  if (instance.status === "cancelled") return state("cancelled-by-org", "Cancelled by organization");
  const own = signup ? fromOwnSignup(signup) : null;
  if (own) return own;
  if (instance.status === "finalized" || nowMs >= instance.startMs) return state("started", "Shift started");
  if (!input.signedIn) {
    return state("signed-out", "Sign up", { actionable: true, reason: "You'll sign in first, then come back here." });
  }

  if (input.birthDate !== null) {
    const age = ageOn(input.birthDate, new Date(instance.startMs), instance.timeZone);
    if (age < instance.minAge) {
      return state("age-restricted", `Ages ${instance.minAge}+`, {
        reason: `You must be at least ${instance.minAge} to join this shift.`
      });
    }
    if (age < ADULT_AGE && !instance.orgVerified) {
      return state("minor-unverified", "Not available yet", {
        reason: "Volunteers under 18 can join after this organization is verified."
      });
    }
  }

  const seat = decideSeat({
    capacity: instance.capacity,
    signupCount: instance.signupCount,
    waitlistLength: instance.waitlistLength ?? 0,
    nowMs,
    cutoffAtMs: instance.cutoffAtMs ?? instance.startMs - DEFAULT_CONFIG.waitlistCutoffMin * MINUTE_MS
  });
  if (seat.kind === "confirmed") {
    return state("available", "Sign up", { actionable: true, reason: seat.walkUp ? "Walk-up spot: the waitlist has closed, but a seat is open." : null });
  }
  if (seat.kind === "waitlisted") {
    return state("join-waitlist", `Join waitlist (#${seat.position})`, {
      actionable: true,
      reason: "This shift is full. Join the waitlist and you move in automatically if a spot opens."
    });
  }
  return state("full", "Full", { reason: seat.code === "WAITLIST_CLOSED" ? "This shift is full and its waitlist has closed." : "This shift and its waitlist are full." });
};

/** Seats still open, never negative (signupCount can briefly exceed capacity after an edit). */
export const seatsLeft = (capacity: number, signupCount: number): number => Math.max(0, capacity - signupCount);

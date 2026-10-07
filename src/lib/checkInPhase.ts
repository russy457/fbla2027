/**
 * checkInPhase.ts
 * Which check-in step a volunteer is on for one shift (SPEC#screen-kiosk-states,
 * "Phone check-in" table), computed from their signup, the shift, and the
 * clock. Uses the shared window math (shared/src/shiftWindows.ts), the same
 * code the Functions use, so "Check-in opens 9:30 AM" on the phone matches
 * what the server will accept. The server is still the final judge: these
 * phases only decide which button to show.
 */
import { DEFAULT_CONFIG, checkInWindow, checkOutWindow, type SignupStatus } from "@fbla/shared";

export type CheckInPhase =
  | { readonly kind: "shift-cancelled" }
  | { readonly kind: "check-in-not-open"; readonly opensAtMs: number }
  | { readonly kind: "check-in-open" }
  | { readonly kind: "check-in-closed" }
  | { readonly kind: "check-out-not-open"; readonly checkInAtMs: number; readonly opensAtMs: number }
  | { readonly kind: "check-out-open"; readonly checkInAtMs: number; readonly opensAtMs: number }
  | { readonly kind: "check-out-closed"; readonly checkInAtMs: number }
  | { readonly kind: "completed" }
  | { readonly kind: "not-attending" };

export interface CheckInPhaseInput {
  readonly nowMs: number;
  readonly instance: { readonly status: "scheduled" | "cancelled" | "finalized"; readonly startMs: number; readonly endMs: number };
  readonly signup: { readonly status: SignupStatus; readonly checkInAtMs: number | null };
}

export const checkInPhase = ({ nowMs, instance, signup }: CheckInPhaseInput): CheckInPhase => {
  if (signup.status === "completed") return { kind: "completed" };
  if (instance.status === "cancelled") return { kind: "shift-cancelled" };

  if (signup.status === "checked-in" && signup.checkInAtMs !== null) {
    const window = checkOutWindow(signup.checkInAtMs, instance.endMs, DEFAULT_CONFIG);
    if (nowMs < window.fromMs) return { kind: "check-out-not-open", checkInAtMs: signup.checkInAtMs, opensAtMs: window.fromMs };
    if (nowMs > window.toMs || instance.status === "finalized") return { kind: "check-out-closed", checkInAtMs: signup.checkInAtMs };
    return { kind: "check-out-open", checkInAtMs: signup.checkInAtMs, opensAtMs: window.fromMs };
  }

  if (signup.status !== "confirmed") return { kind: "not-attending" };
  const window = checkInWindow(instance.startMs, instance.endMs, DEFAULT_CONFIG);
  if (nowMs < window.fromMs) return { kind: "check-in-not-open", opensAtMs: window.fromMs };
  if (nowMs > window.toMs || instance.status === "finalized") return { kind: "check-in-closed" };
  return { kind: "check-in-open" };
};

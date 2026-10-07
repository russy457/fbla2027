/**
 * statusLabels.ts
 * Maps domain statuses to the badge tone and plain label the UI shows
 * (SPEC#screen-status-tokens D14 table), in one place so a status reads the
 * same on My Shifts, the roster, the kiosk, and Impact.
 */
import type { LetterStatus, SignupStatus } from "@fbla/shared";
import type { StatusTone } from "@/components/ui/StatusBadge";

export interface StatusLabel {
  readonly tone: StatusTone;
  readonly label: string;
}

export const SIGNUP_STATUS_LABELS: Readonly<Record<SignupStatus, StatusLabel>> = {
  confirmed: { tone: "neutral", label: "Signed up" },
  waitlisted: { tone: "warning", label: "Waitlisted" },
  "checked-in": { tone: "success", label: "Checked in" },
  completed: { tone: "success", label: "Checked out" },
  "no-show": { tone: "danger", label: "No-show" },
  excused: { tone: "neutral", label: "Excused" },
  cancelled: { tone: "neutral", label: "Cancelled" }
};

export const LETTER_STATUS_LABELS: Readonly<Record<LetterStatus, StatusLabel>> = {
  valid: { tone: "success", label: "Valid" },
  superseded: { tone: "neutral", label: "Superseded" },
  revoked: { tone: "danger", label: "Revoked" }
};

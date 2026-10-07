/**
 * onboardingDraft.ts
 * What onboarding collects step by step (SPEC#screen-onboarding D10) and how
 * it becomes the volunteer.completeProfile input. Skipped optional steps are
 * simply left out, so the server applies its defaults. Pure, so the mapping
 * is unit tested.
 */
import type { Availability, CauseArea, OpInput } from "@fbla/shared";
import { phoneToE164 } from "./validation/formSchemas";

export interface OnboardingDraft {
  readonly birthDate: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly phone: string;
  readonly interests: readonly CauseArea[];
  readonly skills: readonly string[] | null;
  readonly availability: Availability | null;
  readonly zip: string;
}

export const EMPTY_DRAFT: OnboardingDraft = Object.freeze({
  birthDate: "",
  firstName: "",
  lastName: "",
  phone: "",
  interests: [],
  skills: null,
  availability: null,
  zip: ""
});

export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export const DAY_LABELS: Readonly<Record<(typeof DAYS)[number], string>> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday"
};
export const BLOCKS = ["morning", "afternoon", "evening"] as const;

export const emptyAvailability = (): Availability =>
  Object.fromEntries(DAYS.map((day) => [day, { morning: false, afternoon: false, evening: false }])) as Availability;

/** Builds the completeProfile request from a finished draft. */
export const toCompleteProfileInput = (
  draft: OnboardingDraft,
  turnstileToken: string | null
): OpInput<"volunteer", "completeProfile"> => ({
  firstName: draft.firstName.trim(),
  lastName: draft.lastName.trim(),
  birthDate: draft.birthDate,
  interests: [...draft.interests],
  ...(draft.skills === null ? {} : { skills: [...draft.skills] }),
  ...(draft.availability === null ? {} : { availability: draft.availability }),
  phone: draft.phone.trim() === "" ? null : phoneToE164(draft.phone),
  zip: draft.zip.trim() === "" ? null : draft.zip.trim(),
  ...(turnstileToken === null ? {} : { turnstileToken })
});

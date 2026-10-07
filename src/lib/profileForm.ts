/**
 * profileForm.ts
 * The /me/profile form model (SPEC#screen-inventory "Profile"): the stored
 * private profile becomes editable text values, and the edited values become
 * one volunteer.updateProfile request holding only what changed (set
 * semantics). Phone is typed as 10 digits and sent as E.164; an empty phone
 * or ZIP clears it. Pure, so the mapping is unit tested; the server checks
 * the same rules again with the shared schema.
 */
import { updateProfileInput, type Availability, type CauseArea, type OpInput, type PrivateProfileDoc } from "@fbla/shared";
import { emptyAvailability } from "./onboardingDraft";
import { phoneToE164 } from "./validation/formSchemas";

export interface ProfileFormValues {
  readonly firstName: string;
  readonly lastName: string;
  readonly interests: readonly CauseArea[];
  /** Comma-separated, as typed. */
  readonly skills: string;
  readonly availability: Availability;
  readonly phone: string;
  readonly zip: string;
}

export type ProfileField = "firstName" | "lastName" | "interests" | "skills" | "phone" | "zip";
export type ProfileErrors = Partial<Record<ProfileField, string>>;
export type UpdateProfileRequest = OpInput<"volunteer", "updateProfile">;

/** "+12105550100" shown as "(210) 555-0100"; anything else as stored. */
const displayPhone = (e164: string | null): string => {
  const match = e164?.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : (e164 ?? "");
};

export const profileFormValues = (profile: PrivateProfileDoc): ProfileFormValues => ({
  firstName: profile.firstName,
  lastName: profile.lastName,
  interests: profile.interests,
  skills: profile.skills.join(", "),
  availability: profile.availability ?? emptyAvailability(),
  phone: displayPhone(profile.phone),
  zip: profile.zip ?? ""
});

const splitSkills = (text: string): string[] =>
  text
    .split(",")
    .map((skill) => skill.trim())
    .filter((skill) => skill.length > 0);

const sameList = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((item, index) => item === b[index]);

const MESSAGES: Readonly<Record<ProfileField, string>> = {
  firstName: "Enter your first name (up to 40 characters).",
  lastName: "Enter your last name (up to 40 characters).",
  interests: "Pick up to 10 causes.",
  skills: "Up to 20 skills, each 40 characters or fewer.",
  phone: "Enter a 10-digit phone number, or leave it blank.",
  zip: "Enter a 5-digit ZIP code, or leave it blank."
};

export type ProfileFormResult = { readonly ok: true; readonly request: UpdateProfileRequest } | { readonly ok: false; readonly errors: ProfileErrors };

/** Only the changed fields, validated with the op's own schema. */
export const toUpdateProfileRequest = (values: ProfileFormValues, stored: PrivateProfileDoc): ProfileFormResult => {
  const phone = values.phone.trim();
  const phoneE164 = phone === "" ? null : phoneToE164(phone);
  if (phone !== "" && phoneE164 === null) return { ok: false, errors: { phone: MESSAGES.phone } };
  const zip = values.zip.trim() === "" ? null : values.zip.trim();
  const skills = splitSkills(values.skills);
  const availabilityChanged = JSON.stringify(values.availability) !== JSON.stringify(stored.availability ?? emptyAvailability());

  const request: UpdateProfileRequest = {
    ...(values.firstName.trim() !== stored.firstName ? { firstName: values.firstName.trim() } : {}),
    ...(values.lastName.trim() !== stored.lastName ? { lastName: values.lastName.trim() } : {}),
    ...(sameList(values.interests, stored.interests) ? {} : { interests: [...values.interests] }),
    ...(sameList(skills, stored.skills) ? {} : { skills }),
    ...(availabilityChanged ? { availability: values.availability } : {}),
    ...(phoneE164 !== stored.phone ? { phone: phoneE164 } : {}),
    ...(zip !== stored.zip ? { zip } : {})
  };
  const parsed = updateProfileInput.safeParse(request);
  if (parsed.success) return { ok: true, request };
  const errors = parsed.error.issues.reduce<ProfileErrors>((found, issue) => {
    const field = issue.path[0] as ProfileField;
    return field in MESSAGES && !(field in found) ? { ...found, [field]: MESSAGES[field] } : found;
  }, {});
  return { ok: false, errors };
};

/**
 * formSchemas.ts
 * zod schemas for the forms people type into (rubric: input validation).
 * Each rule has a message that says what is wrong in plain words, checking
 * both format ("use 6 digits") and meaning ("a birth date can't be in the
 * future"). The server validates again with the shared op schemas; these
 * exist so mistakes are caught before a round trip, next to the field.
 */
import { z } from "zod";
import { CAUSE_AREAS, KIOSK_CODE_PATTERN, ageOn, isValidYmd, normalizeVerifyCode, VERIFY_CODE_PATTERN } from "@fbla/shared";

/** Youngest age that may create an account (SPEC#minors G18). */
export const MIN_ACCOUNT_AGE = 13;
/** Oldest birth year we accept, so "1066" is caught as a typo. */
const OLDEST_BIRTH_YEAR = 1900;
const ACCOUNT_AGE_ZONE = "America/Chicago";

/** Kiosk code entry (SPEC#screen-kiosk-states "Typed entry"). Spaces are ignored. */
export const kioskCodeFormSchema = z.object({
  code: z
    .string()
    .transform((value) => value.replace(/\s+/g, ""))
    .pipe(
      z
        .string()
        .min(1, { message: "Enter the 6-digit code shown on the kiosk." })
        .regex(/^\d*$/, { message: "Use numbers only." })
        .regex(KIOSK_CODE_PATTERN, { message: "The code has exactly 6 digits." })
    )
});
export type KioskCodeForm = z.input<typeof kioskCodeFormSchema>;

export const signInFormSchema = z.object({
  email: z.string().trim().min(1, { message: "Enter your email." }).pipe(z.email({ message: "Enter a valid email address." })),
  password: z.string().min(1, { message: "Enter your password." })
});
export type SignInForm = z.input<typeof signInFormSchema>;

export const createAccountFormSchema = z.object({
  email: z.string().trim().min(1, { message: "Enter your email." }).pipe(z.email({ message: "Enter a valid email address." })),
  password: z
    .string()
    .min(8, { message: "Use at least 8 characters." })
    .max(128, { message: "Use 128 characters or fewer." })
});
export type CreateAccountForm = z.input<typeof createAccountFormSchema>;

/**
 * Builds the birth date schema for "today" (passed in so tests and the demo
 * clock control it). Checks format, a real calendar date, not in the future,
 * a believable year, then the 13+ rule with its own flag so the screen can
 * show the kind stop message instead of a field error.
 */
export const birthDateSchema = (now: Date) =>
  z
    .string()
    .min(1, { message: "Enter your birth date." })
    .refine((value) => isValidYmd(value), { message: "Enter a real date, like 2009-04-18." })
    .refine((value) => Number(value.slice(0, 4)) >= OLDEST_BIRTH_YEAR, { message: "Check the year." })
    .refine((value) => ageOn(value, now, ACCOUNT_AGE_ZONE) >= 0, { message: "A birth date can't be in the future." });

/** True when this valid birth date means the person is under 13 today. */
export const isUnderMinimumAge = (birthDate: string, now: Date): boolean => ageOn(birthDate, now, ACCOUNT_AGE_ZONE) < MIN_ACCOUNT_AGE;

const NAME_PATTERN = /^[\p{L}\p{M}' .-]+$/u;
const namePart = (label: string) =>
  z
    .string()
    .trim()
    .min(1, { message: `Enter your ${label}.` })
    .max(40, { message: `Keep your ${label} under 40 characters.` })
    .regex(NAME_PATTERN, { message: `Use letters in your ${label}.` });

/** US phone typed any common way; converted to E.164 (+1XXXXXXXXXX) for the server. */
export const phoneToE164 = (raw: string): string | null => {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
};

export const nameStepSchema = z.object({
  firstName: namePart("first name"),
  lastName: namePart("last name"),
  phone: z
    .string()
    .trim()
    .refine((value) => value === "" || phoneToE164(value) !== null, { message: "Enter a 10-digit phone number, or leave it blank." })
});
export type NameStep = z.input<typeof nameStepSchema>;

export const interestsStepSchema = z.object({
  interests: z.array(z.enum(CAUSE_AREAS)).min(1, { message: "Pick at least one cause you care about." }).max(10)
});

export const skillsStepSchema = z.object({
  skills: z
    .array(z.string().trim().min(1).max(40, { message: "Keep each skill under 40 characters." }))
    .max(20, { message: "List up to 20 skills." })
});

export const zipStepSchema = z.object({
  zip: z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d{5}$/.test(value), { message: "Enter a 5-digit ZIP code, or leave it blank." })
});

/** /verify code box: accepts the printed "ABCD-EFGH-..." form or lowercase. */
export const verifyCodeFormSchema = z.object({
  code: z
    .string()
    .transform(normalizeVerifyCode)
    .pipe(
      z
        .string()
        .min(1, { message: "Enter the letter code." })
        .regex(VERIFY_CODE_PATTERN, { message: "Letter codes have 26 letters and numbers (2 to 7)." })
    )
});

/** Letter scope dates: real dates, from before to, to not in the future (SPEC 5.6 step 1). */
export const letterRangeSchema = (today: string) =>
  z
    .object({
      orgId: z.string().min(1),
      from: z.string().refine(isValidYmd, { message: "Enter a start date." }),
      to: z.string().refine(isValidYmd, { message: "Enter an end date." })
    })
    .refine((range) => range.to <= today, { message: "The end date can't be in the future.", path: ["to"] })
    .refine((range) => range.from <= range.to, { message: "The start date must be on or before the end date.", path: ["from"] });

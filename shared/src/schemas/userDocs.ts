/**
 * userDocs.ts
 * Person documents (SPEC#dm-users, SPEC#dm-private). users/{uid} is an
 * allowlisted projection written only by Functions through the strict schema
 * below; users/{uid}/private/profile holds personal data and a few
 * client-editable display preferences (the rules allowlist mirrors
 * CLIENT_PROFILE_KEYS).
 */
import { z } from "zod";
import { causeAreaSchema, e164Schema, timestampSchema, ymdSchema } from "./common";
import { reliabilitySchema } from "./shiftDocs";

/** users/{uid}: strict, so a stray private field can never be written to the public doc. */
export const userPublicDocSchema = z
  .object({
    displayName: z.string().min(1).max(60),
    avatarPath: z.string().nullable(),
    badges: z.array(z.enum(["hours-25", "hours-50", "hours-100"])),
    totalApprovedHours: z.number().min(0),
    orgsHelpedCount: z.number().int().min(0),
    streakWeeks: z.number().int().min(0),
    createdAt: timestampSchema,
    updatedAt: timestampSchema
  })
  .strict();
export type UserPublicDoc = z.infer<typeof userPublicDocSchema>;

const dayAvailabilitySchema = z.object({ morning: z.boolean(), afternoon: z.boolean(), evening: z.boolean() });
export const availabilitySchema = z.object({
  mon: dayAvailabilitySchema,
  tue: dayAvailabilitySchema,
  wed: dayAvailabilitySchema,
  thu: dayAvailabilitySchema,
  fri: dayAvailabilitySchema,
  sat: dayAvailabilitySchema,
  sun: dayAvailabilitySchema
});
export type Availability = z.infer<typeof availabilitySchema>;

export const skillsSchema = z.array(z.string().trim().min(1).max(40)).max(20);
export const interestsSchema = z.array(causeAreaSchema).max(10);

/** Keys a signed-in user may write on their own private profile (SPEC#rules-private). */
export const CLIENT_PROFILE_KEYS = ["textSize", "contrast", "reducedMotion", "notificationPrefs", "milestonesSeen"] as const;

/** users/{uid}/private/profile */
export const privateProfileDocSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  fullName: z.string(),
  email: z.string(),
  phone: e164Schema.nullable(),
  birthDate: ymdSchema,
  isMinor: z.boolean(),
  interests: interestsSchema,
  skills: skillsSchema,
  availability: availabilitySchema.nullable(),
  zip: z.string().nullable(),
  homeGeohash: z.string().nullable(),
  profileComplete: z.boolean(),
  profileCompletedAt: timestampSchema.nullable(),
  turnstileVerifiedAt: timestampSchema.nullable(),
  reliability: reliabilitySchema.extend({ windowFrom: timestampSchema.nullable() }),
  textSize: z.union([z.literal(100), z.literal(125), z.literal(150)]).optional(),
  contrast: z.enum(["normal", "high"]).optional(),
  reducedMotion: z.boolean().optional(),
  notificationPrefs: z.object({ discoverable: z.boolean() }).optional(),
  milestonesSeen: z.array(z.union([z.literal(25), z.literal(50), z.literal(100)])).optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
});
export type PrivateProfileDoc = z.infer<typeof privateProfileDocSchema>;

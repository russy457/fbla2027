/**
 * profileOps.ts
 * volunteer.updateProfile (SPEC 5.2): edit the profile after onboarding.
 * Every field is optional and only the fields sent change (set semantics);
 * birth date is not editable here (admins correct it, SPEC 4.2). A ZIP of
 * null clears it and the coarse area with it. avatarPath must point inside
 * the caller's own avatars/{uid}/ folder; the handler checks the uid.
 */
import { z } from "zod";
import { e164Schema, namePartSchema } from "../common";
import { availabilitySchema, interestsSchema, skillsSchema } from "../userDocs";

/** Same 5-digit rule as completeProfile. */
export const zipSchema = z.string().regex(/^\d{5}$/, { message: "must be a 5-digit ZIP" });

export const updateProfileInput = z
  .object({
    firstName: namePartSchema.optional(),
    lastName: namePartSchema.optional(),
    interests: interestsSchema.optional(),
    skills: skillsSchema.optional(),
    availability: availabilitySchema.nullable().optional(),
    phone: e164Schema.nullable().optional(),
    zip: zipSchema.nullable().optional(),
    avatarPath: z.string().regex(/^avatars\/[^/]+\/[^/]+$/, { message: "must be a file in avatars/{uid}/" }).nullable().optional()
  })
  .strict();
export const updateProfileOutput = z.object({ displayName: z.string(), homeGeohash: z.string().nullable() });

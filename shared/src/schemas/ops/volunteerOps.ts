/**
 * volunteerOps.ts
 * Input and output schemas for the "volunteer" endpoint's Tier 0 ops
 * (SPEC#api 5.2: completeProfile, signup, cancelSignup, issueLetter).
 * Inputs are strict objects: unknown keys are rejected so a typo in the
 * client fails loudly instead of being ignored. Outputs send instants as ISO
 * strings because callable responses are JSON.
 */
import { z } from "zod";
import {
  docIdSchema,
  e164Schema,
  namePartSchema,
  requestNonceSchema,
  ymdSchema
} from "../common";
import { availabilitySchema, interestsSchema, skillsSchema } from "../userDocs";

/** SPEC#fn-completeprofile */
export const completeProfileInput = z
  .object({
    firstName: namePartSchema,
    lastName: namePartSchema,
    birthDate: ymdSchema,
    interests: interestsSchema.optional(),
    skills: skillsSchema.optional(),
    availability: availabilitySchema.optional(),
    phone: e164Schema.nullable().optional(),
    zip: z
      .string()
      .regex(/^\d{5}$/, { message: "must be a 5-digit ZIP" })
      .nullable()
      .optional(),
    /** Cloudflare Turnstile token; required when TURNSTILE_ENABLED is true. */
    turnstileToken: z.string().max(2048).optional()
  })
  .strict();
export const completeProfileOutput = z.object({ displayName: z.string(), isMinor: z.boolean() });

/** SPEC#fn-signup */
export const signupInput = z.object({ instanceId: docIdSchema }).strict();
export const signupOutput = z.object({
  signupId: z.string(),
  status: z.enum(["confirmed", "waitlisted", "checked-in", "completed"]),
  /** 1-based place in line when waitlisted, else null. */
  waitlistPosition: z.number().int().nullable(),
  waitlistSize: z.number().int().nullable()
});

/** SPEC#fn-cancelsignup */
export const cancelSignupInput = z.object({ signupId: docIdSchema, release: z.boolean().optional() }).strict();
export const cancelSignupOutput = z.object({
  status: z.literal("cancelled"),
  lateCancel: z.boolean(),
  /** The waitlisted signup promoted into the freed seat (Tier 1), else null. */
  promotedSignupId: z.string().nullable()
});

/** SPEC#fn-issueletter: scope.orgId is an organization id or "ALL". */
export const issueLetterInput = z
  .object({
    scope: z.object({ orgId: z.union([z.literal("ALL"), docIdSchema]), from: ymdSchema, to: ymdSchema }).strict(),
    requestNonce: requestNonceSchema
  })
  .strict();
export const issueLetterOutput = z.object({
  letterId: z.string(),
  verifyCode: z.string(),
  pdfStatus: z.enum(["generating", "ready", "failed"]),
  totalMinutes: z.number().int(),
  excludedUnverifiedMinutes: z.number().int()
});

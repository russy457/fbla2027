/**
 * orgOps.ts
 * Input and output schemas for organization administration (Tier 1, SPEC
 * 5.2 and 5.8): registerOrganization, updateOrganization, createInvite,
 * redeemInvite, removeMember (coordinator endpoint) and verifyOrganization
 * (admin endpoint).
 *
 * The EIN is accepted here as any short string and checked by the handler,
 * so a malformed EIN gets the catalog's EIN_INVALID copy ("Enter the EIN as
 * NN-NNNNNNN.") instead of a generic INVALID_INPUT.
 */
import { z } from "zod";
import { addressSchema } from "../orgDocs";
import { causeAreaSchema, docIdSchema, e164Schema, requestNonceSchema } from "../common";

/** US Employer Identification Number, for example 74-1234567. */
export const EIN_PATTERN = /^\d{2}-\d{7}$/;

/** True for an IANA zone this runtime knows (America/Chicago, America/Denver, ...). */
export const isValidTimeZone = (value: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return value.includes("/") || value === "UTC";
  } catch {
    return false;
  }
};

/** http(s) link with a host and no spaces; javascript: and data: links are refused. */
const HTTP_URL_PATTERN = /^https?:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?([/?#][^\s]*)?$/i;
export const isHttpUrl = (value: string): boolean => HTTP_URL_PATTERN.test(value);

const uniqueCauses = z
  .array(causeAreaSchema)
  .min(1)
  .max(3)
  .refine((values) => new Set(values).size === values.length, { message: "must not repeat a cause area" });

/** Every field an owner may edit (SPEC 5.8). verified, hasActivity, archived, ownerUid are never editable. */
export const orgProfileFields = {
  name: z.string().trim().min(2).max(80),
  mission: z.string().trim().max(500),
  causeAreas: uniqueCauses,
  ein: z.string().trim().max(20),
  address: addressSchema.extend({ state: z.string().trim().regex(/^[A-Z]{2}$/, { message: "must be a 2-letter state" }) }).strict(),
  contactEmail: z.email().max(200),
  contactPhone: e164Schema.nullable(),
  website: z.string().trim().max(200).refine(isHttpUrl, { message: "must be an http(s) link" }).nullable(),
  timeZone: z.string().refine(isValidTimeZone, { message: "must be a time zone like America/Chicago" }),
  photoPaths: z.array(z.string().max(300)).max(6)
};

/** coordinator.registerOrganization (SPEC#fn-registerorganization). */
export const registerOrganizationInput = z
  .object({
    name: orgProfileFields.name,
    mission: orgProfileFields.mission,
    causeAreas: orgProfileFields.causeAreas,
    ein: orgProfileFields.ein,
    address: orgProfileFields.address,
    contactEmail: orgProfileFields.contactEmail,
    contactPhone: orgProfileFields.contactPhone.optional(),
    website: orgProfileFields.website.optional(),
    timeZone: orgProfileFields.timeZone,
    requestNonce: requestNonceSchema
  })
  .strict();
export const registerOrganizationOutput = z.object({ orgId: z.string() });

export const orgPatchSchema = z
  .object(orgProfileFields)
  .partial()
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, { message: "change at least one field" });
export type OrgPatch = z.infer<typeof orgPatchSchema>;

/** coordinator.updateOrganization: one of update (patch), archive (one-way), or delete. */
export const updateOrganizationInput = z.discriminatedUnion("action", [
  z.object({ orgId: docIdSchema, action: z.literal("update"), patch: orgPatchSchema }).strict(),
  z.object({ orgId: docIdSchema, action: z.literal("archive") }).strict(),
  z.object({ orgId: docIdSchema, action: z.literal("delete") }).strict()
]);
export const updateOrganizationOutput = z.object({
  orgId: z.string(),
  verified: z.boolean(),
  archived: z.boolean(),
  deleted: z.boolean()
});

const orgOnlyInput = z.object({ orgId: docIdSchema }).strict();

export const createInviteInput = orgOnlyInput;
export const createInviteOutput = z.object({
  /** Shown once; only its hash is stored. */
  code: z.string(),
  expiresAt: z.string()
});

/** The code as typed; the handler normalizes it (uppercase, no spaces or dashes). */
export const redeemInviteInput = z.object({ code: z.string().trim().min(1).max(40) }).strict();
export const redeemInviteOutput = z.object({ orgId: z.string(), role: z.literal("coordinator") });

export const removeMemberInput = z.object({ orgId: docIdSchema, uid: docIdSchema }).strict();
export const removeMemberOutput = z.object({ removed: z.boolean() });

/** admin.verifyOrganization: set semantics; the note is kept in a private audit log. */
export const verifyOrganizationInput = z
  .object({ orgId: docIdSchema, verified: z.boolean(), note: z.string().trim().max(500).optional() })
  .strict();
export const verifyOrganizationOutput = z.object({ orgId: z.string(), verified: z.boolean() });

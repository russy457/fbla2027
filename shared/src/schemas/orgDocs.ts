/**
 * orgDocs.ts
 * Organization-side documents for Tier 0 (SPEC#dm-organizations,
 * SPEC#dm-members, SPEC 3.4 letterRefs, SPEC#dm-opportunities). All are
 * written by Functions or the seed only; clients read them under the rules.
 */
import { z } from "zod";
import { causeAreaSchema, memberRoleSchema, timestampSchema } from "./common";

const auditFields = { createdAt: timestampSchema, updatedAt: timestampSchema };

export const addressSchema = z.object({
  line1: z.string().min(1).max(120),
  city: z.string().min(1).max(80),
  state: z.string().length(2),
  zip: z.string().regex(/^\d{5}$/)
});
export type Address = z.infer<typeof addressSchema>;

export const geoSchema = z.object({ lat: z.number(), lng: z.number(), geohash: z.string() });

/** organizations/{orgId} */
export const organizationDocSchema = z.object({
  name: z.string().min(2).max(80),
  mission: z.string().max(500),
  causeAreas: z.array(causeAreaSchema).min(1).max(3),
  ein: z.string().regex(/^\d{2}-\d{7}$/),
  address: addressSchema,
  geo: geoSchema.nullable(),
  contactEmail: z.email(),
  contactPhone: z.string().nullable(),
  website: z.string().nullable(),
  timeZone: z.string(),
  photoPaths: z.array(z.string()).max(6),
  ownerUid: z.string(),
  verified: z.boolean(),
  verifiedAt: timestampSchema.nullable(),
  verifiedBy: z.string().nullable(),
  hasActivity: z.boolean(),
  archived: z.boolean(),
  archivedAt: timestampSchema.nullable(),
  ...auditFields
});
export type OrganizationDoc = z.infer<typeof organizationDocSchema>;

/** organizations/{orgId}/members/{uid} */
export const memberDocSchema = z.object({
  uid: z.string(),
  orgId: z.string(),
  role: memberRoleSchema,
  displayName: z.string(),
  canViewContacts: z.boolean(),
  invitedBy: z.string().nullable(),
  joinedAt: timestampSchema,
  ...auditFields
});
export type MemberDoc = z.infer<typeof memberDocSchema>;

/** organizations/{orgId}/letterRefs/{letterId}: lets coordinators list letters that count their hours. */
export const letterRefDocSchema = z.object({
  letterId: z.string(),
  uid: z.string(),
  displayName: z.string(),
  minutesForOrg: z.number().int(),
  status: z.enum(["valid", "superseded", "revoked"]),
  issuedAt: timestampSchema,
  ...auditFields
});
export type LetterRefDoc = z.infer<typeof letterRefDocSchema>;

/** opportunities/{opportunityId} */
export const opportunityDocSchema = z.object({
  orgId: z.string(),
  orgName: z.string(),
  orgVerified: z.boolean(),
  title: z.string().min(4).max(80),
  description: z.string().max(2000),
  causeArea: causeAreaSchema,
  type: z.enum(["one-time", "recurring", "virtual", "skilled"]),
  skills: z.array(z.string().max(40)).max(10),
  minAge: z.number().int().min(13).max(21),
  location: z.object({ address: addressSchema, geo: geoSchema.nullable() }).nullable(),
  seriesId: z.string().nullable(),
  status: z.enum(["active", "archived"]),
  nextInstanceStart: timestampSchema.nullable(),
  createdBy: z.string(),
  ...auditFields
});
export type OpportunityDoc = z.infer<typeof opportunityDocSchema>;

/**
 * shiftAdminOps.ts
 * Schemas for coordinator opportunity and instance management (Tier 1,
 * SPEC 5.2): upsertOpportunity, createInstance, updateInstance,
 * cancelInstance. Times travel as ISO 8601 instants; the handler checks the
 * shift rules (end after start, at most 12 hours, in the future) and answers
 * INSTANCE_TIME_INVALID with the catalog copy.
 */
import { z } from "zod";
import { addressSchema } from "../orgDocs";
import { causeAreaSchema, docIdSchema, requestNonceSchema } from "../common";

export const OPPORTUNITY_TYPES = ["one-time", "recurring", "virtual", "skilled"] as const;
export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];

/** Longest shift (SPEC 3.8). */
export const MAX_SHIFT_HOURS = 12;
export const MAX_CAPACITY = 200;

const isoInstant = z.iso.datetime({ offset: true });

/** The editable part of an opportunity (SPEC#dm-opportunities). Virtual listings have no location. */
export const opportunityFieldsSchema = z
  .object({
    title: z.string().trim().min(4).max(80),
    description: z.string().trim().max(2000),
    causeArea: causeAreaSchema,
    type: z.enum(OPPORTUNITY_TYPES),
    skills: z.array(z.string().trim().min(1).max(40)).max(10),
    minAge: z.number().int().min(13).max(21),
    location: z.object({ address: addressSchema }).strict().nullable()
  })
  .strict()
  .refine((fields) => (fields.type === "virtual") === (fields.location === null), {
    message: "virtual opportunities have no location; others need one",
    path: ["location"]
  });
export type OpportunityFields = z.infer<typeof opportunityFieldsSchema>;

/** Create (orgId + requestNonce) or update (opportunityId, optional status). */
export const upsertOpportunityInput = z.union([
  z.object({ orgId: docIdSchema, requestNonce: requestNonceSchema, fields: opportunityFieldsSchema }).strict(),
  z.object({ opportunityId: docIdSchema, fields: opportunityFieldsSchema, status: z.enum(["active", "archived"]).optional() }).strict()
]);
export type UpsertOpportunityInput = z.infer<typeof upsertOpportunityInput>;
export const upsertOpportunityOutput = z.object({ opportunityId: z.string(), created: z.boolean() });

export const createInstanceInput = z
  .object({
    opportunityId: docIdSchema,
    start: isoInstant,
    end: isoInstant,
    capacity: z.number().int().min(1).max(MAX_CAPACITY),
    requestNonce: requestNonceSchema
  })
  .strict();
export const createInstanceOutput = z.object({ instanceId: z.string(), created: z.boolean() });

export const updateInstanceInput = z
  .object({
    instanceId: docIdSchema,
    start: isoInstant.optional(),
    end: isoInstant.optional(),
    capacity: z.number().int().min(1).max(MAX_CAPACITY).optional()
  })
  .strict();
export const updateInstanceOutput = z.object({
  instanceId: z.string(),
  sequence: z.number().int(),
  /** Waitlisted signups promoted into new seats (capacity increase before the cutoff). */
  promoted: z.array(z.string()),
  changed: z.boolean()
});

export const cancelInstanceInput = z.object({ instanceId: docIdSchema, reason: z.string().trim().min(3).max(200) }).strict();
export const cancelInstanceOutput = z.object({
  cancelledSignups: z.number().int(),
  completedSignups: z.number().int(),
  alreadyCancelled: z.boolean()
});

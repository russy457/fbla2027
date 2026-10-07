/**
 * curationOps.ts
 * Schemas for the curated collection ops (SPEC 3.19, SPEC 5.2, Tier 2 lane B
 * review fix). Collections are written only by Functions; the rules refuse
 * every client write, because rules cannot check each item of a list.
 *
 *   upsertCollection     create (requestNonce; org collections also name
 *                        orgId) or update (collectionId). The fields are the
 *                        strict collectionFieldsSchema: each item is exactly
 *                        {kind: "org" | "opportunity", refId}.
 *   publishCollection    set published true or false without resending fields
 *   deleteCollection     remove one collection
 *
 * The same names exist on two endpoints: coordinator (org collections; the org
 * is derived from the stored collection on update, publish, and delete) and
 * admin (app-wide collections, orgId null). Create ids are a hash of (caller,
 * requestNonce), so a retried Save lands on the same document.
 */
import { z } from "zod";
import { collectionFieldsSchema } from "../curationDocs";
import { docIdSchema, requestNonceSchema } from "../common";

/** coordinator.upsertCollection: create for orgId, or update an existing org collection. */
export const upsertOrgCollectionInput = z.union([
  z.object({ orgId: docIdSchema, requestNonce: requestNonceSchema, fields: collectionFieldsSchema }).strict(),
  z.object({ collectionId: docIdSchema, fields: collectionFieldsSchema }).strict()
]);
export type UpsertOrgCollectionInput = z.infer<typeof upsertOrgCollectionInput>;

/** admin.upsertCollection: create or update an app-wide collection (orgId null). */
export const upsertAdminCollectionInput = z.union([
  z.object({ requestNonce: requestNonceSchema, fields: collectionFieldsSchema }).strict(),
  z.object({ collectionId: docIdSchema, fields: collectionFieldsSchema }).strict()
]);
export type UpsertAdminCollectionInput = z.infer<typeof upsertAdminCollectionInput>;

export const upsertCollectionOutput = z.object({ collectionId: z.string(), created: z.boolean() });
export type UpsertCollectionOutput = z.infer<typeof upsertCollectionOutput>;

export const publishCollectionInput = z.object({ collectionId: docIdSchema, published: z.boolean() }).strict();
export const publishCollectionOutput = z.object({ collectionId: z.string(), published: z.boolean() });

export const deleteCollectionInput = z.object({ collectionId: docIdSchema }).strict();
export const deleteCollectionOutput = z.object({ collectionId: z.string(), deleted: z.boolean() });

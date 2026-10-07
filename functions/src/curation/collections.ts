/**
 * collections.ts
 * Shared auth modes and writes for the curated collection ops (SPEC 3.19,
 * Tier 2 lane B review fix). Collections are Functions-written only; the
 * rules refuse client writes because they cannot check each list item.
 *
 *   coordinatorCollectionTarget()  coordinator ops: create derives the org
 *                                  from input.orgId (the org must exist);
 *                                  every other op derives it from the STORED
 *                                  collection, so a coordinator of org A can
 *                                  never touch org B's collection, and an
 *                                  app-wide one (orgId null) is refused.
 *   adminCollectionTarget()        admin ops: admin claim, and an existing
 *                                  target must be app-wide (orgId null).
 *   createCollection / updateCollectionFields
 *                                  the writes; updatedAt comes from the
 *                                  request clock, never the client.
 *
 * Kiosk tokens are refused: neither mode sets kioskInstanceId.
 */
import type { Firestore } from "firebase-admin/firestore";
import {
  AppError,
  COLLECTIONS,
  type CollectionFields,
  type CuratedCollectionDoc,
  type OrganizationDoc
} from "@fbla/shared";
import { coordinatorOf, loadOrNotFound, type AuthMode, type Loaded, type ResourceResolver } from "../lib/auth";
import { readDoc, ts } from "../lib/firestore";
import { hashId } from "../lib/requestIds";

const COLLECTION_ID_HEX = 20;

/** The collection an op targets, or null on create. */
export type CollectionTarget = Loaded<CuratedCollectionDoc> | null;

/** Every collection op input names its target or carries a create nonce. */
export type TargetInput = { readonly collectionId: string } | { readonly orgId: string } | { readonly requestNonce: string };

const collectionsOf = (db: Firestore) => db.collection(COLLECTIONS.curatedCollections);

const loadCollection = (db: Firestore, collectionId: string): Promise<Loaded<CuratedCollectionDoc>> =>
  loadOrNotFound<CuratedCollectionDoc>(db, COLLECTIONS.curatedCollections, collectionId);

const resolveForCoordinator: ResourceResolver<TargetInput, CollectionTarget> = async (input, db) => {
  if ("collectionId" in input) {
    const existing = await loadCollection(db, input.collectionId);
    // orgId null (app-wide) makes coordinatorOf refuse with PERMISSION_DENIED.
    return { orgId: existing.data.orgId, instanceId: null, resource: existing };
  }
  if (!("orgId" in input)) throw new AppError("PERMISSION_DENIED");
  const org = await loadOrNotFound<OrganizationDoc>(db, COLLECTIONS.organizations, input.orgId);
  return { orgId: org.id, instanceId: null, resource: null };
};

export const coordinatorCollectionTarget = (): AuthMode<TargetInput, CollectionTarget> => coordinatorOf(resolveForCoordinator);

export const adminCollectionTarget = (): AuthMode<TargetInput, CollectionTarget> => ({
  name: "adminCollectionTarget",
  requiresProfile: () => false,
  authorize: async (input, { caller, db }) => {
    if (!caller.isAdmin) throw new AppError("PERMISSION_DENIED");
    if (!("collectionId" in input)) return { orgId: null, instanceId: null, resource: null };
    const existing = await loadCollection(db, input.collectionId);
    if (existing.data.orgId !== null) throw new AppError("PERMISSION_DENIED");
    return { orgId: null, instanceId: null, resource: existing };
  }
});

/** The target an op that names a collectionId resolved to; never null there. */
export const requireTarget = (target: CollectionTarget): Loaded<CuratedCollectionDoc> => {
  if (target === null) throw new AppError("NOT_FOUND");
  return target;
};

export interface CreateRequest {
  readonly uid: string;
  readonly requestNonce: string;
  readonly orgId: string | null;
  readonly fields: CollectionFields;
  readonly nowMs: number;
}

/**
 * Creates the collection at hash(uid, requestNonce). A retry with the same
 * nonce rewrites the same document (created false); a document there that
 * belongs to someone else or another org is refused.
 */
export const createCollection = async (db: Firestore, request: CreateRequest): Promise<{ collectionId: string; created: boolean }> => {
  const collectionId = hashId(["collection", request.uid, request.requestNonce], COLLECTION_ID_HEX);
  const ref = collectionsOf(db).doc(collectionId);
  const current = readDoc<CuratedCollectionDoc>(await ref.get());
  if (current !== null && (current.authorUid !== request.uid || current.orgId !== request.orgId)) throw new AppError("PERMISSION_DENIED");
  const document: CuratedCollectionDoc = { ...request.fields, orgId: request.orgId, authorUid: request.uid, updatedAt: ts(request.nowMs) };
  await ref.set(document);
  return { collectionId, created: current === null };
};

/** Replaces the editable fields; the author and org never change. */
export const updateCollectionFields = async (db: Firestore, collectionId: string, fields: CollectionFields, nowMs: number): Promise<void> => {
  await collectionsOf(db).doc(collectionId).update({ ...fields, updatedAt: ts(nowMs) });
};

export const setCollectionPublished = async (db: Firestore, collectionId: string, published: boolean, nowMs: number): Promise<void> => {
  await collectionsOf(db).doc(collectionId).update({ published, updatedAt: ts(nowMs) });
};

export const removeCollection = async (db: Firestore, collectionId: string): Promise<void> => {
  await collectionsOf(db).doc(collectionId).delete();
};

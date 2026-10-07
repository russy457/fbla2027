/**
 * curatedCollections.ts
 * Client reads and writes for curated collections (SPEC 3.19, Tier 2 lane B).
 * Reads are live Firestore listeners; writes go through callable ops
 * (coordinator.* for org collections, admin.* for app-wide ones, orgId
 * null), because rules cannot validate each list item. The rules deny every
 * client write; the listeners pick up the server's write.
 *
 *   listenToPublishedCollections   Explore: published, newest first (Q34)
 *   listenToOwnedCollections       an org's collections, or the admin ones
 *                                  (orgId null), drafts included (Q35)
 *   listenToCollection             one collection page
 *   saveCollection                 create (requestNonce, so a retried save
 *                                  never makes a duplicate) or update
 *   setCollectionPublished         publish or unpublish
 *   deleteCollection
 *
 * Public lists skip any document that fails the schema instead of failing
 * the whole list, so one malformed legacy document never breaks Explore.
 */
import { collection, doc, limit, onSnapshot, orderBy, query, where, type Query } from "firebase/firestore";
import { COLLECTIONS, collectionFieldsSchema, curatedCollectionDocSchema, type CollectionFields, type CuratedCollectionDoc } from "@fbla/shared";
import { callOp } from "../api";
import { getFirebase } from "../firebase";
import type { WithId } from "./parse";

export type CuratedCollection = WithId<CuratedCollectionDoc>;

type OnError = (error: Error) => void;

/** Explore shows a handful; the page lists at most this many. */
export const PUBLISHED_COLLECTIONS_LIMIT = 12;
const OWNED_COLLECTIONS_LIMIT = 50;

const asError = (error: unknown): Error => (error instanceof Error ? error : new Error(String(error)));

/** Valid documents only, in query order. A just-saved doc's pending updatedAt reads as the local estimate. */
const listenToValid = (source: Query, onData: (items: CuratedCollection[]) => void, onError: OnError): (() => void) =>
  onSnapshot(
    source,
    (snapshot) =>
      onData(
        snapshot.docs.flatMap((snapshotDoc) => {
          const parsed = curatedCollectionDocSchema.safeParse(snapshotDoc.data({ serverTimestamps: "estimate" }));
          return parsed.success ? [{ ...parsed.data, id: snapshotDoc.id }] : [];
        })
      ),
    (error) => onError(asError(error))
  );

const collectionsRef = () => collection(getFirebase().db, COLLECTIONS.curatedCollections);

export const listenToPublishedCollections = (onData: (items: CuratedCollection[]) => void, onError: OnError): (() => void) =>
  listenToValid(query(collectionsRef(), where("published", "==", true), orderBy("updatedAt", "desc"), limit(PUBLISHED_COLLECTIONS_LIMIT)), onData, onError);

/** orgId null lists the admin-authored collections (admins only, by rule). */
export const listenToOwnedCollections = (orgId: string | null, onData: (items: CuratedCollection[]) => void, onError: OnError): (() => void) =>
  listenToValid(query(collectionsRef(), where("orgId", "==", orgId), orderBy("updatedAt", "desc"), limit(OWNED_COLLECTIONS_LIMIT)), onData, onError);

/** One collection, or null when missing, unreadable as a draft, or malformed. */
export const listenToCollection = (collectionId: string, onData: (item: CuratedCollection | null) => void, onError: OnError): (() => void) =>
  onSnapshot(
    doc(collectionsRef(), collectionId),
    (snapshot) => {
      const parsed = snapshot.exists() ? curatedCollectionDocSchema.safeParse(snapshot.data({ serverTimestamps: "estimate" })) : null;
      onData(parsed?.success ? { ...parsed.data, id: snapshot.id } : null);
    },
    (error) => onError(asError(error))
  );

export interface SaveCollectionRequest {
  /** null creates a new collection; otherwise the collection to update. */
  readonly collectionId: string | null;
  /** Kept by the editor across retries, so a retried create lands on the same id. */
  readonly requestNonce: string;
  /** The org that owns it, or null for an app-wide (admin) collection. */
  readonly orgId: string | null;
  readonly fields: CollectionFields;
}

/** Validates the fields, then creates or updates through the coordinator or admin endpoint. */
export const saveCollection = async (request: SaveCollectionRequest): Promise<string> => {
  const fields = collectionFieldsSchema.parse(request.fields);
  if (request.orgId === null) {
    const input = request.collectionId === null ? { requestNonce: request.requestNonce, fields } : { collectionId: request.collectionId, fields };
    return (await callOp("admin", "upsertCollection", input)).collectionId;
  }
  const input = request.collectionId === null ? { orgId: request.orgId, requestNonce: request.requestNonce, fields } : { collectionId: request.collectionId, fields };
  return (await callOp("coordinator", "upsertCollection", input)).collectionId;
};

/** Publishes or unpublishes without resending the fields. */
export const setCollectionPublished = async (collection: Pick<CuratedCollection, "id" | "orgId">, published: boolean): Promise<void> => {
  const endpoint = collection.orgId === null ? "admin" : "coordinator";
  await callOp(endpoint, "publishCollection", { collectionId: collection.id, published });
};

export const deleteCollection = async (collection: Pick<CuratedCollection, "id" | "orgId">): Promise<void> => {
  const endpoint = collection.orgId === null ? "admin" : "coordinator";
  await callOp(endpoint, "deleteCollection", { collectionId: collection.id });
};

/**
 * curatedCollections.ts
 * Client reads and writes for curated collections (SPEC 3.19, Tier 2 lane B).
 * Collections are one of the few client-written collections (SPEC 2.4); the
 * rules (firestore.rules "Curated collections") repeat every check made here.
 *
 *   listenToPublishedCollections   Explore: published, newest first (Q34)
 *   listenToOwnedCollections       an org's collections, or the admin ones
 *                                  (orgId null), drafts included (Q35)
 *   listenToCollection             one collection page
 *   saveCollection                 create or replace with a caller-made id,
 *                                  so a retried save never makes a duplicate
 *   deleteCollection
 *
 * Public lists skip any document that fails the schema instead of failing
 * the whole list: rules cannot check each item of a list, so one malformed
 * write must not break Explore for everyone.
 */
import { collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, where, type Query } from "firebase/firestore";
import { COLLECTIONS, collectionFieldsSchema, curatedCollectionDocSchema, type CollectionFields, type CuratedCollectionDoc } from "@fbla/shared";
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

/** A fresh document id for a new collection (kept by the editor across retries). */
export const newCollectionId = (): string => doc(collectionsRef()).id;

export interface SaveCollectionRequest {
  readonly collectionId: string;
  /** null for an admin-authored collection. */
  readonly orgId: string | null;
  /** The original author when editing, the caller when creating (rules keep it fixed). */
  readonly authorUid: string;
  readonly fields: CollectionFields;
}

/** Validates the fields, then writes the whole document with the server time. */
export const saveCollection = async (request: SaveCollectionRequest): Promise<void> => {
  const fields = collectionFieldsSchema.parse(request.fields);
  await setDoc(doc(collectionsRef(), request.collectionId), {
    ...fields,
    orgId: request.orgId,
    authorUid: request.authorUid,
    updatedAt: serverTimestamp()
  });
};

export const deleteCollection = async (collectionId: string): Promise<void> => {
  await deleteDoc(doc(collectionsRef(), collectionId));
};

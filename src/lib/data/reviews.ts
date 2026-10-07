/**
 * reviews.ts
 * Client reads and writes for org experience reviews (SPEC 3.20, Tier 2
 * lane B). Reviews are client-written (SPEC 2.4); firestore.rules checks the
 * author attended (completed signup at that org), the name, every field,
 * the 30 s edit cooldown, and who may respond or delete.
 *
 *   listenToOrgReviews   public list for the org page, newest first (Q33)
 *   createReview         reviews/{signupId}: one review per attended shift
 *   updateReview         the author edits rating, tags, and text
 *   setReviewResponse    an org coordinator answers (or clears the answer)
 *   deleteReview         the author, or an admin moderating
 *
 * Malformed documents are skipped so one bad write cannot break the page.
 */
import { collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { COLLECTIONS, REVIEW_RESPONSE_MAX, reviewDocSchema, reviewFieldsSchema, type ReviewDoc, type ReviewFields } from "@fbla/shared";
import { getFirebase } from "../firebase";
import type { WithId } from "./parse";

export type Review = WithId<ReviewDoc>;

type OnError = (error: Error) => void;

/** Far above demo scale; the page shows the newest first. */
export const ORG_REVIEWS_LIMIT = 100;

const reviewsRef = () => collection(getFirebase().db, COLLECTIONS.reviews);
const asError = (error: unknown): Error => (error instanceof Error ? error : new Error(String(error)));

export const listenToOrgReviews = (orgId: string, onData: (reviews: Review[]) => void, onError: OnError): (() => void) =>
  onSnapshot(
    query(reviewsRef(), where("orgId", "==", orgId), orderBy("createdAt", "desc"), limit(ORG_REVIEWS_LIMIT)),
    (snapshot) =>
      onData(
        snapshot.docs.flatMap((snapshotDoc) => {
          const parsed = reviewDocSchema.safeParse(snapshotDoc.data({ serverTimestamps: "estimate" }));
          return parsed.success ? [{ ...parsed.data, id: snapshotDoc.id }] : [];
        })
      ),
    (error) => onError(asError(error))
  );

export interface CreateReviewRequest {
  readonly signupId: string;
  readonly orgId: string;
  readonly uid: string;
  /** The public name (first name + last initial) or ANONYMOUS_REVIEWER_NAME. */
  readonly displayName: string;
  readonly fields: ReviewFields;
}

export const createReview = async (request: CreateReviewRequest): Promise<void> => {
  const fields = reviewFieldsSchema.parse(request.fields);
  const at = serverTimestamp();
  await setDoc(doc(reviewsRef(), request.signupId), {
    orgId: request.orgId,
    uid: request.uid,
    displayName: request.displayName,
    ...fields,
    response: null,
    createdAt: at,
    updatedAt: at
  });
};

export const updateReview = async (reviewId: string, fields: ReviewFields): Promise<void> => {
  await updateDoc(doc(reviewsRef(), reviewId), { ...reviewFieldsSchema.parse(fields), updatedAt: serverTimestamp() });
};

/** `text` null clears the response. */
export const setReviewResponse = async (reviewId: string, uid: string, text: string | null): Promise<void> => {
  const trimmed = text?.trim() ?? "";
  if (text !== null && (trimmed.length === 0 || trimmed.length > REVIEW_RESPONSE_MAX)) throw new Error("Response must be 1 to 1,000 characters.");
  await updateDoc(doc(reviewsRef(), reviewId), { response: text === null ? null : { text: trimmed, by: uid, at: serverTimestamp() } });
};

export const deleteReview = async (reviewId: string): Promise<void> => {
  await deleteDoc(doc(reviewsRef(), reviewId));
};

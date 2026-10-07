/**
 * opportunitySchedule.ts
 * Keeps an opportunity's denormalized schedule facts current (SPEC 3.6, 3.8):
 *   refreshNextInstanceStart   nextInstanceStart = earliest future scheduled
 *                              instance (Explore sorts by it), via query Q2
 *   copyListingToInstances     title and minAge onto future scheduled shifts
 *                              after an opportunity edit
 */
import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS, type InstanceDoc, type OpportunityDoc } from "@fbla/shared";
import { ts } from "../lib/firestore";

export const refreshNextInstanceStart = async (db: Firestore, opportunityId: string, nowMs: number): Promise<void> => {
  const upcoming = await db
    .collection(COLLECTIONS.instances)
    .where("opportunityId", "==", opportunityId)
    .where("start", ">=", ts(nowMs))
    .orderBy("start", "asc")
    .get();
  const next = upcoming.docs.map((doc) => doc.data() as InstanceDoc).find((instance) => instance.status === "scheduled");
  const ref = db.collection(COLLECTIONS.opportunities).doc(opportunityId);
  // A shift whose listing was removed has nothing to refresh.
  if (!(await ref.get()).exists) return;
  await ref.update({ nextInstanceStart: next?.start ?? null, updatedAt: ts(nowMs) });
};

export const copyListingToInstances = async (db: Firestore, opportunityId: string, opportunity: Pick<OpportunityDoc, "title" | "minAge">, nowMs: number): Promise<number> => {
  const upcoming = await db.collection(COLLECTIONS.instances).where("opportunityId", "==", opportunityId).where("start", ">=", ts(nowMs)).get();
  const stale = upcoming.docs.filter((doc) => {
    const instance = doc.data() as InstanceDoc;
    return instance.status === "scheduled" && (instance.title !== opportunity.title || instance.minAge !== opportunity.minAge);
  });
  if (stale.length === 0) return 0;
  const batch = db.batch();
  stale.forEach((doc) => batch.update(doc.ref, { title: opportunity.title, minAge: opportunity.minAge, updatedAt: ts(nowMs) }));
  await batch.commit();
  return stale.length;
};

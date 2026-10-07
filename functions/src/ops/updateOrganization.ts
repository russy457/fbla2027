/**
 * updateOrganization.ts
 * coordinator.updateOrganization (SPEC 5.8, G17), owner only:
 *   update   patch of the editable fields; a new name or EIN sends the org
 *            back to verification (verified = false). Name or verified
 *            changes refresh the denormalized copies and T4 contact hiding.
 *   archive  one-way; refused (ORG_HAS_UPCOMING_SHIFTS) while a future
 *            scheduled shift still has volunteers on it or its waitlist.
 *   delete   only while hasActivity is false (ORG_HAS_ACTIVITY otherwise);
 *            removes the org, its members, invites, opportunities, and
 *            shifts. With no activity there are no signups or hours to keep.
 * verified, hasActivity, archived, and ownerUid are never patchable (the
 * input schema has no such keys).
 */
import type { Firestore } from "firebase-admin/firestore";
import { AppError, COLLECTIONS, EIN_PATTERN, type InstanceDoc, type OrgPatch, type OrganizationDoc } from "@fbla/shared";
import { defineCallable } from "../lib/defineCallable";
import { msOf, ts } from "../lib/firestore";
import { orgResource, ownerOf } from "../lib/orgAuth";
import { refreshOrgDenormals } from "../orgs/refreshOrgDenormals";

const BATCH_LIMIT = 400;

const applyUpdate = async (db: Firestore, orgId: string, org: OrganizationDoc, patch: OrgPatch, nowMs: number) => {
  if (patch.ein !== undefined && !EIN_PATTERN.test(patch.ein)) throw new AppError("EIN_INVALID");
  const resetsVerification = (patch.name !== undefined && patch.name !== org.name) || (patch.ein !== undefined && patch.ein !== org.ein);
  const verified = org.verified && !resetsVerification;
  const verificationFields = verified === org.verified ? {} : { verified, verifiedAt: null, verifiedBy: null };
  await db.collection(COLLECTIONS.organizations).doc(orgId).update({ ...patch, ...verificationFields, updatedAt: ts(nowMs) });
  const name = patch.name ?? org.name;
  if (name !== org.name || verified !== org.verified) {
    await refreshOrgDenormals(db, { orgId, name, verified }, nowMs, verified !== org.verified);
  }
  return { orgId, verified, archived: org.archived, deleted: false };
};

const applyArchive = async (db: Firestore, orgId: string, org: OrganizationDoc, nowMs: number) => {
  if (org.archived) return { orgId, verified: org.verified, archived: true, deleted: false };
  const instances = await db.collection(COLLECTIONS.instances).where("orgId", "==", orgId).get();
  const busy = instances.docs.some((doc) => {
    const instance = doc.data() as InstanceDoc;
    return instance.status === "scheduled" && msOf(instance.start) > nowMs && (instance.signupCount > 0 || instance.waitlist.length > 0);
  });
  if (busy) throw new AppError("ORG_HAS_UPCOMING_SHIFTS");
  await db.collection(COLLECTIONS.organizations).doc(orgId).update({ archived: true, archivedAt: ts(nowMs), updatedAt: ts(nowMs) });
  return { orgId, verified: org.verified, archived: true, deleted: false };
};

const applyDelete = async (db: Firestore, orgId: string, org: OrganizationDoc) => {
  if (org.hasActivity) throw new AppError("ORG_HAS_ACTIVITY");
  const orgRef = db.collection(COLLECTIONS.organizations).doc(orgId);
  const [members, invites, opportunities, instances] = await Promise.all([
    orgRef.collection(COLLECTIONS.members).get(),
    db.collection(COLLECTIONS.invites).where("orgId", "==", orgId).get(),
    db.collection(COLLECTIONS.opportunities).where("orgId", "==", orgId).get(),
    db.collection(COLLECTIONS.instances).where("orgId", "==", orgId).get()
  ]);
  const refs = [
    ...members.docs.map((doc) => doc.ref),
    ...invites.docs.map((doc) => doc.ref),
    ...opportunities.docs.map((doc) => doc.ref),
    ...instances.docs.flatMap((doc) => [doc.ref, db.collection(COLLECTIONS.instanceSecrets).doc(doc.id)]),
    orgRef
  ];
  for (let index = 0; index < refs.length; index += BATCH_LIMIT) {
    const batch = db.batch();
    refs.slice(index, index + BATCH_LIMIT).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
  return { orgId, verified: org.verified, archived: org.archived, deleted: true };
};

export const updateOrganization = defineCallable({
  endpoint: "coordinator",
  op: "updateOrganization",
  auth: ownerOf(orgResource((input: { orgId: string }) => input.orgId)),
  handler: async ({ input, clock, deps, resource }) => {
    const { db } = deps;
    const org = resource.data;
    switch (input.action) {
      case "update":
        return applyUpdate(db, resource.id, org, input.patch, clock.nowMs());
      case "archive":
        return applyArchive(db, resource.id, org, clock.nowMs());
      case "delete":
        return applyDelete(db, resource.id, org);
    }
  }
});

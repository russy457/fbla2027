/**
 * upsertOpportunity.ts
 * coordinator.upsertOpportunity (SPEC 5.2, SPEC#dm-opportunities).
 *   create  {orgId, requestNonce, fields}: coordinatorOfOrg; id = hash(uid, nonce)
 *           so a retried click returns the same listing (created: false).
 *   update  {opportunityId, fields, status?}: coordinatorOfOpportunity; the
 *           org is derived from the stored listing, never from input. Title
 *           and minimum age are copied to shifts that have not started.
 * Org name and verified state are denormalized from the org document.
 */
import { AppError, COLLECTIONS, type OpportunityDoc, type OpportunityFields, type OrganizationDoc } from "@fbla/shared";
import { defineCallable } from "../lib/defineCallable";
import { readDoc, ts } from "../lib/firestore";
import { coordinatorForUpsert } from "../lib/orgAuth";
import { hashId } from "../lib/requestIds";
import { copyListingToInstances } from "../shifts/opportunitySchedule";

const listingFields = (fields: OpportunityFields) => ({
  title: fields.title,
  description: fields.description,
  causeArea: fields.causeArea,
  type: fields.type,
  skills: fields.skills,
  minAge: fields.minAge,
  location: fields.location === null ? null : { address: fields.location.address, geo: null }
});

const newOpportunity = (orgId: string, org: OrganizationDoc, fields: OpportunityFields, uid: string, nowMs: number): OpportunityDoc => ({
  orgId,
  orgName: org.name,
  orgVerified: org.verified,
  ...listingFields(fields),
  seriesId: null,
  status: "active",
  nextInstanceStart: null,
  createdBy: uid,
  createdAt: ts(nowMs),
  updatedAt: ts(nowMs)
});

export const upsertOpportunity = defineCallable({
  endpoint: "coordinator",
  op: "upsertOpportunity",
  auth: coordinatorForUpsert(),
  handler: async ({ input, caller, clock, deps, resource, orgId }) => {
    const { db } = deps;
    const nowMs = clock.nowMs();
    if ("opportunityId" in input) {
      const fields = listingFields(input.fields);
      await db
        .collection(COLLECTIONS.opportunities)
        .doc(input.opportunityId)
        .update({ ...fields, ...(input.status ? { status: input.status } : {}), updatedAt: ts(nowMs) });
      await copyListingToInstances(db, input.opportunityId, fields, nowMs);
      return { opportunityId: input.opportunityId, created: false };
    }

    if (resource.org.archived) throw new AppError("PERMISSION_DENIED");
    const opportunityId = hashId(["opportunity", caller.uid, input.requestNonce], 20);
    const ref = db.collection(COLLECTIONS.opportunities).doc(opportunityId);
    const existing = readDoc<OpportunityDoc>(await ref.get());
    if (existing !== null) {
      if (existing.orgId !== orgId) throw new AppError("PERMISSION_DENIED");
      return { opportunityId, created: false };
    }
    await ref.create(newOpportunity(input.orgId, resource.org, input.fields, caller.uid, nowMs));
    return { opportunityId, created: true };
  }
});

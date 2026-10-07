/**
 * upsertCollection.ts
 * coordinator.upsertCollection and admin.upsertCollection (SPEC 3.19, 5.2;
 * Tier 2 lane B review fix). The fields are the strict shared schema
 * (collectionFieldsSchema), so every item is exactly {kind, refId} with kind
 * "org" or "opportunity"; rules could not check that, so clients no longer
 * write collections at all.
 *
 *   create  coordinator: { orgId, requestNonce, fields } for that org.
 *           admin:       { requestNonce, fields } for an app-wide collection.
 *           The id is hash(caller, requestNonce): a retried Save rewrites it.
 *   update  { collectionId, fields }. The org comes from the stored document
 *           (coordinators of that org only; app-wide ones are admin-only).
 * updatedAt is the request clock; the author and org never change.
 */
import { defineCallable } from "../lib/defineCallable";
import { adminCollectionTarget, coordinatorCollectionTarget, createCollection, requireTarget, updateCollectionFields } from "../curation/collections";

export const upsertCollection = defineCallable({
  endpoint: "coordinator",
  op: "upsertCollection",
  auth: coordinatorCollectionTarget(),
  handler: async ({ input, caller, clock, deps, resource }) => {
    if ("collectionId" in input) {
      const target = requireTarget(resource);
      await updateCollectionFields(deps.db, target.id, input.fields, clock.nowMs());
      return { collectionId: target.id, created: false };
    }
    return createCollection(deps.db, { uid: caller.uid, requestNonce: input.requestNonce, orgId: input.orgId, fields: input.fields, nowMs: clock.nowMs() });
  }
});

export const upsertAdminCollection = defineCallable({
  endpoint: "admin",
  op: "upsertCollection",
  auth: adminCollectionTarget(),
  handler: async ({ input, caller, clock, deps, resource }) => {
    if ("collectionId" in input) {
      const target = requireTarget(resource);
      await updateCollectionFields(deps.db, target.id, input.fields, clock.nowMs());
      return { collectionId: target.id, created: false };
    }
    return createCollection(deps.db, { uid: caller.uid, requestNonce: input.requestNonce, orgId: null, fields: input.fields, nowMs: clock.nowMs() });
  }
});

/**
 * deleteCollection.ts
 * coordinator.deleteCollection and admin.deleteCollection (SPEC 3.19;
 * Tier 2 lane B review fix). The org is derived from the stored collection:
 * any coordinator of that org may delete it; app-wide collections (orgId
 * null) are admin-only. A missing collection is NOT_FOUND.
 */
import { defineCallable } from "../lib/defineCallable";
import { adminCollectionTarget, coordinatorCollectionTarget, removeCollection, requireTarget } from "../curation/collections";

export const deleteCollection = defineCallable({
  endpoint: "coordinator",
  op: "deleteCollection",
  auth: coordinatorCollectionTarget(),
  handler: async ({ deps, resource }) => {
    const target = requireTarget(resource);
    await removeCollection(deps.db, target.id);
    return { collectionId: target.id, deleted: true };
  }
});

export const deleteAdminCollection = defineCallable({
  endpoint: "admin",
  op: "deleteCollection",
  auth: adminCollectionTarget(),
  handler: async ({ deps, resource }) => {
    const target = requireTarget(resource);
    await removeCollection(deps.db, target.id);
    return { collectionId: target.id, deleted: true };
  }
});

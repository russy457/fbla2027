/**
 * publishCollection.ts
 * coordinator.publishCollection and admin.publishCollection (SPEC 3.19;
 * Tier 2 lane B review fix): set published true or false without resending
 * the fields. The org is derived from the stored collection; app-wide
 * collections (orgId null) are admin-only. updatedAt is the request clock.
 */
import { defineCallable } from "../lib/defineCallable";
import { adminCollectionTarget, coordinatorCollectionTarget, requireTarget, setCollectionPublished } from "../curation/collections";

export const publishCollection = defineCallable({
  endpoint: "coordinator",
  op: "publishCollection",
  auth: coordinatorCollectionTarget(),
  handler: async ({ input, clock, deps, resource }) => {
    const target = requireTarget(resource);
    await setCollectionPublished(deps.db, target.id, input.published, clock.nowMs());
    return { collectionId: target.id, published: input.published };
  }
});

export const publishAdminCollection = defineCallable({
  endpoint: "admin",
  op: "publishCollection",
  auth: adminCollectionTarget(),
  handler: async ({ input, clock, deps, resource }) => {
    const target = requireTarget(resource);
    await setCollectionPublished(deps.db, target.id, input.published, clock.nowMs());
    return { collectionId: target.id, published: input.published };
  }
});

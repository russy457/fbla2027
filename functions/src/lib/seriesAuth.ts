/**
 * seriesAuth.ts
 * Tier 2 resource resolvers (SPEC#auth-resolvers, G2):
 *   seriesResource(seriesIdOf)   series/{id}; orgId comes from the series
 *                                (coordinatorOfSeries when wrapped in coordinatorOf)
 *   rankResource()               rankVolunteers: the instance (coordinatorOfInstance)
 *                                or, for a draft, the organization (coordinatorOfOrg)
 * Like every resolver, the org is derived from the stored resource, so a
 * coordinator of org A cannot reach org B by sending B's id elsewhere, and
 * kiosk tokens are refused because none of these set kioskInstanceId.
 */
import {
  COLLECTIONS,
  type InstanceDoc,
  type OrganizationDoc,
  type RankDraft,
  type RankVolunteersInput,
  type SeriesDoc
} from "@fbla/shared";
import { instanceResource, loadOrNotFound, type Loaded, type ResourceResolver } from "./auth";
import { orgResource } from "./orgAuth";

export const seriesResource =
  <I>(seriesIdOf: (input: I) => string): ResourceResolver<I, Loaded<SeriesDoc>> =>
  async (input, db) => {
    const series = await loadOrNotFound<SeriesDoc>(db, COLLECTIONS.series, seriesIdOf(input));
    return { orgId: series.data.orgId, instanceId: null, resource: series };
  };

export type RankTargetResource =
  | { readonly kind: "instance"; readonly instance: Loaded<InstanceDoc> }
  | { readonly kind: "draft"; readonly org: Loaded<OrganizationDoc>; readonly draft: RankDraft };

const loadInstance = instanceResource((input: { instanceId: string }) => input.instanceId);
const loadOrg = orgResource((input: { orgId: string }) => input.orgId);

export const rankResource = (): ResourceResolver<RankVolunteersInput, RankTargetResource> => async (input, db) => {
  if ("instanceId" in input) {
    const resolved = await loadInstance(input, db);
    return { ...resolved, resource: { kind: "instance", instance: resolved.resource } };
  }
  const resolved = await loadOrg(input, db);
  return { ...resolved, resource: { kind: "draft", org: resolved.resource, draft: input.draft } };
};

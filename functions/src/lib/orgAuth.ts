/**
 * orgAuth.ts
 * Tier 1 resource resolvers for coordinator ops (SPEC#auth-resolvers, G2).
 * Each one loads the target resource and derives orgId from it, so a
 * coordinator of org A can never act on org B by sending B's id in another
 * field. A client-supplied orgId is trusted only for create-type ops and for
 * ops whose target IS the organization, and even then the org must exist.
 *
 *   orgResource(orgIdOf)            the organization itself (create-type ops,
 *                                   org edits, invites, reports)
 *   opportunityResource(idOf)       opportunities/{id}
 *   signupResource(idOf)            signups/{id}
 *   logsResource(idsOf)             hoursLogs/{id...}; every log must share one org
 *   ownerOf(resolve)                like coordinatorOf, but role must be "owner"
 *   coordinatorForUpsert()          upsertOpportunity: org on create, opportunity on update
 *
 * Combine with coordinatorOf() from auth.ts: coordinatorOf(orgResource(...)).
 * Kiosk tokens are refused because none of these modes set kioskInstanceId.
 */
import type { Firestore } from "firebase-admin/firestore";
import {
  AppError,
  COLLECTIONS,
  type HoursLogDoc,
  type OpportunityDoc,
  type OrganizationDoc,
  type SignupDoc,
  type UpsertOpportunityInput
} from "@fbla/shared";
import { coordinatorOf, isOwnerOf, loadOrNotFound, type AuthMode, type Loaded, type ResourceResolver } from "./auth";
import { readDoc } from "./firestore";

export const orgResource =
  <I>(orgIdOf: (input: I) => string): ResourceResolver<I, Loaded<OrganizationDoc>> =>
  async (input, db) => {
    const org = await loadOrNotFound<OrganizationDoc>(db, COLLECTIONS.organizations, orgIdOf(input));
    return { orgId: org.id, instanceId: null, resource: org };
  };

export const opportunityResource =
  <I>(opportunityIdOf: (input: I) => string): ResourceResolver<I, Loaded<OpportunityDoc>> =>
  async (input, db) => {
    const opportunity = await loadOrNotFound<OpportunityDoc>(db, COLLECTIONS.opportunities, opportunityIdOf(input));
    return { orgId: opportunity.data.orgId, instanceId: null, resource: opportunity };
  };

export const signupResource =
  <I>(signupIdOf: (input: I) => string): ResourceResolver<I, Loaded<SignupDoc>> =>
  async (input, db) => {
    const signup = await loadOrNotFound<SignupDoc>(db, COLLECTIONS.signups, signupIdOf(input));
    return { orgId: signup.data.orgId, instanceId: signup.data.instanceId, resource: signup };
  };

/** Loads every log; a missing one is NOT_FOUND, and logs from two orgs are refused outright. */
export const logsResource =
  <I>(logIdsOf: (input: I) => readonly string[]): ResourceResolver<I, Array<Loaded<HoursLogDoc>>> =>
  async (input, db) => {
    const logs = await Promise.all(logIdsOf(input).map((id) => loadOrNotFound<HoursLogDoc>(db, COLLECTIONS.hoursLogs, id)));
    const orgIds = new Set(logs.map((log) => log.data.orgId));
    if (orgIds.size !== 1) throw new AppError("PERMISSION_DENIED");
    return { orgId: [...orgIds][0] ?? null, instanceId: null, resource: logs };
  };

/** Owner-only variant of coordinatorOf (SPEC 4.4 ownerOfOrg). */
export const ownerOf = <I, R>(resolve: ResourceResolver<I, R>): AuthMode<I, R> => ({
  name: "ownerOf",
  requiresProfile: () => true,
  authorize: async (input, { caller, db }) => {
    const resolved = await resolve(input, db);
    if (resolved.orgId === null || !(await isOwnerOf(db, resolved.orgId, caller.uid))) throw new AppError("PERMISSION_DENIED");
    return resolved;
  }
});

/** The opportunity an update targets, or null on create; the org is always loaded. */
export interface UpsertTarget {
  readonly org: OrganizationDoc;
  readonly opportunity: Loaded<OpportunityDoc> | null;
}

const loadUpsertTarget: ResourceResolver<UpsertOpportunityInput, UpsertTarget> = async (input, db: Firestore) => {
  if ("opportunityId" in input) {
    const opportunity = await loadOrNotFound<OpportunityDoc>(db, COLLECTIONS.opportunities, input.opportunityId);
    const org = readDoc<OrganizationDoc>(await db.collection(COLLECTIONS.organizations).doc(opportunity.data.orgId).get());
    if (org === null) throw new AppError("NOT_FOUND");
    return { orgId: opportunity.data.orgId, instanceId: null, resource: { org, opportunity } };
  }
  const org = await loadOrNotFound<OrganizationDoc>(db, COLLECTIONS.organizations, input.orgId);
  return { orgId: org.id, instanceId: null, resource: { org: org.data, opportunity: null } };
};

/** upsertOpportunity: coordinatorOfOrg(orgId) on create, coordinatorOfOpportunity on update (SPEC 5.2). */
export const coordinatorForUpsert = (): AuthMode<UpsertOpportunityInput, UpsertTarget> => coordinatorOf(loadUpsertTarget);

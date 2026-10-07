/**
 * orgs.ts
 * Organization reads (SPEC#dm-organizations, SPEC#dm-members). Organizations
 * are public. Memberships are found by reading the caller's own member doc in
 * each organization (rule: "own doc"), because the rules do not yet allow a
 * collection-group query on members (noted in the Tier 0 UI report).
 */
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { COLLECTIONS, PATHS, memberDocSchema, organizationDocSchema, type MemberDoc, type OrganizationDoc } from "@fbla/shared";
import { getFirebase } from "../firebase";
import { parseDocSnapshot, parseQuerySnapshot, type WithId } from "./parse";

export type Organization = WithId<OrganizationDoc>;
export type Member = WithId<MemberDoc>;
export interface Membership {
  readonly orgId: string;
  readonly orgName: string;
  readonly role: MemberDoc["role"];
}

export const getOrganizations = async (): Promise<Organization[]> =>
  parseQuerySnapshot(organizationDocSchema, await getDocs(collection(getFirebase().db, COLLECTIONS.organizations)));

export const getOrganization = async (orgId: string): Promise<Organization | null> =>
  parseDocSnapshot(organizationDocSchema, await getDoc(doc(getFirebase().db, COLLECTIONS.organizations, orgId)));

/** The caller's member doc in one org, or null when they are not a member. */
export const getMyMembership = async (orgId: string, uid: string): Promise<Member | null> =>
  parseDocSnapshot(memberDocSchema, await getDoc(doc(getFirebase().db, PATHS.member(orgId, uid))));

/** Every org where the caller is an owner or coordinator, sorted by org name. */
export const getMyMemberships = async (uid: string): Promise<Membership[]> => {
  const orgs = await getOrganizations();
  const members = await Promise.all(orgs.map((org) => getMyMembership(org.id, uid)));
  return orgs
    .flatMap((org, index): Membership[] => {
      const member = members[index];
      return member ? [{ orgId: org.id, orgName: org.name, role: member.role }] : [];
    })
    .sort((a, b) => a.orgName.localeCompare(b.orgName));
};

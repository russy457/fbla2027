/**
 * orgs.ts
 * Organization reads (SPEC#dm-organizations, SPEC#dm-members). Organizations
 * are public. Memberships come from one collection-group query on `members`
 * filtered to the caller's uid (SPEC Q27, rules: own docs only), then each
 * matching org is read for its display name.
 */
import { collection, collectionGroup, doc, getDoc, getDocs, query, where } from "firebase/firestore";
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

/** Name of the members subcollection, used as the collection-group id. */
const MEMBERS_GROUP = "members";

export const getOrganizations = async (): Promise<Organization[]> =>
  parseQuerySnapshot(organizationDocSchema, await getDocs(collection(getFirebase().db, COLLECTIONS.organizations)));

export const getOrganization = async (orgId: string): Promise<Organization | null> =>
  parseDocSnapshot(organizationDocSchema, await getDoc(doc(getFirebase().db, COLLECTIONS.organizations, orgId)));

/** The caller's member doc in one org, or null when they are not a member. */
export const getMyMembership = async (orgId: string, uid: string): Promise<Member | null> =>
  parseDocSnapshot(memberDocSchema, await getDoc(doc(getFirebase().db, PATHS.member(orgId, uid))));

/** Every org where the caller is an owner or coordinator, sorted by org name. */
export const getMyMemberships = async (uid: string): Promise<Membership[]> => {
  const { db } = getFirebase();
  const members = parseQuerySnapshot(
    memberDocSchema,
    await getDocs(query(collectionGroup(db, MEMBERS_GROUP), where("uid", "==", uid)))
  );
  const orgs = await Promise.all(members.map((member) => getOrganization(member.orgId)));
  return members
    .flatMap((member, index): Membership[] => {
      const org = orgs[index];
      return org ? [{ orgId: org.id, orgName: org.name, role: member.role }] : [];
    })
    .sort((a, b) => a.orgName.localeCompare(b.orgName));
};

/**
 * orgAdmin.ts
 * Coordinator-side reads for organization administration (Tier 1, SPEC 9.2
 * "Org settings", "Coordinator Dashboard" Needs attention, SPEC#queries):
 *   members        organizations/{orgId}/members           (rules: isMember)
 *   invites        invites where orgId == X, newest expiry  (Q28; rules: owner)
 *   letterRefs     organizations/{orgId}/letterRefs         (Q21; rules: isMember)
 *   opportunities  opportunities where orgId == X           (public)
 *   pending logs   hoursLogs where orgId == X, status == pending, by date (Q16)
 *   disputes       signups where orgId == X, disputeOpen == true (Q11)
 *   org signups    signups where orgId == X (analytics; rules prove isMember from the filter)
 *   org logs       hoursLogs where orgId == X, date >= since (analytics)
 * Every document is zod-parsed (parse.ts) before a screen sees it.
 */
import { Timestamp, collection, orderBy, query, where, getDocs } from "firebase/firestore";
import {
  COLLECTIONS,
  hoursLogDocSchema,
  inviteDocSchema,
  letterRefDocSchema,
  memberDocSchema,
  opportunityDocSchema,
  signupDocSchema,
  type InviteDoc,
  type LetterRefDoc,
  type OpportunityDoc
} from "@fbla/shared";
import { getFirebase } from "../firebase";
import { listenToQuery } from "./listen";
import { parseQuerySnapshot, type WithId } from "./parse";
import type { Member } from "./orgs";
import type { HoursLog } from "./records";
import type { Signup } from "./signups";

export type Invite = WithId<InviteDoc>;
export type LetterRef = WithId<LetterRefDoc>;
export type Opportunity = WithId<OpportunityDoc>;

type OnError = (error: Error) => void;
type Unsubscribe = () => void;

const orgPath = (orgId: string, sub: string) => collection(getFirebase().db, COLLECTIONS.organizations, orgId, sub);

export const listenToMembers = (orgId: string, onData: (members: Member[]) => void, onError: OnError): Unsubscribe =>
  listenToQuery(query(orgPath(orgId, COLLECTIONS.members)), memberDocSchema, onData, onError);

export const listenToInvites = (orgId: string, onData: (invites: Invite[]) => void, onError: OnError): Unsubscribe =>
  listenToQuery(
    query(collection(getFirebase().db, COLLECTIONS.invites), where("orgId", "==", orgId), orderBy("expiresAt", "desc")),
    inviteDocSchema,
    onData,
    onError
  );

export const listenToLetterRefs = (orgId: string, onData: (refs: LetterRef[]) => void, onError: OnError): Unsubscribe =>
  listenToQuery(query(orgPath(orgId, COLLECTIONS.letterRefs), orderBy("issuedAt", "desc")), letterRefDocSchema, onData, onError);

export const getOrgOpportunities = async (orgId: string): Promise<Opportunity[]> =>
  parseQuerySnapshot(
    opportunityDocSchema,
    await getDocs(query(collection(getFirebase().db, COLLECTIONS.opportunities), where("orgId", "==", orgId)))
  );

export const listenToPendingLogs = (orgId: string, onData: (logs: HoursLog[]) => void, onError: OnError): Unsubscribe =>
  listenToQuery(
    query(
      collection(getFirebase().db, COLLECTIONS.hoursLogs),
      where("orgId", "==", orgId),
      where("status", "==", "pending"),
      orderBy("date", "asc")
    ),
    hoursLogDocSchema,
    onData,
    onError
  );

export const listenToOpenDisputes = (orgId: string, onData: (signups: Signup[]) => void, onError: OnError): Unsubscribe =>
  listenToQuery(
    query(collection(getFirebase().db, COLLECTIONS.signups), where("orgId", "==", orgId), where("disputeOpen", "==", true)),
    signupDocSchema,
    onData,
    onError
  );

/** Every signup of the org (analytics and Needs attention names). */
export const listenToOrgSignups = (orgId: string, onData: (signups: Signup[]) => void, onError: OnError): Unsubscribe =>
  listenToQuery(query(collection(getFirebase().db, COLLECTIONS.signups), where("orgId", "==", orgId)), signupDocSchema, onData, onError);

/** The org's logs dated on or after `sinceMs` (any status), oldest first. */
export const listenToOrgLogsSince = (orgId: string, sinceMs: number, onData: (logs: HoursLog[]) => void, onError: OnError): Unsubscribe =>
  listenToQuery(
    query(
      collection(getFirebase().db, COLLECTIONS.hoursLogs),
      where("orgId", "==", orgId),
      where("date", ">=", Timestamp.fromMillis(sinceMs)),
      orderBy("date", "asc")
    ),
    hoursLogDocSchema,
    onData,
    onError
  );

/**
 * signups.ts
 * Reads of signups and coordinator contact snapshots (SPEC#dm-signups,
 * SPEC#dm-signupcontacts). Each query is shaped so the security rules can
 * prove access from the filters alone (SPEC#rules-signups):
 *   - a volunteer filters by their own uid,
 *   - a coordinator filters by orgId (isMember) and instanceId,
 *   - a kiosk filters by its instanceId (isKioskFor).
 */
import { collection, query, where } from "firebase/firestore";
import { COLLECTIONS, signupContactDocSchema, signupDocSchema, type SignupContactDoc, type SignupDoc } from "@fbla/shared";
import { getFirebase } from "../firebase";
import { listenToQuery } from "./listen";
import type { WithId } from "./parse";

export type Signup = WithId<SignupDoc>;
export type SignupContact = WithId<SignupContactDoc>;

type OnError = (error: Error) => void;

export const listenToMySignups = (uid: string, onData: (signups: Signup[]) => void, onError: OnError): (() => void) =>
  listenToQuery(query(collection(getFirebase().db, COLLECTIONS.signups), where("uid", "==", uid)), signupDocSchema, onData, onError);

/**
 * The roster of one shift. Pass orgId for a coordinator (rules check
 * membership through it); pass null for the kiosk token (rules check the
 * token's instance instead).
 */
export const listenToRoster = (
  instanceId: string,
  orgId: string | null,
  onData: (signups: Signup[]) => void,
  onError: OnError
): (() => void) => {
  const signups = collection(getFirebase().db, COLLECTIONS.signups);
  const filters =
    orgId === null
      ? [where("instanceId", "==", instanceId)]
      : [where("orgId", "==", orgId), where("instanceId", "==", instanceId)];
  return listenToQuery(query(signups, ...filters), signupDocSchema, onData, onError);
};

/** Contact snapshots for one shift; rules allow only coordinators with canViewContacts (G14). */
export const listenToRosterContacts = (
  orgId: string,
  instanceId: string,
  onData: (contacts: SignupContact[]) => void,
  onError: OnError
): (() => void) => {
  const contacts = query(
    collection(getFirebase().db, COLLECTIONS.signupContacts),
    where("orgId", "==", orgId),
    where("instanceId", "==", instanceId)
  );
  return listenToQuery(contacts, signupContactDocSchema, onData, onError);
};

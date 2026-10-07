/**
 * instances.ts
 * Reads of shift instances (SPEC#dm-instances; public read per
 * SPEC#rules-matrix). Instances carry a denormalized title, org name, org
 * verified flag, minimum age, and time zone, so Explore and My Shifts can
 * render a shift from one document.
 */
import { Timestamp, collection, doc, limit, orderBy, query, where } from "firebase/firestore";
import { COLLECTIONS, HOUR_MS, instanceDocSchema, type InstanceDoc } from "@fbla/shared";
import { getFirebase } from "../firebase";
import { listenToDoc, listenToQuery } from "./listen";
import type { WithId } from "./parse";

export type Instance = WithId<InstanceDoc>;

type OnError = (error: Error) => void;

/** Longest shift (SPEC 3.8: duration <= 12 h); a shift that started this long ago may still be running. */
const MAX_SHIFT_MS = 12 * HOUR_MS;
const EXPLORE_LIMIT = 50;

/**
 * Shifts that may not have ended yet, soonest first. The query starts 12
 * hours back so a running shift still shows as "Shift started"; screens drop
 * anything already over. Cancelled shifts stay in the results so a signed-up
 * volunteer sees "Cancelled by organization" (D5).
 */
export const listenToUpcomingInstances = (
  sinceMs: number,
  onData: (instances: Instance[]) => void,
  onError: OnError
): (() => void) => {
  const upcoming = query(
    collection(getFirebase().db, COLLECTIONS.instances),
    where("start", ">=", Timestamp.fromMillis(sinceMs - MAX_SHIFT_MS)),
    orderBy("start", "asc"),
    limit(EXPLORE_LIMIT)
  );
  return listenToQuery(upcoming, instanceDocSchema, onData, onError);
};

export const listenToInstance = (
  instanceId: string,
  onData: (instance: Instance | null) => void,
  onError: OnError
): (() => void) => listenToDoc(doc(getFirebase().db, COLLECTIONS.instances, instanceId), instanceDocSchema, onData, onError);

/** Every shift of one org, by start time (composite index orgId + start). */
export const listenToOrgInstances = (orgId: string, onData: (instances: Instance[]) => void, onError: OnError): (() => void) => {
  const byOrg = query(collection(getFirebase().db, COLLECTIONS.instances), where("orgId", "==", orgId), orderBy("start", "asc"));
  return listenToQuery(byOrg, instanceDocSchema, onData, onError);
};

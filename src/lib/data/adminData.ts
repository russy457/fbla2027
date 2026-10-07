/**
 * adminData.ts
 * Admin-only reads (SPEC 9.2 "Admin", SPEC#queries):
 *   verification queue  organizations where verified == false, archived == false, by createdAt (Q26)
 *   job history         jobRuns ordered by startedAt desc, limit 20 (Q32; rules: isAdmin)
 *   letter by code      letters where verifyCode == code (rules: isAdmin may read letters)
 * Organizations are public; jobRuns and letters need the admin claim.
 */
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { COLLECTIONS, jobRunDocSchema, letterDocSchema, organizationDocSchema, type JobRunDoc } from "@fbla/shared";
import { getFirebase } from "../firebase";
import { listenToQuery } from "./listen";
import { parseQuerySnapshot, type WithId } from "./parse";
import type { Organization } from "./orgs";
import type { Letter } from "./records";

export type JobRun = WithId<JobRunDoc>;

type OnError = (error: Error) => void;

/** How many recent job runs the admin page lists. */
export const JOB_RUNS_SHOWN = 20;

export const listenToVerificationQueue = (onData: (orgs: Organization[]) => void, onError: OnError): (() => void) =>
  listenToQuery(
    query(
      collection(getFirebase().db, COLLECTIONS.organizations),
      where("verified", "==", false),
      where("archived", "==", false),
      orderBy("createdAt", "asc")
    ),
    organizationDocSchema,
    onData,
    onError
  );

/** Every organization, live, so a verify or unverify shows up immediately. */
export const listenToAllOrganizations = (onData: (orgs: Organization[]) => void, onError: OnError): (() => void) =>
  listenToQuery(query(collection(getFirebase().db, COLLECTIONS.organizations)), organizationDocSchema, onData, onError);

export const listenToJobRuns = (onData: (runs: JobRun[]) => void, onError: OnError): (() => void) =>
  listenToQuery(
    query(collection(getFirebase().db, COLLECTIONS.jobRuns), orderBy("startedAt", "desc"), limit(JOB_RUNS_SHOWN)),
    jobRunDocSchema,
    onData,
    onError
  );

/** The letter with this verify code, or null. Admins only (rules). */
export const findLetterByVerifyCode = async (verifyCode: string): Promise<Letter | null> => {
  const snapshot = await getDocs(query(collection(getFirebase().db, COLLECTIONS.letters), where("verifyCode", "==", verifyCode), limit(1)));
  return parseQuerySnapshot(letterDocSchema, snapshot)[0] ?? null;
};

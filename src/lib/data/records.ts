/**
 * records.ts
 * The volunteer's own hours and letters (SPEC#dm-hourslogs, SPEC#dm-letters)
 * and the public letter projection read by /verify (SPEC#dm-verifications).
 */
import { collection, doc, getDoc, orderBy, query, where } from "firebase/firestore";
import {
  COLLECTIONS,
  hoursLogDocSchema,
  letterDocSchema,
  letterVerificationDocSchema,
  type HoursLogDoc,
  type LetterDoc,
  type LetterVerificationDoc
} from "@fbla/shared";
import { getFirebase } from "../firebase";
import { listenToQuery } from "./listen";
import { parseDocSnapshot, type WithId } from "./parse";

export type HoursLog = WithId<HoursLogDoc>;
export type Letter = WithId<LetterDoc>;
export type LetterVerification = WithId<LetterVerificationDoc>;

type OnError = (error: Error) => void;

/** Approved logs only: they are the only ones that count (SPEC 3.12). */
export const listenToMyApprovedLogs = (uid: string, onData: (logs: HoursLog[]) => void, onError: OnError): (() => void) => {
  const logs = query(
    collection(getFirebase().db, COLLECTIONS.hoursLogs),
    where("uid", "==", uid),
    where("status", "==", "approved")
  );
  return listenToQuery(logs, hoursLogDocSchema, onData, onError);
};

/** Newest first (composite index uid + issuedAt desc). */
export const listenToMyLetters = (uid: string, onData: (letters: Letter[]) => void, onError: OnError): (() => void) => {
  const letters = query(collection(getFirebase().db, COLLECTIONS.letters), where("uid", "==", uid), orderBy("issuedAt", "desc"));
  return listenToQuery(letters, letterDocSchema, onData, onError);
};

/** One exact-id read (the rules forbid listing), or null when no letter has that code. */
export const getLetterVerification = async (verifyCode: string): Promise<LetterVerification | null> => {
  const snapshot = await getDoc(doc(getFirebase().db, COLLECTIONS.letterVerifications, verifyCode));
  return parseDocSnapshot(letterVerificationDocSchema, snapshot);
};

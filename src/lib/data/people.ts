/**
 * people.ts
 * The signed-in user's private profile (SPEC#dm-private) and the demo clock
 * (SPEC#clock). The private profile tells route guards
 * whether onboarding is complete and gives the birth date for age checks.
 */
import { doc } from "firebase/firestore";
import { PATHS, demoClockDocSchema, privateProfileDocSchema, type DemoClockDoc, type PrivateProfileDoc } from "@fbla/shared";
import { getFirebase } from "../firebase";
import { listenToDoc } from "./listen";
import type { WithId } from "./parse";

export type PrivateProfile = WithId<PrivateProfileDoc>;
export type DemoClock = WithId<DemoClockDoc>;

type OnError = (error: Error) => void;

export const listenToPrivateProfile = (
  uid: string,
  onData: (profile: PrivateProfile | null) => void,
  onError: OnError
): (() => void) => listenToDoc(doc(getFirebase().db, PATHS.privateProfile(uid)), privateProfileDocSchema, onData, onError);

export const listenToDemoClock = (onData: (clock: DemoClock | null) => void, onError: OnError): (() => void) =>
  listenToDoc(doc(getFirebase().db, PATHS.demoClock()), demoClockDocSchema, onData, onError);

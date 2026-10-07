/**
 * useVolunteerData.ts
 * Live reads of the signed-in volunteer's own data, each backed by
 * useLiveQuery so every screen shares one listener per document or query:
 * private profile (onboarding state, birth date), signups (my signup
 * status), approved hours, and letters.
 * Each hook takes the uid (or null while signed out) and is disabled for null.
 */
import { useLiveQuery, type LiveQueryResult } from "./useLiveQuery";
import { listenToPrivateProfile, type PrivateProfile } from "@/lib/data/people";
import { listenToMyApprovedLogs, listenToMyLetters, type HoursLog, type Letter } from "@/lib/data/records";
import { listenToMySignups, type Signup } from "@/lib/data/signups";

export const usePrivateProfile = (uid: string | null): LiveQueryResult<PrivateProfile | null> =>
  useLiveQuery({
    queryKey: ["privateProfile", uid],
    enabled: uid !== null,
    subscribe: (onData, onError) => listenToPrivateProfile(uid ?? "", onData, onError)
  });

export const useMySignups = (uid: string | null): LiveQueryResult<Signup[]> =>
  useLiveQuery({
    queryKey: ["mySignups", uid],
    enabled: uid !== null,
    subscribe: (onData, onError) => listenToMySignups(uid ?? "", onData, onError)
  });

export const useMyApprovedLogs = (uid: string | null): LiveQueryResult<HoursLog[]> =>
  useLiveQuery({
    queryKey: ["myApprovedLogs", uid],
    enabled: uid !== null,
    subscribe: (onData, onError) => listenToMyApprovedLogs(uid ?? "", onData, onError)
  });

export const useMyLetters = (uid: string | null): LiveQueryResult<Letter[]> =>
  useLiveQuery({
    queryKey: ["myLetters", uid],
    enabled: uid !== null,
    subscribe: (onData, onError) => listenToMyLetters(uid ?? "", onData, onError)
  });

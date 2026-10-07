/**
 * useShiftData.ts
 * Live reads of shifts and rosters: upcoming shifts for Explore, one shift
 * (status changes such as cancelled or finalized), an org's shifts for the
 * dashboard, a shift roster (coordinator or kiosk), and coordinator contact
 * snapshots. All are onSnapshot-backed through useLiveQuery.
 */
import { useLiveQuery, type LiveQueryResult } from "./useLiveQuery";
import { listenToInstance, listenToOrgInstances, listenToUpcomingInstances, type Instance } from "@/lib/data/instances";
import { listenToRoster, listenToRosterContacts, type Signup, type SignupContact } from "@/lib/data/signups";

/** Rounds the query start to the hour so the listener is not rebuilt every second. */
const HOUR_BUCKET_MS = 60 * 60 * 1000;

export const useUpcomingInstances = (nowMs: number): LiveQueryResult<Instance[]> => {
  const sinceMs = Math.floor(nowMs / HOUR_BUCKET_MS) * HOUR_BUCKET_MS;
  return useLiveQuery({
    queryKey: ["upcomingInstances", sinceMs],
    subscribe: (onData, onError) => listenToUpcomingInstances(sinceMs, onData, onError)
  });
};

export const useInstance = (instanceId: string | null): LiveQueryResult<Instance | null> =>
  useLiveQuery({
    queryKey: ["instance", instanceId],
    enabled: instanceId !== null,
    subscribe: (onData, onError) => listenToInstance(instanceId ?? "", onData, onError)
  });

export const useOrgInstances = (orgId: string | null): LiveQueryResult<Instance[]> =>
  useLiveQuery({
    queryKey: ["orgInstances", orgId],
    enabled: orgId !== null,
    subscribe: (onData, onError) => listenToOrgInstances(orgId ?? "", onData, onError)
  });

/** orgId null means "read as the kiosk token" (see listenToRoster). */
export const useRoster = (instanceId: string | null, orgId: string | null, enabled = true): LiveQueryResult<Signup[]> =>
  useLiveQuery({
    queryKey: ["roster", instanceId, orgId],
    enabled: enabled && instanceId !== null,
    subscribe: (onData, onError) => listenToRoster(instanceId ?? "", orgId, onData, onError)
  });

export const useRosterContacts = (orgId: string, instanceId: string | null, enabled: boolean): LiveQueryResult<SignupContact[]> =>
  useLiveQuery({
    queryKey: ["rosterContacts", orgId, instanceId],
    enabled: enabled && instanceId !== null,
    subscribe: (onData, onError) => listenToRosterContacts(orgId, instanceId ?? "", onData, onError)
  });

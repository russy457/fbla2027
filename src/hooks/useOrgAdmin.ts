/**
 * useOrgAdmin.ts
 * Live coordinator reads for Tier 1 org screens (SPEC 9.2): members,
 * invites, letterRefs, the Needs attention inputs (pending logs, open
 * disputes, org signups for names), recent org logs for analytics, and the
 * org's opportunities (plain query; they change only through this app).
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useLiveQuery, type LiveQueryResult } from "./useLiveQuery";
import type { Member } from "@/lib/data/orgs";
import type { HoursLog } from "@/lib/data/records";
import type { Signup } from "@/lib/data/signups";
import {
  getOrgOpportunities,
  listenToInvites,
  listenToLetterRefs,
  listenToMembers,
  listenToOpenDisputes,
  listenToOrgLogsSince,
  listenToOrgSignups,
  listenToPendingLogs,
  type Invite,
  type LetterRef,
  type Opportunity
} from "@/lib/data/orgAdmin";

export const useMembers = (orgId: string): LiveQueryResult<Member[]> =>
  useLiveQuery({ queryKey: ["orgMembers", orgId], subscribe: (onData, onError) => listenToMembers(orgId, onData, onError) });

export const useInvites = (orgId: string, enabled: boolean): LiveQueryResult<Invite[]> =>
  useLiveQuery({ queryKey: ["orgInvites", orgId], enabled, subscribe: (onData, onError) => listenToInvites(orgId, onData, onError) });

export const useLetterRefs = (orgId: string, enabled: boolean): LiveQueryResult<LetterRef[]> =>
  useLiveQuery({ queryKey: ["orgLetterRefs", orgId], enabled, subscribe: (onData, onError) => listenToLetterRefs(orgId, onData, onError) });

export const usePendingLogs = (orgId: string): LiveQueryResult<HoursLog[]> =>
  useLiveQuery({ queryKey: ["orgPendingLogs", orgId], subscribe: (onData, onError) => listenToPendingLogs(orgId, onData, onError) });

export const useOpenDisputes = (orgId: string): LiveQueryResult<Signup[]> =>
  useLiveQuery({ queryKey: ["orgDisputes", orgId], subscribe: (onData, onError) => listenToOpenDisputes(orgId, onData, onError) });

export const useOrgSignups = (orgId: string): LiveQueryResult<Signup[]> =>
  useLiveQuery({ queryKey: ["orgSignups", orgId], subscribe: (onData, onError) => listenToOrgSignups(orgId, onData, onError) });

export const useOrgLogsSince = (orgId: string, sinceMs: number): LiveQueryResult<HoursLog[]> =>
  useLiveQuery({
    queryKey: ["orgLogsSince", orgId, sinceMs],
    subscribe: (onData, onError) => listenToOrgLogsSince(orgId, sinceMs, onData, onError)
  });

export const useOrgOpportunities = (orgId: string): UseQueryResult<Opportunity[]> =>
  useQuery({ queryKey: ["orgOpportunities", orgId], queryFn: () => getOrgOpportunities(orgId), staleTime: 30_000 });

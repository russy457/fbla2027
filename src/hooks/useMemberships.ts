/**
 * useMemberships.ts
 * Organization memberships of the signed-in person (SPEC#roles): drives the
 * "Coordinator" nav link (D2: shown only with a membership) and the
 * coordinator route guard. Plain TanStack queries (not live): memberships
 * change rarely and only through invites.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getMyMembership, getMyMemberships, type Member, type Membership } from "@/lib/data/orgs";

const MEMBERSHIP_STALE_MS = 5 * 60 * 1000;

export const useMyMemberships = (uid: string | null): UseQueryResult<Membership[]> =>
  useQuery({
    queryKey: ["myMemberships", uid],
    queryFn: () => getMyMemberships(uid ?? ""),
    enabled: uid !== null,
    staleTime: MEMBERSHIP_STALE_MS
  });

export const useMembership = (orgId: string, uid: string | null): UseQueryResult<Member | null> =>
  useQuery({
    queryKey: ["membership", orgId, uid],
    queryFn: () => getMyMembership(orgId, uid ?? ""),
    enabled: uid !== null,
    staleTime: MEMBERSHIP_STALE_MS
  });

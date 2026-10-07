/**
 * useOpportunity.ts
 * One opportunity (description, place) for the Opportunity screen. A plain
 * TanStack query, not live: descriptions change rarely, while the parts that
 * move (seats, status) come from the live instance.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getOpportunity, type Opportunity } from "@/lib/data/opportunities";

const OPPORTUNITY_STALE_MS = 5 * 60 * 1000;

export const useOpportunity = (opportunityId: string | null): UseQueryResult<Opportunity | null> =>
  useQuery({
    queryKey: ["opportunity", opportunityId],
    queryFn: () => getOpportunity(opportunityId ?? ""),
    enabled: opportunityId !== null,
    staleTime: OPPORTUNITY_STALE_MS
  });

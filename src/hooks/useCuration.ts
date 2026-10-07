/**
 * useCuration.ts
 * Live reads for Tier 2 lane B screens through useLiveQuery (one shared
 * listener per key): published collections (Explore), an org's or the
 * admins' collections (editor), one collection (its page), and an org's
 * reviews (public org page). Hooks taking an id are disabled while it is "".
 */
import { useLiveQuery, type LiveQueryResult } from "./useLiveQuery";
import {
  listenToCollection,
  listenToOwnedCollections,
  listenToPublishedCollections,
  type CuratedCollection
} from "@/lib/data/curatedCollections";
import { listenToOrgReviews, type Review } from "@/lib/data/reviews";

export const usePublishedCollections = (): LiveQueryResult<CuratedCollection[]> =>
  useLiveQuery({ queryKey: ["publishedCollections"], subscribe: listenToPublishedCollections });

/** orgId null = the admin-authored collections. Pass enabled false until the caller may read them. */
export const useOwnedCollections = (orgId: string | null, enabled = true): LiveQueryResult<CuratedCollection[]> =>
  useLiveQuery({
    queryKey: ["ownedCollections", orgId],
    enabled,
    subscribe: (onData, onError) => listenToOwnedCollections(orgId, onData, onError)
  });

export const useCuratedCollection = (collectionId: string): LiveQueryResult<CuratedCollection | null> =>
  useLiveQuery({
    queryKey: ["curatedCollection", collectionId],
    enabled: collectionId !== "",
    subscribe: (onData, onError) => listenToCollection(collectionId, onData, onError)
  });

export const useOrgReviews = (orgId: string): LiveQueryResult<Review[]> =>
  useLiveQuery({
    queryKey: ["orgReviews", orgId],
    enabled: orgId !== "",
    subscribe: (onData, onError) => listenToOrgReviews(orgId, onData, onError)
  });

/**
 * useInbox.ts
 * Live reads for Tier 1 lane A screens, each through useLiveQuery so every
 * component shares one listener: notifications (list and unread badge),
 * saved items, and the active opportunity catalog. Hooks taking a uid are
 * disabled while it is null.
 */
import { useLiveQuery, type LiveQueryResult } from "./useLiveQuery";
import { listenToActiveOpportunities } from "@/lib/data/catalog";
import {
  listenToNotifications,
  listenToSavedItems,
  listenToUnreadNotifications,
  listenToMyPublicUser,
  type PublicUser,
  type NotificationItem,
  type SavedItem
} from "@/lib/data/inbox";
import type { Opportunity } from "@/lib/data/opportunities";

export const useNotifications = (uid: string | null): LiveQueryResult<NotificationItem[]> =>
  useLiveQuery({
    queryKey: ["notifications", uid],
    enabled: uid !== null,
    subscribe: (onData, onError) => listenToNotifications(uid ?? "", onData, onError)
  });

export const useUnreadNotifications = (uid: string | null): LiveQueryResult<NotificationItem[]> =>
  useLiveQuery({
    queryKey: ["unreadNotifications", uid],
    enabled: uid !== null,
    subscribe: (onData, onError) => listenToUnreadNotifications(uid ?? "", onData, onError)
  });

export const useSavedItems = (uid: string | null): LiveQueryResult<SavedItem[]> =>
  useLiveQuery({
    queryKey: ["savedItems", uid],
    enabled: uid !== null,
    subscribe: (onData, onError) => listenToSavedItems(uid ?? "", onData, onError)
  });

export const useActiveOpportunities = (): LiveQueryResult<Opportunity[]> =>
  useLiveQuery({ queryKey: ["activeOpportunities"], subscribe: listenToActiveOpportunities });

export const useMyPublicUser = (uid: string | null): LiveQueryResult<PublicUser | null> =>
  useLiveQuery({
    queryKey: ["publicUser", uid],
    enabled: uid !== null,
    subscribe: (onData, onError) => listenToMyPublicUser(uid ?? "", onData, onError)
  });

/**
 * inbox.ts
 * Reads of the signed-in person's notifications (SPEC 3.15, Q22, Q23) and
 * saved items (SPEC 3.18, Q30), plus the saved-item writes the rules allow
 * (create with {kind, refId, savedAt: server time}, delete), and the public
 * users/{uid} projection for milestones. Notification
 * writes go through volunteer.markNotificationsRead, never from here.
 */
import { collection, deleteDoc, doc, limit, orderBy, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import {
  COLLECTIONS,
  PATHS,
  UNREAD_BADGE_CAP,
  notificationDocSchema,
  savedItemDocSchema,
  savedItemIdFor,
  type NotificationDoc,
  type SavedItemDoc,
  type SavedKind,
  type UserPublicDoc,
  userPublicDocSchema
} from "@fbla/shared";
import { getFirebase } from "../firebase";
import { listenToDoc, listenToQuery } from "./listen";
import type { WithId } from "./parse";

export type NotificationItem = WithId<NotificationDoc>;
export type SavedItem = WithId<SavedItemDoc>;
export type PublicUser = WithId<UserPublicDoc>;

type OnError = (error: Error) => void;

/** The list on /me/notifications: the newest 50. */
export const NOTIFICATION_LIST_LIMIT = 50;

export const listenToNotifications = (uid: string, onData: (items: NotificationItem[]) => void, onError: OnError): (() => void) =>
  listenToQuery(
    query(collection(getFirebase().db, PATHS.notificationItems(uid)), orderBy("createdAt", "desc"), limit(NOTIFICATION_LIST_LIMIT)),
    notificationDocSchema,
    onData,
    onError
  );

/** Unread items, newest first; one past the badge cap so the header can show "99+". */
export const listenToUnreadNotifications = (uid: string, onData: (items: NotificationItem[]) => void, onError: OnError): (() => void) =>
  listenToQuery(
    query(collection(getFirebase().db, PATHS.notificationItems(uid)), where("read", "==", false), orderBy("createdAt", "desc"), limit(UNREAD_BADGE_CAP + 1)),
    notificationDocSchema,
    onData,
    onError
  );

/**
 * Saved items, newest first. A just-saved item briefly has savedAt pending
 * (null in the local snapshot), so those are read with server estimates.
 */
export const listenToSavedItems = (uid: string, onData: (items: SavedItem[]) => void, onError: OnError): (() => void) =>
  listenToQuery(query(collection(getFirebase().db, PATHS.savedItems(uid)), orderBy("savedAt", "desc")), savedItemDocSchema, onData, onError, {
    serverTimestamps: "estimate"
  });

export const saveItem = async (uid: string, kind: SavedKind, refId: string): Promise<void> => {
  await setDoc(doc(getFirebase().db, PATHS.savedItem(uid, savedItemIdFor(kind, refId))), { kind, refId, savedAt: serverTimestamp() });
};

export const unsaveItem = async (uid: string, kind: SavedKind, refId: string): Promise<void> => {
  await deleteDoc(doc(getFirebase().db, PATHS.savedItem(uid, savedItemIdFor(kind, refId))));
};

/** users/{uid}: display name, badges, and streak for the Impact milestones and badge card. */
export const listenToMyPublicUser = (uid: string, onData: (user: PublicUser | null) => void, onError: OnError): (() => void) =>
  listenToDoc(doc(getFirebase().db, COLLECTIONS.users, uid), userPublicDocSchema, onData, onError);

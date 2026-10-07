/**
 * notify.ts
 * Writes in-app notifications (SPEC 3.15, SPEC 8.3). Content comes from
 * shared/src/notifications.ts so the copy matches the SPEC table; this file
 * only turns it into a document at notifications/{uid}/items/{id}.
 *
 * Ids are deterministic (notificationIdFor), and the write is a set inside the
 * caller's transaction, so a retried op or a repeated job rewrites one item
 * instead of sending a second alert. Timestamps come from the request clock.
 */
import type { DocumentReference, Firestore } from "firebase-admin/firestore";
import { PATHS, notificationIdFor, type NotificationContent, type NotificationDoc } from "@fbla/shared";
import { ts } from "../lib/firestore";

export const notificationDoc = (content: NotificationContent, nowMs: number): NotificationDoc => ({
  type: content.type,
  title: content.title,
  body: content.body,
  link: content.link,
  data: content.data,
  read: false,
  createdAt: ts(nowMs),
  updatedAt: ts(nowMs)
});

/** Where a notification for `uid` about `key` lives (key is usually the signupId). */
export const notificationRef = (db: Firestore, uid: string, content: NotificationContent, key: string) =>
  db.doc(PATHS.notificationItem(uid, notificationIdFor(content.type, key)));

/** Anything with set(ref, data): a Transaction or a WriteBatch. */
export interface DocWriter {
  set(ref: DocumentReference, data: NotificationDoc): unknown;
}

/** Adds the notification to a transaction or batch. */
export const queueNotification = (
  writer: DocWriter,
  db: Firestore,
  uid: string,
  content: NotificationContent,
  key: string,
  nowMs: number
): void => {
  writer.set(notificationRef(db, uid, content, key), notificationDoc(content, nowMs));
};

/**
 * inboxDocs.ts
 * Per-user documents for Tier 1 lane A: in-app notifications
 * (SPEC 3.15 notifications/{uid}/items, written only by Functions) and saved
 * items (SPEC 3.18 users/{uid}/saved/{kind}_{refId}, written by the owner
 * under the rules). Alerts are in-app only: no email, SMS, or push (SPEC 1.3).
 */
import { z } from "zod";
import { timestampSchema } from "./common";

export const NOTIFICATION_TYPES = [
  "waitlist-promoted",
  "waitlist-closed",
  "shift-cancelled",
  "shift-changed",
  "hours-approved",
  "hours-rejected",
  "attendance-changed",
  "letter-superseded",
  "letter-revoked",
  "dispute-opened",
  "shift-invite"
] as const;
export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const notificationDataSchema = z
  .object({ instanceId: z.string().optional(), signupId: z.string().optional(), letterId: z.string().optional() })
  .strict();
export type NotificationData = z.infer<typeof notificationDataSchema>;

/** notifications/{uid}/items/{itemId} */
export const notificationDocSchema = z.object({
  type: notificationTypeSchema,
  title: z.string().min(1).max(200),
  body: z.string().max(500),
  /** In-app path, always starting with "/". */
  link: z.string().regex(/^\/[^/]/, { message: "must be an app path" }),
  data: notificationDataSchema,
  read: z.boolean(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
});
export type NotificationDoc = z.infer<typeof notificationDocSchema>;

export const SAVED_KINDS = ["org", "opportunity"] as const;
export const savedKindSchema = z.enum(SAVED_KINDS);
export type SavedKind = z.infer<typeof savedKindSchema>;

/** users/{uid}/saved/{kind}_{refId}; savedAt is request.time (rules enforce it). */
export const savedItemDocSchema = z
  .object({ kind: savedKindSchema, refId: z.string().min(1).max(200), savedAt: timestampSchema })
  .strict();
export type SavedItemDoc = z.infer<typeof savedItemDocSchema>;

/** The saved-item document id: one document per thing saved, so saving twice is a no-op. */
export const savedItemIdFor = (kind: SavedKind, refId: string): string => `${kind}_${refId}`;

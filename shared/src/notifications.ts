/**
 * notifications.ts
 * Copy, links, and ids for in-app notifications (SPEC 8.3 table). Every op
 * that notifies builds its document here, so the wording matches the SPEC
 * table everywhere and other lanes add types without inventing new phrasing.
 *
 * Ids are deterministic ({type}_{key}), so a retried op or a repeated job
 * overwrites the same item instead of sending a duplicate alert.
 */
import { formatInTimeZone } from "date-fns-tz";
import type { NotificationData, NotificationType } from "./schemas/inboxDocs";

export interface NotificationContent {
  readonly type: NotificationType;
  readonly title: string;
  readonly body: string;
  readonly link: string;
  readonly data: NotificationData;
}

/** Badge count cap (SPEC 8.3: "99+"). */
export const UNREAD_BADGE_CAP = 99;

/** "99+" above the cap, else the number. */
export const unreadBadgeText = (count: number): string => (count > UNREAD_BADGE_CAP ? `${UNREAD_BADGE_CAP}+` : String(count));

/** One notification per (type, key): a retry rewrites the same document. */
export const notificationIdFor = (type: NotificationType, key: string): string => `${type}_${key}`;

const shiftLink = (instanceId: string): string => `/opportunity/${encodeURIComponent(instanceId)}`;

/** "Saturday 9 AM", or "Saturday 9:30 AM" when the minutes are not zero, in the shift's zone. */
export const dayAndTime = (atMs: number, timeZone: string): string => {
  const at = new Date(atMs);
  const minutes = formatInTimeZone(at, timeZone, "mm");
  return formatInTimeZone(at, timeZone, minutes === "00" ? "EEEE h a" : "EEEE h:mm a");
};

export interface ShiftRef {
  readonly instanceId: string;
  readonly signupId?: string;
  readonly title: string;
  readonly orgName: string;
  readonly startMs: number;
  readonly timeZone: string;
}

const shiftData = (shift: ShiftRef): NotificationData =>
  shift.signupId === undefined ? { instanceId: shift.instanceId } : { instanceId: shift.instanceId, signupId: shift.signupId };

/** waitlist-promoted: carries the Confirm / Can't make it actions in the UI (SPEC 9.11). */
export const waitlistPromotedNotification = (shift: ShiftRef): NotificationContent => ({
  type: "waitlist-promoted",
  title: `You're in! ${dayAndTime(shift.startMs, shift.timeZone)}`,
  body: `A spot opened on ${shift.title} at ${shift.orgName}. Confirm it, or let it go so the next person gets it.`,
  link: shiftLink(shift.instanceId),
  data: shiftData(shift)
});

export const waitlistClosedNotification = (shift: ShiftRef): NotificationContent => ({
  type: "waitlist-closed",
  title: `The waitlist for ${shift.title} closed`,
  body: "No spot opened before the waitlist closed 2 hours before the start. This does not count against you.",
  link: shiftLink(shift.instanceId),
  data: shiftData(shift)
});

export const shiftCancelledNotification = (shift: ShiftRef): NotificationContent => ({
  type: "shift-cancelled",
  title: `${shift.title} on ${formatInTimeZone(new Date(shift.startMs), shift.timeZone, "MMM d")} was cancelled by the organization`,
  body: `${shift.orgName} cancelled this shift. This does not count against you.`,
  link: shiftLink(shift.instanceId),
  data: shiftData(shift)
});

/** shift-changed: startMs is the NEW start. */
export const shiftChangedNotification = (shift: ShiftRef): NotificationContent => ({
  type: "shift-changed",
  title: `${shift.title} moved to ${formatInTimeZone(new Date(shift.startMs), shift.timeZone, "EEE, MMM d, h:mm a zzz")}`,
  body: `${shift.orgName} changed the time. If it no longer works, cancel so someone else can go.`,
  link: shiftLink(shift.instanceId),
  data: shiftData(shift)
});

export const hoursApprovedNotification = (hours: number, orgName: string): NotificationContent => ({
  type: "hours-approved",
  title: `${hours} ${hours === 1 ? "hour" : "hours"} approved at ${orgName}`,
  body: "They now count toward your total and your verified letters.",
  link: "/impact",
  data: {}
});

export const hoursRejectedNotification = (orgName: string, reason: string): NotificationContent => ({
  type: "hours-rejected",
  title: `Hours at ${orgName} were not approved: ${reason}`,
  body: "Ask the organization if you think this is a mistake.",
  link: "/impact",
  data: {}
});

export const attendanceChangedNotification = (shift: ShiftRef): NotificationContent => ({
  type: "attendance-changed",
  title: `Your attendance for ${shift.title} was updated`,
  body: `${shift.orgName} updated your attendance record.`,
  link: "/me/shifts",
  data: shiftData(shift)
});

export const letterSupersededNotification = (letterId: string): NotificationContent => ({
  type: "letter-superseded",
  title: "Your letter's hours changed",
  body: "Your letter's hours changed. Issue a new letter to get a current one.",
  link: "/impact",
  data: { letterId }
});

export const letterRevokedNotification = (letterId: string): NotificationContent => ({
  type: "letter-revoked",
  title: "A letter was revoked",
  body: "One of your letters was revoked and no longer verifies.",
  link: "/impact",
  data: { letterId }
});

/** To coordinators: link is their dashboard. */
export const disputeOpenedNotification = (volunteerName: string, shift: ShiftRef, orgId: string): NotificationContent => ({
  type: "dispute-opened",
  title: `${volunteerName} asked for a review of ${shift.title}`,
  body: "Open Needs attention on the dashboard to review it.",
  link: `/org/${encodeURIComponent(orgId)}/dashboard`,
  data: shiftData(shift)
});

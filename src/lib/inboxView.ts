/**
 * inboxView.ts
 * Pure view logic for alerts (SPEC 8.3, SPEC#screen-promotion D13):
 *   groupNotificationsByDay  the /me/notifications list, grouped by local day
 *   activePromotions         unread waitlist-promoted alerts whose signup is
 *                            still confirmed and whose shift has not started:
 *                            the "You're in!" banner with Confirm / Can't make it
 *   upcomingReminders        confirmed signups starting within 24 h; computed
 *                            here, never stored (SPEC 3.15)
 */
import { formatInTimeZone } from "date-fns-tz";
import { HOUR_MS, type NotificationType, type SignupStatus } from "@fbla/shared";

interface TimestampLike {
  toMillis(): number;
}

export interface InboxItemLike {
  readonly id: string;
  readonly type: NotificationType;
  readonly read: boolean;
  readonly createdAt: TimestampLike;
  readonly data: { readonly signupId?: string; readonly instanceId?: string };
}

export interface DayGroup<T> {
  readonly key: string;
  readonly label: string;
  readonly items: readonly T[];
}

/** Newest day first; "Today" and "Yesterday" by name, other days by date, in the viewer's zone. */
export const groupNotificationsByDay = <T extends InboxItemLike>(items: readonly T[], nowMs: number, timeZone: string): DayGroup<T>[] => {
  const dayOf = (ms: number): string => formatInTimeZone(new Date(ms), timeZone, "yyyy-MM-dd");
  const today = dayOf(nowMs);
  const yesterday = dayOf(nowMs - 24 * HOUR_MS);
  const groups = new Map<string, T[]>();
  [...items]
    .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
    .forEach((item) => {
      const key = dayOf(item.createdAt.toMillis());
      groups.set(key, [...(groups.get(key) ?? []), item]);
    });
  return [...groups.entries()].map(([key, dayItems]) => ({
    key,
    label: key === today ? "Today" : key === yesterday ? "Yesterday" : formatInTimeZone(new Date(`${key}T12:00:00Z`), "UTC", "EEEE, MMM d"),
    items: dayItems
  }));
};

export interface SignupLike {
  readonly id: string;
  readonly status: SignupStatus;
  readonly instanceStart: TimestampLike;
}

export interface Promotion<N, S> {
  readonly notification: N;
  readonly signup: S;
}

/** Banner entries: unread promotions still worth acting on, soonest shift first. */
export const activePromotions = <N extends InboxItemLike, S extends SignupLike>(
  notifications: readonly N[],
  signups: readonly S[],
  nowMs: number
): Promotion<N, S>[] => {
  const byId = new Map(signups.map((signup) => [signup.id, signup]));
  return notifications
    .filter((item) => item.type === "waitlist-promoted" && !item.read)
    .flatMap((notification) => {
      const signup = notification.data.signupId === undefined ? undefined : byId.get(notification.data.signupId);
      return signup !== undefined && signup.status === "confirmed" && signup.instanceStart.toMillis() > nowMs ? [{ notification, signup }] : [];
    })
    .sort((a, b) => a.signup.instanceStart.toMillis() - b.signup.instanceStart.toMillis());
};

/** Reminder window (SPEC 3.15: confirmed signups starting within 24 h). */
export const REMINDER_WINDOW_MS = 24 * HOUR_MS;

export const upcomingReminders = <S extends SignupLike>(signups: readonly S[], nowMs: number, excludeIds: ReadonlySet<string> = new Set()): S[] =>
  signups
    .filter((signup) => {
      const startMs = signup.instanceStart.toMillis();
      return signup.status === "confirmed" && !excludeIds.has(signup.id) && startMs > nowMs && startMs - nowMs <= REMINDER_WINDOW_MS;
    })
    .sort((a, b) => a.instanceStart.toMillis() - b.instanceStart.toMillis());

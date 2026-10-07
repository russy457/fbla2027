/**
 * PromotionBanner.tsx
 * "You're in!" banner for waitlist promotions, plus shift reminders
 * (SPEC#screen-promotion D13, SPEC 8.3, SPEC 3.15). Shown on Explore and My
 * Shifts. Each promotion offers:
 *   Confirm          marks the alert read (volunteer.markNotificationsRead)
 *   Can't make it    releases the seat without a late-cancel mark
 *                    (cancelSignup {release: true}), then marks it read
 * The region is aria-live so a promotion that arrives while the page is open
 * is announced (D20). No optimistic UI: buttons show pending until the
 * Function returns; the banner then disappears from the live snapshot.
 * Reminders (confirmed shifts within 24 h) are computed, never stored.
 */
import { useState, type ReactElement } from "react";
import { Link } from "react-router-dom";
import { BellRinging, CalendarCheck } from "@phosphor-icons/react";
import { formatShiftTime, type UserError } from "@fbla/shared";
import { ErrorNotice } from "@/components/errors/ErrorNotice";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { useUnreadNotifications } from "@/hooks/useInbox";
import { useInstance } from "@/hooks/useShiftData";
import { ApiError, NETWORK_USER_ERROR, api } from "@/lib/api";
import type { NotificationItem } from "@/lib/data/inbox";
import type { Signup } from "@/lib/data/signups";
import { activePromotions, upcomingReminders } from "@/lib/inboxView";

interface PromotionBannerProps {
  readonly uid: string;
  readonly signups: readonly Signup[];
  readonly nowMs: number;
}

type Pending = "confirm" | "release" | null;

const PromotionCard = ({ notification, signup }: { notification: NotificationItem; signup: Signup }): ReactElement => {
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<UserError | null>(null);

  const run = async (kind: Exclude<Pending, null>): Promise<void> => {
    setPending(kind);
    setError(null);
    try {
      if (kind === "release") await api.volunteer.cancelSignup({ signupId: signup.id, release: true });
      await api.volunteer.markNotificationsRead({ itemIds: [notification.id] });
    } catch (runError) {
      setError(runError instanceof ApiError ? runError.userError : NETWORK_USER_ERROR);
    } finally {
      setPending(null);
    }
  };

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-status-success bg-status-success-subtle p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <BellRinging aria-hidden="true" size={24} weight="bold" className="mt-0.5 shrink-0 text-status-success" />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-lg font-semibold text-fg">{notification.title}</p>
          <p className="text-sm text-fg-muted">{notification.body}</p>
          <Link to={notification.link} className="w-fit text-sm font-semibold text-accent underline underline-offset-2">
            See the shift
          </Link>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending !== null} onClick={() => void run("confirm")} className={buttonClassName("primary")}>
          {pending === "confirm" ? "Confirming..." : "Confirm"}
        </button>
        <button type="button" disabled={pending !== null} onClick={() => void run("release")} className={buttonClassName("secondary")}>
          {pending === "release" ? "Letting it go..." : "Can't make it"}
        </button>
      </div>
      {error ? <ErrorNotice error={error} className="w-full" /> : null}
    </li>
  );
};

const Reminder = ({ signup }: { signup: Signup }): ReactElement => {
  const instance = useInstance(signup.instanceId);
  const shift = instance.data;
  return (
    <li className="flex items-center gap-2 text-sm text-fg">
      <CalendarCheck aria-hidden="true" size={18} className="shrink-0 text-accent" />
      <span>
        Coming up:{" "}
        {shift ? (
          <Link to={`/opportunity/${encodeURIComponent(shift.id)}`} className="font-semibold underline underline-offset-2">
            {shift.title}
          </Link>
        ) : (
          "your shift"
        )}
        {shift ? `, ${formatShiftTime(shift.start.toDate(), shift.timeZone)}` : ""}
      </span>
    </li>
  );
};

export const PromotionBanner = ({ uid, signups, nowMs }: PromotionBannerProps): ReactElement | null => {
  const unread = useUnreadNotifications(uid);
  const promotions = activePromotions(unread.data ?? [], signups, nowMs);
  const reminders = upcomingReminders(signups, nowMs, new Set(promotions.map((entry) => entry.signup.id)));

  return (
    <section aria-label="Updates about your shifts" aria-live="polite" className={promotions.length + reminders.length > 0 ? "flex flex-col gap-3" : "sr-only"}>
      {promotions.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {promotions.map((entry) => (
            <PromotionCard key={entry.notification.id} notification={entry.notification} signup={entry.signup} />
          ))}
        </ul>
      ) : null}
      {reminders.length > 0 ? (
        <ul aria-label="Reminders" className="flex flex-col gap-1">
          {reminders.map((signup) => (
            <Reminder key={signup.id} signup={signup} />
          ))}
        </ul>
      ) : null}
    </section>
  );
};

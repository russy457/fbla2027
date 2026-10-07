/**
 * NotificationBadge.tsx
 * Header link to /me/notifications with the unread count (SPEC 8.3 Tier 1:
 * "Header badge with unread count (99+ cap) that opens /me/notifications
 * directly"). The count is in the accessible name, not only in the dot, and
 * the bell menu with AnimatedList is Tier 2.
 */
import type { ReactElement } from "react";
import { NavLink } from "react-router-dom";
import { Bell } from "@phosphor-icons/react";
import { unreadBadgeText } from "@fbla/shared";
import { useUnreadNotifications } from "@/hooks/useInbox";
import { cn } from "@/lib/cn";

export const NotificationBadge = ({ uid }: { uid: string }): ReactElement => {
  const unread = useUnreadNotifications(uid);
  const count = unread.data?.length ?? 0;
  const text = unreadBadgeText(count);
  return (
    <NavLink
      to="/me/notifications"
      aria-label={count === 0 ? "Notifications" : `Notifications, ${text} unread`}
      className={({ isActive }) =>
        cn(
          "relative inline-flex min-h-touch min-w-touch items-center justify-center rounded-md transition-colors duration-(--duration-fast)",
          isActive ? "bg-accent-subtle text-accent" : "text-fg-muted hover:bg-surface-sunken hover:text-fg"
        )
      }
    >
      <Bell aria-hidden="true" size={20} />
      {count > 0 ? (
        <span
          aria-hidden="true"
          data-testid="unread-badge"
          className="absolute top-1 right-0.5 min-w-5 rounded-full bg-accent px-1 text-center text-xs leading-5 font-semibold text-accent-fg"
        >
          {text}
        </span>
      ) : null}
    </NavLink>
  );
};

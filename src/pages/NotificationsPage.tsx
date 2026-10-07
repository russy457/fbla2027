/**
 * NotificationsPage.tsx
 * Route "/me/notifications" (SPEC#screen-inventory "Notifications", Tier 1).
 * The newest 50 alerts grouped by day, unread ones marked with a dot and the
 * word "New" (never color alone), Mark all read, and each item opens its
 * link and marks itself read. Alerts are in-app only (SPEC 8.3); the empty
 * state says so (D6).
 */
import { useState, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import { Checks } from "@phosphor-icons/react";
import { DEFAULT_TIME_ZONE, type UserError } from "@fbla/shared";
import { ErrorNotice } from "@/components/errors/ErrorNotice";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { PageHeader } from "@/components/ui/PageHeader";
import { useNotifications } from "@/hooks/useInbox";
import { useNow } from "@/hooks/useNow";
import { ApiError, NETWORK_USER_ERROR, api } from "@/lib/api";
import type { NotificationItem } from "@/lib/data/inbox";
import { cn } from "@/lib/cn";
import { groupNotificationsByDay } from "@/lib/inboxView";
import { useSessionUser } from "@/store/authStore";

/** The day labels use the viewer's own zone; the app's default when the browser has none. */
const viewerZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIME_ZONE;

const toUserError = (error: unknown): UserError => (error instanceof ApiError ? error.userError : NETWORK_USER_ERROR);

const Item = ({ item, onOpen }: { item: NotificationItem; onOpen: (item: NotificationItem) => void }): ReactElement => (
  <li>
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={cn(
        "flex w-full min-h-touch items-start gap-3 rounded-md px-3 py-3 text-left hover:bg-surface-sunken",
        item.read ? "text-fg-muted" : "text-fg"
      )}
    >
      <span aria-hidden="true" className={cn("mt-2 size-2.5 shrink-0 rounded-full", item.read ? "bg-transparent" : "bg-accent")} />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-semibold">
          {item.read ? null : <span className="mr-2 text-xs font-semibold tracking-wide text-accent uppercase">New</span>}
          {item.title}
        </span>
        <span className="text-sm text-fg-muted">{item.body}</span>
      </span>
    </button>
  </li>
);

const NotificationsPage = (): ReactElement => {
  const user = useSessionUser();
  const uid = user?.uid ?? null;
  const nowMs = useNow(60_000);
  const navigate = useNavigate();
  const items = useNotifications(uid);
  const [isMarking, setIsMarking] = useState(false);
  const [error, setError] = useState<UserError | null>(null);

  if (items.error) return <ErrorState title="We couldn't load your notifications" description="Check your connection, then reload the page." />;
  if (items.isLoading) return <LoadingState label="Loading your notifications" />;
  const list = items.data ?? [];
  const unreadCount = list.filter((item) => !item.read).length;
  const groups = groupNotificationsByDay(list, nowMs, viewerZone());

  const markAll = async (): Promise<void> => {
    setIsMarking(true);
    setError(null);
    try {
      await api.volunteer.markNotificationsRead({ all: true });
    } catch (markError) {
      setError(toUserError(markError));
    } finally {
      setIsMarking(false);
    }
  };

  const open = (item: NotificationItem): void => {
    // Opening does not wait on the read flag; a failure only leaves the item unread.
    if (!item.read) void api.volunteer.markNotificationsRead({ itemIds: [item.id] }).catch(() => undefined);
    navigate(item.link);
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Notifications">Updates about your shifts, hours, and letters. Alerts appear here, in the app only.</PageHeader>
      {list.length === 0 ? (
        <p className="text-fg-muted">No alerts yet. Alerts appear here, in the app only.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <p aria-live="polite" className="text-sm text-fg-muted">
              {unreadCount === 0 ? "All caught up." : `${unreadCount} unread`}
            </p>
            <button type="button" disabled={isMarking || unreadCount === 0} onClick={() => void markAll()} className={buttonClassName("secondary")}>
              <Checks aria-hidden="true" size={18} />
              {isMarking ? "Marking..." : "Mark all read"}
            </button>
          </div>
          {error ? <ErrorNotice error={error} className="max-w-md" /> : null}
          {groups.map((group) => (
            <section key={group.key} aria-labelledby={`alerts-${group.key}`} className="flex flex-col gap-1">
              <h2 id={`alerts-${group.key}`} className="border-b border-border-strong pb-2 text-sm font-semibold text-fg-muted">
                {group.label}
              </h2>
              <ul className="flex flex-col">
                {group.items.map((item) => (
                  <Item key={item.id} item={item} onOpen={open} />
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
};

export default NotificationsPage;

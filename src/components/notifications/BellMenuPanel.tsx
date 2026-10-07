/**
 * BellMenuPanel.tsx
 * The contents of the notifications bell menu (SPEC 8.3 Tier 2: "Bell menu
 * with AnimatedList of the latest 10, same data"). Presentational: the menu
 * (BellMenu) owns data, open state, and navigation.
 *
 *   header   title, unread count (also announced politely), Mark all read
 *   list     the latest 10 alerts in a React Bits AnimatedList (a focusable
 *            listbox: Up/Down to move, Enter to open); unread rows say
 *            "New" in text, never color alone; reduced motion renders rows
 *            without the scale-in
 *   footer   "See all notifications" opens /me/notifications
 */
import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { Checks } from "@phosphor-icons/react";
import { unreadBadgeText, type UserError } from "@fbla/shared";
import AnimatedList from "@/components/bits/AnimatedList";
import { ErrorNotice } from "@/components/errors/ErrorNotice";
import { buttonClassName } from "@/components/ui/buttonStyles";
import type { NotificationItem } from "@/lib/data/inbox";
import { cn } from "@/lib/cn";

/** SPEC 8.3: the bell shows the latest 10. */
export const BELL_MENU_LIMIT = 10;

interface BellMenuPanelProps {
  readonly titleId: string;
  readonly items: readonly NotificationItem[];
  readonly unreadCount: number;
  readonly isLoading: boolean;
  readonly hasLoadError: boolean;
  readonly isMarking: boolean;
  readonly error: UserError | null;
  readonly onMarkAll: () => void;
  readonly onOpenItem: (item: NotificationItem) => void;
  readonly onSeeAll: () => void;
}

const BellRow = ({ item }: { item: NotificationItem }): ReactElement => (
  <span className="flex items-start gap-3">
    <span aria-hidden="true" className={cn("mt-1.5 size-2 shrink-0 rounded-full", item.read ? "bg-transparent" : "bg-accent")} />
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className={cn("text-sm font-semibold", item.read ? "text-fg-muted" : "text-fg")}>
        {item.read ? null : <span className="mr-2 text-xs tracking-wide text-accent uppercase">New</span>}
        {item.title}
      </span>
      {item.body ? <span className="line-clamp-2 text-sm text-fg-muted">{item.body}</span> : null}
    </span>
  </span>
);

const unreadSentence = (count: number): string => (count === 0 ? "All caught up." : `${unreadBadgeText(count)} unread`);

export const BellMenuPanel = ({
  titleId,
  items,
  unreadCount,
  isLoading,
  hasLoadError,
  isMarking,
  error,
  onMarkAll,
  onOpenItem,
  onSeeAll
}: BellMenuPanelProps): ReactElement => {
  const latest = items.slice(0, BELL_MENU_LIMIT);
  const renderBody = (): ReactElement => {
    if (hasLoadError) return <p className="px-4 py-6 text-sm text-fg-muted">We couldn't load your alerts. Check your connection, then try again.</p>;
    if (isLoading) return <p className="px-4 py-6 text-sm text-fg-muted">Loading your alerts...</p>;
    if (latest.length === 0) return <p className="px-4 py-6 text-sm text-fg-muted">No alerts yet. Alerts appear here, in the app only.</p>;
    return (
      <AnimatedList
        items={latest}
        label="Latest alerts"
        getKey={(item) => item.id}
        onItemSelect={(item) => onOpenItem(item)}
        renderItem={(item) => <BellRow item={item} />}
        showGradients={false}
        itemClassName="p-3"
        className="px-1"
      />
    );
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex flex-col">
          <h2 id={titleId} className="text-base font-semibold text-fg">
            Notifications
          </h2>
          <p aria-live="polite" className="text-sm text-fg-muted">
            {unreadSentence(unreadCount)}
          </p>
        </div>
        <button type="button" onClick={onMarkAll} disabled={isMarking || unreadCount === 0} className={buttonClassName("secondary", "px-3")}>
          <Checks aria-hidden="true" size={18} />
          {isMarking ? "Marking..." : "Mark all read"}
        </button>
      </div>
      {error ? <ErrorNotice error={error} className="mx-4 mt-3" /> : null}
      {renderBody()}
      <div className="border-t border-border px-4 py-2">
        <Link to="/me/notifications" onClick={onSeeAll} className="inline-flex min-h-touch items-center text-sm font-semibold text-accent underline-offset-4 hover:underline">
          See all notifications
        </Link>
      </div>
    </>
  );
};

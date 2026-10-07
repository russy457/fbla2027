/**
 * BellMenu.tsx
 * Header notifications bell (SPEC 8.3 Tier 2), replacing the Tier 1 badge
 * link. The bell is a disclosure button whose accessible name carries the
 * unread count ("Notifications, 3 unread"; 99+ cap) and which opens a
 * non-modal popover (role=dialog) with the latest alerts. Same live data as
 * /me/notifications (one shared listener per query).
 *
 * Focus and dismissal:
 *   open           focus moves to the alert list (or Mark all read when empty)
 *   Esc            closes and returns focus to the bell
 *   click outside  closes; focus stays where the click put it
 *   Tab out        closes once focus leaves the bell and the popover
 *   navigation     opening an alert or "See all" closes the menu, and the
 *                  layout moves focus to the new screen's heading
 *
 * Position: under 640 px the popover spans the header (the bell is not at the
 * right edge on a phone); from sm up it hangs under the bell.
 */
import { useCallback, useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent, type ReactElement } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bell } from "@phosphor-icons/react";
import { unreadBadgeText, type UserError } from "@fbla/shared";
import { useNotifications, useUnreadNotifications } from "@/hooks/useInbox";
import { api, toApiUserError } from "@/lib/api";
import type { NotificationItem } from "@/lib/data/inbox";
import { cn } from "@/lib/cn";
import { BellMenuPanel } from "./BellMenuPanel";

export const bellLabel = (count: number): string => (count === 0 ? "Notifications" : `Notifications, ${unreadBadgeText(count)} unread`);

export const BellMenu = ({ uid }: { uid: string }): ReactElement => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMarking, setIsMarking] = useState(false);
  const [error, setError] = useState<UserError | null>(null);
  const unread = useUnreadNotifications(uid);
  const latest = useNotifications(isOpen ? uid : null);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const titleId = `${panelId}-title`;
  const count = unread.data?.length ?? 0;
  const text = unreadBadgeText(count);

  const close = useCallback((restoreFocus: boolean) => {
    setIsOpen(false);
    setError(null);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  // Close on any route change (an alert or "See all" navigated).
  useEffect(() => close(false), [pathname, close]);

  // A pointer press outside the bell and popover closes the menu.
  useEffect(() => {
    if (!isOpen) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !wrapperRef.current?.contains(event.target)) close(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen, close]);

  // On open, move focus into the popover: the alert list when it has rows, else the first control.
  useEffect(() => {
    if (!isOpen || latest.isLoading) return;
    const panel = panelRef.current;
    const target = panel?.querySelector<HTMLElement>('[role="listbox"]') ?? panel?.querySelector<HTMLElement>("button:not([disabled]), a[href]");
    target?.focus();
  }, [isOpen, latest.isLoading]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      // Keep a parent dialog (if any) from also closing.
      event.stopPropagation();
      close(true);
    }
  };

  const handleBlur = (event: FocusEvent<HTMLDivElement>): void => {
    const next = event.relatedTarget;
    if (isOpen && next instanceof Node && !wrapperRef.current?.contains(next)) close(false);
  };

  const markAll = async (): Promise<void> => {
    setIsMarking(true);
    setError(null);
    try {
      await api.volunteer.markNotificationsRead({ all: true });
    } catch (markError) {
      setError(toApiUserError(markError));
    } finally {
      setIsMarking(false);
    }
  };

  const openItem = (item: NotificationItem): void => {
    // Opening does not wait on the read flag; a failure only leaves the item unread.
    if (!item.read) void api.volunteer.markNotificationsRead({ itemIds: [item.id] }).catch(() => undefined);
    close(false);
    navigate(item.link);
  };

  return (
    <div ref={wrapperRef} onKeyDown={handleKeyDown} onBlur={handleBlur} className="sm:relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={bellLabel(count)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        onClick={() => (isOpen ? close(true) : setIsOpen(true))}
        className={cn(
          "relative inline-flex min-h-touch min-w-touch items-center justify-center rounded-md transition-colors duration-(--duration-fast)",
          isOpen || pathname === "/me/notifications" ? "bg-accent-subtle text-accent" : "text-fg-muted hover:bg-surface-sunken hover:text-fg"
        )}
      >
        <Bell aria-hidden="true" size={20} weight={count > 0 ? "fill" : "regular"} />
        {count > 0 ? (
          <span
            aria-hidden="true"
            data-testid="unread-badge"
            className="absolute top-1 right-0.5 min-w-5 rounded-full bg-accent px-1 text-center text-xs leading-5 font-semibold text-accent-fg"
          >
            {text}
          </span>
        ) : null}
      </button>
      {isOpen ? (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-labelledby={titleId}
          className="absolute inset-x-4 top-full z-(--z-overlay) mt-2 flex flex-col rounded-lg border border-border bg-surface shadow-lg transition-[opacity,transform] duration-(--duration-fast) ease-out starting:-translate-y-1 starting:opacity-0 sm:inset-x-auto sm:right-0 sm:w-96"
        >
          <BellMenuPanel
            titleId={titleId}
            items={latest.data ?? []}
            unreadCount={count}
            isLoading={latest.isLoading}
            hasLoadError={latest.error !== null}
            isMarking={isMarking}
            error={error}
            onMarkAll={() => void markAll()}
            onOpenItem={openItem}
            onSeeAll={() => close(false)}
          />
        </div>
      ) : null}
    </div>
  );
};

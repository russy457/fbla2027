/**
 * inboxView.test.ts
 * Day grouping for the notifications list, the promotion banner selection
 * (D13), and client-side reminders (SPEC 3.15).
 */
import { describe, expect, it } from "vitest";
import { activePromotions, groupNotificationsByDay, upcomingReminders, type InboxItemLike, type SignupLike } from "./inboxView";

const ts = (ms: number) => ({ toMillis: () => ms });
const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 9, 17, 18, 0, 0); // Sat 1 PM in Chicago

const item = (id: string, createdMs: number, overrides: Partial<InboxItemLike> = {}): InboxItemLike => ({
  id,
  type: "waitlist-promoted",
  read: false,
  createdAt: ts(createdMs),
  data: { signupId: `s-${id}` },
  ...overrides
});
const signup = (id: string, startMs: number, status: SignupLike["status"] = "confirmed"): SignupLike => ({ id, status, instanceStart: ts(startMs) });

describe("groupNotificationsByDay", () => {
  it("groups newest first with Today, Yesterday, and dated labels", () => {
    const groups = groupNotificationsByDay([item("old", NOW - 72 * HOUR), item("a", NOW - HOUR), item("y", NOW - 24 * HOUR), item("b", NOW)], NOW, "America/Chicago");
    expect(groups.map((group) => group.label)).toEqual(["Today", "Yesterday", "Wednesday, Oct 14"]);
    expect(groups[0]?.items.map((entry) => entry.id)).toEqual(["b", "a"]);
  });

  it("returns nothing for no items", () => {
    expect(groupNotificationsByDay([], NOW, "America/Chicago")).toEqual([]);
  });
});

describe("activePromotions", () => {
  it("keeps unread promotions for confirmed, future signups, soonest first", () => {
    const notifications = [
      item("late", NOW, { data: { signupId: "s-late" } }),
      item("soon", NOW, { data: { signupId: "s-soon" } }),
      item("read", NOW, { read: true }),
      item("other", NOW, { type: "waitlist-closed" }),
      item("gone", NOW, { data: { signupId: "s-gone" } }),
      item("released", NOW, { data: { signupId: "s-released" } }),
      item("started", NOW, { data: { signupId: "s-started" } }),
      item("nodata", NOW, { data: {} })
    ];
    const signups = [
      signup("s-late", NOW + 48 * HOUR),
      signup("s-soon", NOW + 5 * HOUR),
      signup("s-read", NOW + 5 * HOUR),
      signup("s-other", NOW + 5 * HOUR),
      signup("s-released", NOW + 5 * HOUR, "cancelled"),
      signup("s-started", NOW - HOUR)
    ];
    expect(activePromotions(notifications, signups, NOW).map((entry) => entry.notification.id)).toEqual(["soon", "late"]);
  });
});

describe("upcomingReminders", () => {
  it("lists confirmed signups starting within 24 h, minus excluded ones", () => {
    const list = [signup("a", NOW + 23 * HOUR), signup("b", NOW + 25 * HOUR), signup("c", NOW + HOUR), signup("d", NOW + HOUR, "waitlisted"), signup("e", NOW - HOUR), signup("f", NOW + 2 * HOUR)];
    expect(upcomingReminders(list, NOW, new Set(["f"])).map((entry) => entry.id)).toEqual(["c", "a"]);
    expect(upcomingReminders(list, NOW)).toHaveLength(3);
  });
});

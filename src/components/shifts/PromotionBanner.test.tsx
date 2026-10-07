/**
 * PromotionBanner.test.tsx
 * D13 / SPEC 9.11: a waitlist promotion shows "You're in!" with Confirm
 * (marks the alert read) and Can't make it (cancelSignup with release, then
 * mark read); pending until the Function returns; reminders for confirmed
 * shifts within 24 h. Also the header badge's 99+ cap and accessible name.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationBadge } from "@/components/notifications/NotificationBadge";
import { MINUTE, SHIFT_START_MS, makeInstance, makeSignup, ts } from "@/test/fixtures";
import { PromotionBanner } from "./PromotionBanner";

const markNotificationsRead = vi.fn();
const cancelSignup = vi.fn();
let unread: unknown[] = [];

vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...original,
    api: {
      volunteer: {
        markNotificationsRead: (input: unknown) => markNotificationsRead(input),
        cancelSignup: (input: unknown) => cancelSignup(input)
      }
    }
  };
});
vi.mock("@/hooks/useInbox", () => ({ useUnreadNotifications: () => ({ data: unread, error: null, isLoading: false }) }));
vi.mock("@/hooks/useShiftData", () => ({ useInstance: () => ({ data: makeInstance(), error: null, isLoading: false }) }));

const promotion = {
  id: "waitlist-promoted_shift-1_uid-1",
  type: "waitlist-promoted",
  title: "You're in! Saturday 9 AM",
  body: "A spot opened on Sort and pack food boxes.",
  link: "/opportunity/shift-1",
  data: { instanceId: "shift-1", signupId: "shift-1_uid-1" },
  read: false,
  createdAt: ts(0),
  updatedAt: ts(0)
};

const NOW = SHIFT_START_MS - 5 * 60 * MINUTE;

const renderBanner = (signups = [makeSignup({ promotedAt: ts(NOW) })]) =>
  render(
    <MemoryRouter>
      <PromotionBanner uid="uid-1" signups={signups} nowMs={NOW} />
    </MemoryRouter>
  );

describe("PromotionBanner", () => {
  beforeEach(() => {
    unread = [promotion];
    markNotificationsRead.mockReset().mockResolvedValue({ updated: 1 });
    cancelSignup.mockReset().mockResolvedValue({ status: "cancelled", lateCancel: false, promotedSignupId: null });
  });

  it("shows You're in with Confirm and Can't make it", () => {
    renderBanner();
    expect(screen.getByText("You're in! Saturday 9 AM")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Updates about your shifts" })).toHaveAttribute("aria-live", "polite");
  });

  it("Confirm marks the alert read and shows pending meanwhile", async () => {
    let resolve: (value: unknown) => void = () => undefined;
    markNotificationsRead.mockReturnValue(new Promise((done) => (resolve = done)));
    renderBanner();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(screen.getByRole("button", { name: "Confirming..." })).toBeDisabled();
    resolve({ updated: 1 });
    await waitFor(() => expect(markNotificationsRead).toHaveBeenCalledWith({ itemIds: [promotion.id] }));
    expect(cancelSignup).not.toHaveBeenCalled();
  });

  it("Can't make it releases the seat, then marks the alert read", async () => {
    renderBanner();
    fireEvent.click(screen.getByRole("button", { name: "Can't make it" }));
    await waitFor(() => expect(markNotificationsRead).toHaveBeenCalled());
    expect(cancelSignup).toHaveBeenCalledWith({ signupId: "shift-1_uid-1", release: true });
  });

  it("hides a promotion whose signup is no longer confirmed, but still shows a reminder", () => {
    renderBanner([makeSignup({ status: "cancelled" }), makeSignup({ id: "other", instanceId: "shift-2" })]);
    expect(screen.queryByText("You're in! Saturday 9 AM")).toBeNull();
    expect(screen.getByRole("list", { name: "Reminders" })).toBeInTheDocument();
  });
});

describe("NotificationBadge", () => {
  it("names the unread count and caps it at 99+", () => {
    unread = Array.from({ length: 100 }, (_, index) => ({ ...promotion, id: `n${index}` }));
    render(
      <MemoryRouter>
        <NotificationBadge uid="uid-1" />
      </MemoryRouter>
    );
    expect(screen.getByRole("link", { name: "Notifications, 99+ unread" })).toHaveAttribute("href", "/me/notifications");
    expect(screen.getByTestId("unread-badge")).toHaveTextContent("99+");
  });

  it("shows no count when everything is read", () => {
    unread = [];
    render(
      <MemoryRouter>
        <NotificationBadge uid="uid-1" />
      </MemoryRouter>
    );
    expect(screen.getByRole("link", { name: "Notifications" })).toBeInTheDocument();
    expect(screen.queryByTestId("unread-badge")).toBeNull();
  });
});

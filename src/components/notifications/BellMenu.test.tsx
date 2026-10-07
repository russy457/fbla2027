/**
 * BellMenu.test.tsx
 * The header notifications bell (SPEC 8.3 Tier 2): the unread count in the
 * accessible name (99+ cap), the popover with the latest 10 alerts in an
 * AnimatedList, Mark all read, opening an alert (marks it read and
 * navigates), Esc and focus return, and rows that render without the
 * scale-in under reduced motion.
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ts } from "@/test/fixtures";
import { usePreferencesStore } from "@/store/preferencesStore";
import { BellMenu, bellLabel } from "./BellMenu";

const markNotificationsRead = vi.fn();
let unread: unknown[] = [];
let latest: unknown[] = [];

vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return { ...original, api: { volunteer: { markNotificationsRead: (input: unknown) => markNotificationsRead(input) } } };
});
vi.mock("@/hooks/useInbox", () => ({
  useUnreadNotifications: () => ({ data: unread, error: null, isLoading: false }),
  useNotifications: (uid: string | null) => ({ data: uid === null ? undefined : latest, error: null, isLoading: false })
}));

const alert = (index: number, read = false) => ({
  id: `alert-${index}`,
  type: "shift-changed",
  title: `Shift ${index} moved`,
  body: `Body ${index}`,
  link: `/opportunity/shift-${index}`,
  data: { instanceId: `shift-${index}` },
  read,
  createdAt: ts(index),
  updatedAt: ts(index)
});

/** motion's useInView needs IntersectionObserver, which jsdom lacks. */
class StubIntersectionObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): [] {
    return [];
  }
}

const LocationProbe = () => <p data-testid="location">{useLocation().pathname}</p>;

const renderBell = () =>
  render(
    <MemoryRouter initialEntries={["/explore"]}>
      <button type="button">Elsewhere</button>
      <BellMenu uid="uid-1" />
      <Routes>
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  );

const openMenu = () => {
  fireEvent.click(screen.getByRole("button", { name: /^Notifications/ }));
  return screen.getByRole("dialog", { name: "Notifications" });
};

describe("BellMenu", () => {
  beforeAll(() => {
    vi.stubGlobal("IntersectionObserver", StubIntersectionObserver);
    // jsdom has no element scrolling; AnimatedList scrolls the highlighted row into view.
    if (typeof HTMLElement.prototype.scrollTo !== "function") HTMLElement.prototype.scrollTo = () => undefined;
  });
  afterAll(() => vi.unstubAllGlobals());
  beforeEach(() => {
    unread = [alert(1), alert(2)];
    latest = [alert(1), alert(2), alert(3, true)];
    markNotificationsRead.mockReset().mockResolvedValue({ updated: 1 });
    usePreferencesStore.setState({ motion: "system" });
  });

  it("names the unread count, capped at 99+", () => {
    expect(bellLabel(0)).toBe("Notifications");
    expect(bellLabel(3)).toBe("Notifications, 3 unread");
    unread = Array.from({ length: 100 }, (_, index) => alert(index));
    renderBell();
    const bell = screen.getByRole("button", { name: "Notifications, 99+ unread" });
    expect(bell).toHaveAttribute("aria-expanded", "false");
    expect(bell).toHaveAttribute("aria-haspopup", "dialog");
    expect(screen.getByTestId("unread-badge")).toHaveTextContent("99+");
  });

  it("shows no count when everything is read", () => {
    unread = [];
    renderBell();
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
    expect(screen.queryByTestId("unread-badge")).toBeNull();
  });

  it("opens the latest alerts in a focused list with New labels in text", async () => {
    latest = Array.from({ length: 14 }, (_, index) => alert(index, index > 0));
    renderBell();
    const dialog = openMenu();
    expect(screen.getByRole("button", { name: /^Notifications/ })).toHaveAttribute("aria-expanded", "true");
    const list = within(dialog).getByRole("listbox", { name: "Latest alerts" });
    await waitFor(() => expect(list).toHaveFocus());
    expect(within(list).getAllByRole("option")).toHaveLength(10);
    expect(within(list).getAllByText("New")).toHaveLength(1);
    expect(within(dialog).getByText("2 unread")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "See all notifications" })).toHaveAttribute("href", "/me/notifications");
  });

  it("marks everything read", async () => {
    renderBell();
    const dialog = openMenu();
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark all read" }));
    await waitFor(() => expect(markNotificationsRead).toHaveBeenCalledWith({ all: true }));
  });

  it("disables Mark all read when nothing is unread and says All caught up", () => {
    unread = [];
    renderBell();
    const dialog = openMenu();
    expect(within(dialog).getByRole("button", { name: "Mark all read" })).toBeDisabled();
    expect(within(dialog).getByText("All caught up.")).toBeInTheDocument();
  });

  it("opens an alert with the keyboard: marks it read, navigates, and closes", async () => {
    renderBell();
    const dialog = openMenu();
    const list = within(dialog).getByRole("listbox");
    act(() => {
      fireEvent.keyDown(list, { key: "ArrowDown" });
    });
    act(() => {
      fireEvent.keyDown(list, { key: "Enter" });
    });
    expect(markNotificationsRead).toHaveBeenCalledWith({ itemIds: ["alert-1"] });
    expect(screen.getByTestId("location")).toHaveTextContent("/opportunity/shift-1");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on Escape and returns focus to the bell", () => {
    renderBell();
    const dialog = openMenu();
    act(() => {
      fireEvent.keyDown(within(dialog).getByRole("listbox"), { key: "Escape" });
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: /^Notifications/ })).toHaveFocus();
  });

  it("closes when focus moves outside the menu", () => {
    renderBell();
    const dialog = openMenu();
    const outside = screen.getByRole("button", { name: "Elsewhere" });
    act(() => {
      fireEvent.blur(within(dialog).getByRole("listbox"), { relatedTarget: outside });
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("says there are no alerts yet when the inbox is empty", () => {
    unread = [];
    latest = [];
    renderBell();
    const dialog = openMenu();
    expect(within(dialog).getByText("No alerts yet. Alerts appear here, in the app only.")).toBeInTheDocument();
  });

  it("renders rows fully visible (no scale-in) under reduced motion", () => {
    usePreferencesStore.setState({ motion: "reduced" });
    renderBell();
    const dialog = openMenu();
    for (const option of within(dialog).getAllByRole("option")) {
      expect(option.style.opacity).not.toBe("0");
      expect(option.style.transform).not.toContain("scale(0.7)");
    }
  });
});

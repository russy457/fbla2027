/**
 * CommandPalette.test.tsx
 * The command palette end to end in jsdom: Ctrl/Cmd+K and the header button
 * open it, the combobox/listbox keyboard model (Up/Down wrap, Home/End,
 * Enter navigates), Esc closes and restores focus, Tab stays inside, search
 * covers pages, help articles (BM25), organizations, and an Explore search,
 * and a kiosk session gets no palette at all.
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFixtureLibrary } from "@/lib/help/testFixtures";
import { useAuthStore } from "@/store/authStore";
import { CommandPaletteLauncher } from "./CommandPaletteLauncher";

vi.mock("@/hooks/useMemberships", () => ({
  useMyMemberships: () => ({ data: [{ orgId: "common-table", orgName: "Common Table Pantry", role: "owner" }] })
}));
vi.mock("@/lib/data/orgs", () => ({
  getOrganizations: async () => [
    { id: "common-table", name: "Common Table Pantry", causeAreas: ["hunger-food-security"], archived: false },
    { id: "gone", name: "Closed Pantry Project", causeAreas: ["hunger-food-security"], archived: true }
  ]
}));

const library = createFixtureLibrary();

const LocationProbe = () => {
  const location = useLocation();
  return <p data-testid="location">{`${location.pathname}${location.search}`}</p>;
};

const renderLauncher = (path = "/me/shifts") =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <button type="button">Outside button</button>
        <CommandPaletteLauncher getLibrary={() => library} />
        <Routes>
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

const pressKey = (key: string, init: KeyboardEventInit = {}, target: Element | null = document.activeElement) =>
  act(() => {
    fireEvent.keyDown(target ?? document.body, { key, ...init });
  });

const combobox = () => screen.getByRole("combobox", { name: "Search pages, shifts, organizations, and help" });
const activeOption = () => {
  const id = combobox().getAttribute("aria-activedescendant");
  return id === null ? null : document.getElementById(id);
};

describe("CommandPaletteLauncher", () => {
  beforeEach(() => {
    useAuthStore.setState({ session: { status: "user", user: { uid: "uid-1", email: "v@example.test", isAdmin: false } } });
  });
  afterEach(() => {
    useAuthStore.setState({ session: { status: "loading" } });
  });

  it("opens with Ctrl+K, focuses the search field, and Esc restores focus", async () => {
    renderLauncher();
    const outside = screen.getByRole("button", { name: "Outside button" });
    outside.focus();
    pressKey("k", { ctrlKey: true });

    const dialog = screen.getByRole("dialog", { name: "Search and jump" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(combobox()).toHaveFocus();
    expect(screen.getByRole("button", { name: "Search" })).toHaveAttribute("aria-expanded", "true");

    pressKey("Escape");
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(outside).toHaveFocus());
  });

  it("also opens with Cmd+K and from the header button", () => {
    renderLauncher();
    pressKey("K", { metaKey: true }, document.body);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close search" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("moves through options with the arrow keys, wrapping, and Home/End", () => {
    renderLauncher();
    pressKey("k", { ctrlKey: true });
    const options = within(screen.getByRole("listbox", { name: "Results" })).getAllByRole("option");
    expect(options.length).toBeGreaterThan(3);
    expect(activeOption()).toBe(options[0]);
    expect(options[0]).toHaveAttribute("aria-selected", "true");

    pressKey("ArrowDown");
    expect(activeOption()).toBe(options[1]);
    expect(options[0]).toHaveAttribute("aria-selected", "false");
    pressKey("ArrowUp");
    pressKey("ArrowUp");
    expect(activeOption()).toBe(options.at(-1));
    pressKey("Home");
    expect(activeOption()).toBe(options[0]);
    pressKey("End");
    expect(activeOption()).toBe(options.at(-1));
    // Focus never left the text field (aria-activedescendant pattern).
    expect(combobox()).toHaveFocus();
  });

  it("lists role-based pages and this page's help when nothing is typed", () => {
    renderLauncher();
    pressKey("k", { ctrlKey: true });
    expect(screen.getByRole("group", { name: "Pages" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /My Shifts/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Common Table Pantry: Dashboard/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Admin console/ })).toBeNull();
    expect(screen.getByRole("group", { name: "Help for this page" })).toBeInTheDocument();
  });

  it("searches help articles and opens one with Enter", async () => {
    renderLauncher();
    pressKey("k", { ctrlKey: true });
    fireEvent.change(combobox(), { target: { value: "kiosk code" } });
    const help = screen.getByRole("group", { name: "Help articles" });
    const article = within(help).getByRole("option", { name: /Checking in with the kiosk code/ });
    while (activeOption() !== article) pressKey("ArrowDown");
    pressKey("Enter");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId("location")).toHaveTextContent("/help/kiosk-check-in");
  });

  it("finds organizations (not archived ones) and offers an Explore search", async () => {
    renderLauncher();
    pressKey("k", { ctrlKey: true });
    fireEvent.change(combobox(), { target: { value: "pantry" } });
    expect(await screen.findByRole("option", { name: /^Common Table Pantry\s?Hunger and food/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Closed Pantry Project/ })).toBeNull();
    // The coordinator's own org pages match by org name too; the count is announced.
    expect(screen.getByText(/^\d+ results\.$/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: /Search shifts for "pantry"/ }));
    expect(screen.getByTestId("location")).toHaveTextContent("/explore?q=pantry");
  });

  it("says so when nothing matches", () => {
    renderLauncher();
    pressKey("k", { ctrlKey: true });
    fireEvent.change(combobox(), { target: { value: "zzzz qqqq" } });
    // The Explore search is always offered for a typed query.
    expect(screen.getAllByRole("option")).toHaveLength(1);
  });

  it("keeps Tab inside the dialog", () => {
    renderLauncher();
    pressKey("k", { ctrlKey: true });
    const close = screen.getByRole("button", { name: "Close search" });
    close.focus();
    pressKey("Tab");
    expect(combobox()).toHaveFocus();
    pressKey("Tab", { shiftKey: true });
    expect(close).toHaveFocus();
  });

  it("does not open over another modal dialog", () => {
    renderLauncher();
    const other = document.createElement("div");
    other.setAttribute("role", "dialog");
    other.setAttribute("aria-modal", "true");
    document.body.appendChild(other);
    pressKey("k", { ctrlKey: true }, document.body);
    expect(screen.queryByRole("combobox")).toBeNull();
    other.remove();
  });

  it("is not available on a kiosk session", () => {
    useAuthStore.setState({ session: { status: "kiosk", uid: "kiosk-1", kiosk: { instanceId: "i1", orgId: "common-table", expMs: 0 } } });
    renderLauncher("/org/common-table/kiosk/i1");
    expect(screen.queryByRole("button", { name: "Search" })).toBeNull();
    pressKey("k", { ctrlKey: true }, document.body);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

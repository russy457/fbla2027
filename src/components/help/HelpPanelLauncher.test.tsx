/**
 * HelpPanelLauncher.test.tsx
 * Keyboard and focus behavior of the quick help slide-over: the "?"
 * shortcut (ignored while typing), Esc to close, focus trapping, focus
 * restore to the opener, route-based suggestions, and reading an article
 * inside the panel.
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { createFixtureLibrary } from "@/lib/help/testFixtures";
import { HelpPanelLauncher } from "./HelpPanelLauncher";

const library = createFixtureLibrary();

const renderLauncher = (path = "/me/shifts") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <input aria-label="Outside field" />
      <button type="button">Outside button</button>
      <HelpPanelLauncher library={library} />
    </MemoryRouter>
  );

const pressKey = (key: string, target: Element = document.body, init: KeyboardEventInit = {}) =>
  act(() => {
    fireEvent.keyDown(target, { key, ...init });
  });

describe("HelpPanelLauncher", () => {
  it("opens from the button, focuses search, and restores focus on Escape", async () => {
    renderLauncher();
    const opener = screen.getByRole("button", { name: /Quick help/ });
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole("dialog", { name: "Quick help" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByLabelText("Search help")).toHaveFocus();
    expect(opener).toHaveAttribute("aria-expanded", "true");

    pressKey("Escape", document.activeElement!);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("opens with the ? key and returns focus to where the user was", async () => {
    renderLauncher();
    const outside = screen.getByRole("button", { name: "Outside button" });
    outside.focus();
    pressKey("?", outside);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close help" }));
    await waitFor(() => expect(outside).toHaveFocus());
  });

  it("ignores ? while typing in a text field or with a modifier", () => {
    renderLauncher();
    pressKey("?", screen.getByLabelText("Outside field"));
    pressKey("?", document.body, { ctrlKey: true });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("traps Tab focus inside the panel", () => {
    renderLauncher();
    pressKey("?");
    const dialog = screen.getByRole("dialog");
    const closeButton = within(dialog).getByRole("button", { name: "Close help" });
    const askButton = within(dialog).getByRole("button", { name: "Ask" });

    // Shift+Tab from the first control wraps to the last one, and Tab wraps back.
    closeButton.focus();
    pressKey("Tab", closeButton, { shiftKey: true });
    const focusables = dialog.querySelectorAll<HTMLElement>("button, input, textarea, a[href]");
    const last = focusables[focusables.length - 1]!;
    expect(last).toHaveFocus();
    pressKey("Tab", last);
    expect(closeButton).toHaveFocus();
    expect(askButton).toBeInTheDocument();
  });

  it("closes when the backdrop is clicked", () => {
    renderLauncher();
    pressKey("?");
    const backdrop = document.querySelector("[aria-hidden='true'].absolute")!;
    fireEvent.click(backdrop);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("suggests articles for the current route and opens one in place", async () => {
    renderLauncher("/me/shifts");
    pressKey("?");
    const suggestions = screen.getByRole("list", { name: "Suggested articles" });
    const first = within(suggestions).getAllByRole("button")[0]!;
    expect(first).toHaveTextContent("Checking in with the kiosk code");

    fireEvent.click(first);
    expect(screen.getByRole("heading", { level: 3, name: "Checking in with the kiosk code" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toHaveFocus();
    expect(screen.getByRole("link", { name: /Open in Help Center/ })).toHaveAttribute("href", "/help/kiosk-check-in");

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => expect(screen.getByLabelText("Search help")).toHaveFocus());
  });

  it("searches inside the panel and shows the empty state", () => {
    renderLauncher();
    pressKey("?");
    fireEvent.change(screen.getByLabelText("Search help"), { target: { value: "tablet" } });
    const results = screen.getByRole("list", { name: "Search results" });
    expect(within(results).getAllByRole("button")[0]).toHaveTextContent("Starting kiosk mode");

    fireEvent.change(screen.getByLabelText("Search help"), { target: { value: "qqqq" } });
    expect(screen.getByText("No articles match.", { selector: "p.font-semibold" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse all topics" })).toHaveAttribute("href", "/help");
  });
});

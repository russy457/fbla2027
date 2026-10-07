/**
 * CookieConsent.test.tsx
 * The storage notice (SPEC 1.2 Tier 2 cookie consent): shown until
 * dismissed, says only essential storage is used and that the map loads
 * Mapbox on demand, links to the privacy policy, records "essential only"
 * (no optional consent), stays dismissed after a reload, and survives
 * storage that throws.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CONSENT_STORAGE_KEY, hasOptionalConsent } from "@/lib/consent";
import { CookieConsent } from "./CookieConsent";

const renderNotice = () =>
  render(
    <MemoryRouter>
      <main id="main" tabIndex={-1}>
        <CookieConsent />
      </main>
    </MemoryRouter>
  );

describe("CookieConsent", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("explains essential-only storage in a labelled region", () => {
    renderNotice();
    const region = screen.getByRole("region", { name: "Essential storage only" });
    expect(region).toHaveTextContent("No analytics or advertising cookies");
    expect(region).toHaveTextContent("loads Mapbox only when you open it");
    expect(screen.getByRole("link", { name: "Privacy policy" })).toHaveAttribute("href", "/privacy");
  });

  it("remembers the dismissal without granting optional storage, and moves focus to main", async () => {
    const { unmount } = renderNotice();
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByRole("region", { name: "Essential storage only" })).toBeNull();
    expect(window.localStorage.getItem(CONSENT_STORAGE_KEY)).toBe("denied");
    expect(hasOptionalConsent()).toBe(false);
    await waitFor(() => expect(document.getElementById("main")).toHaveFocus());
    unmount();

    renderNotice();
    expect(screen.queryByRole("region", { name: "Essential storage only" })).toBeNull();
  });

  it("still shows and dismisses when storage is blocked", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    renderNotice();
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByRole("region", { name: "Essential storage only" })).toBeNull();
    getItem.mockRestore();
    setItem.mockRestore();
  });
});

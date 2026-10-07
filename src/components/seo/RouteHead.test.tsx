/**
 * RouteHead.test.tsx
 * The head manager in the router: route defaults on navigation, a screen's
 * own override (title, description, JSON-LD) while it is mounted and gone
 * after it unmounts, help articles titled from the article, and long
 * descriptions trimmed on a word.
 */
import { act, render } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { clampDescription, DESCRIPTION_MAX, usePageHead } from "./pageHead";
import { RouteHead } from "./RouteHead";

let goTo: (path: string) => void = () => undefined;
const NavigateHandle = () => {
  goTo = useNavigate();
  return null;
};

const OrgScreen = () => {
  usePageHead({ title: "Common Table Pantry", description: "Feeding families.", jsonLd: { "@type": "Organization", name: "Common Table" } });
  return <h1>Org</h1>;
};

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <RouteHead />
      <NavigateHandle />
      <Routes>
        <Route path="/organizations/:orgId" element={<OrgScreen />} />
        <Route path="*" element={<p>Other</p>} />
      </Routes>
    </MemoryRouter>
  );

const description = (): string | null => document.head.querySelector('meta[name="description"]')?.getAttribute("content") ?? null;
const canonical = (): string | null => document.head.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null;
const jsonLd = (): Element | null => document.head.querySelector('script[type="application/ld+json"]');

describe("RouteHead", () => {
  afterEach(() => {
    document.head.innerHTML = "";
  });

  it("applies route defaults with an absolute canonical URL", () => {
    renderAt("/help");
    expect(document.title).toBe("Help Center | fbla 2027");
    expect(description()).toMatch(/^Answers about signing up/);
    expect(canonical()).toBe(`${window.location.origin}/help`);
  });

  it("uses a screen's override while mounted and drops it after navigating away", () => {
    renderAt("/organizations/common-table");
    expect(document.title).toBe("Common Table Pantry | fbla 2027");
    expect(description()).toBe("Feeding families.");
    expect(JSON.parse(jsonLd()?.textContent ?? "{}")).toMatchObject({ "@type": "Organization" });

    act(() => goTo("/me/shifts"));
    expect(document.title).toBe("My Shifts | fbla 2027");
    expect(jsonLd()).toBeNull();
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex");
  });

  it("titles a help article from the bundled article", () => {
    renderAt("/help/kiosk-check-in");
    expect(document.title).toMatch(/\| fbla 2027$/);
    expect(document.title).not.toBe("Help | fbla 2027");
  });

  it("gives the separate Explore page its own canonical URL", () => {
    renderAt("/explore");
    expect(canonical()).toBe(`${window.location.origin}/explore`);
  });
});

describe("clampDescription", () => {
  it("keeps short text and trims long text on a word with an ellipsis", () => {
    expect(clampDescription("  Feeding   families. ")).toBe("Feeding families.");
    const long = `${"word ".repeat(60)}end`;
    const clamped = clampDescription(long);
    expect(clamped.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    expect(clamped.endsWith("…")).toBe(true);
    expect(clampDescription("x".repeat(200))).toHaveLength(DESCRIPTION_MAX);
  });
});

/**
 * legalPages.test.tsx
 * Privacy, Terms, and Accessibility pages (SPEC 9.1, 1.3, 4.2, 9.16): each
 * renders a focusable h1, a "Last updated" line, and a table of contents;
 * Privacy documents the 13+ rule and manual retention; the footer LegalLinks
 * point at the three routes.
 */
import { render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LegalLinks } from "@/layouts/LegalLinks";
import { LEGAL_CONTACT_PLACEHOLDER } from "@/lib/legal";
import AccessibilityPage from "./AccessibilityPage";
import PrivacyPage from "./PrivacyPage";
import TermsPage from "./TermsPage";

const renderInRouter = (element: ReactElement) => render(<MemoryRouter>{element}</MemoryRouter>);

describe("legal pages", () => {
  it.each([
    ["Privacy policy", PrivacyPage],
    ["Terms of use", TermsPage],
    ["Accessibility statement", AccessibilityPage]
  ])("%s renders a focusable h1, last updated date, and table of contents", (title, Page) => {
    renderInRouter(<Page />);
    const heading = screen.getByRole("heading", { level: 1, name: title });
    expect(heading).toHaveAttribute("tabindex", "-1");
    expect(screen.getByText(/^Last updated/)).toHaveTextContent("October 6, 2026");
    const toc = screen.getByRole("navigation", { name: "On this page" });
    const firstLink = within(toc).getAllByRole("link")[0];
    const targetId = firstLink?.getAttribute("href")?.slice(1) ?? "";
    expect(document.getElementById(targetId)).not.toBeNull();
  });

  it("Privacy explains the 13+ rule and teen protections", () => {
    renderInRouter(<PrivacyPage />);
    const section = screen.getByRole("region", { name: "Minors and age requirements" });
    expect(section).toHaveTextContent("You must be 13 or older");
    expect(section).toHaveTextContent("sign-up is refused and no account is created");
    expect(section).toHaveTextContent("we delete it");
    expect(section).toHaveTextContent("cannot sign up for shifts at unverified organizations");
  });

  it("Privacy documents manual retention and how to request deletion", () => {
    renderInRouter(<PrivacyPage />);
    const retention = screen.getByRole("region", { name: "How long we keep data" });
    expect(retention).toHaveTextContent("handled by hand, on request");
    expect(retention).toHaveTextContent("letters stay verifiable");
    expect(retention).toHaveTextContent("revoked");
    const request = screen.getByRole("region", { name: "Deleting or exporting your data" });
    expect(request).toHaveTextContent(LEGAL_CONTACT_PLACEHOLDER);
  });

  it("Terms say fraud leads to letter revocation", () => {
    renderInRouter(<TermsPage />);
    expect(screen.getByRole("region", { name: "Accurate hours" })).toHaveTextContent("revoked");
  });

  it("Accessibility states the WCAG 2.2 AA target and the typed code alternative", () => {
    renderInRouter(<AccessibilityPage />);
    expect(screen.getByRole("region", { name: "Our target" })).toHaveTextContent("WCAG) 2.2 at level AA");
    expect(screen.getByRole("region", { name: "Known limitations" })).toHaveTextContent("type the short check-in code");
  });

  it("copy contains no em or en dashes", () => {
    const { container } = renderInRouter(
      <>
        <PrivacyPage />
        <TermsPage />
        <AccessibilityPage />
      </>
    );
    expect(container.textContent).not.toMatch(/[–—]/);
  });
});

describe("LegalLinks", () => {
  it("renders the three legal links with correct hrefs", () => {
    renderInRouter(<LegalLinks />);
    const nav = screen.getByRole("navigation", { name: "Legal" });
    expect(within(nav).getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    expect(within(nav).getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    expect(within(nav).getByRole("link", { name: "Accessibility" })).toHaveAttribute("href", "/accessibility");
  });
});

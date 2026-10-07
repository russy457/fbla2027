/**
 * AccessibilityPage.tsx
 * Route "/accessibility" (SPEC 9.1, 9.16). Accessibility statement: the WCAG
 * 2.2 AA target, built-in features, known limitations, how we test, and how
 * to report a barrier.
 */
import type { ReactElement } from "react";
import { LegalDocument, type LegalSection } from "@/components/legal/LegalDocument";
import { APP_NAME } from "@/lib/brand";
import { LEGAL_CONTACT_PLACEHOLDER } from "@/lib/legal";

const SECTIONS: ReadonlyArray<LegalSection> = [
  {
    id: "target",
    heading: "Our target",
    body: (
      <p>
        We aim for {APP_NAME} to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA. This is a
        student project, so we have not had a formal outside audit.
      </p>
    )
  },
  {
    id: "features",
    heading: "Accessibility features",
    body: (
      <ul>
        <li>Every screen works with a keyboard alone, including sign up, check-in code entry, and the kiosk.</li>
        <li>A "Skip to main content" link is the first thing you reach with the Tab key.</li>
        <li>After you move to a new screen, focus moves to that screen's main heading.</li>
        <li>Text size (100, 125, or 150 percent), high contrast, and reduced motion controls are in the page footer.</li>
        <li>The app also follows your device's reduced motion setting.</li>
        <li>Status is shown with an icon and words, never by color alone.</li>
        <li>Buttons and links are at least 44 by 44 pixels so they are easy to tap.</li>
        <li>Screen readers announce check-in results and kiosk code changes through live regions.</li>
      </ul>
    )
  },
  {
    id: "limitations",
    heading: "Known limitations",
    body: (
      <ul>
        <li>Scanning a QR code needs a camera. You can always type the short check-in code instead.</li>
        <li>We are still testing with more screen readers and devices, so some barriers may remain.</li>
      </ul>
    )
  },
  {
    id: "testing",
    heading: "How we test",
    body: (
      <ul>
        <li>Automated axe checks run in our Playwright tests on key screens.</li>
        <li>Keyboard-only end-to-end tests cover sign up, check-in, and the kiosk.</li>
        <li>Key screens are checked at 150 percent text with high contrast to make sure nothing overflows.</li>
      </ul>
    )
  },
  {
    id: "report",
    heading: "Report a barrier",
    body: (
      <p>
        If something in {APP_NAME} is hard or impossible to use, please tell {LEGAL_CONTACT_PLACEHOLDER}. Include the
        page, what you were trying to do, and the device or assistive technology you use. We will reply and work on
        a fix.
      </p>
    )
  }
];

const AccessibilityPage = (): ReactElement => (
  <LegalDocument
    title="Accessibility statement"
    intro={<p>How we make {APP_NAME} usable for everyone, and how to tell us when it is not.</p>}
    sections={SECTIONS}
  />
);

export default AccessibilityPage;

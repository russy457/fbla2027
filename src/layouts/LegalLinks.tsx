/**
 * LegalLinks.tsx
 * Footer navigation to the Privacy policy, Terms of use, and Accessibility
 * statement (SPEC 9.1). A labelled <nav> so screen reader users can find it
 * from the landmarks list.
 */
import type { ReactElement } from "react";
import { Link } from "react-router-dom";

export const LEGAL_LINKS: ReadonlyArray<{ to: string; label: string }> = [
  { to: "/privacy", label: "Privacy" },
  { to: "/terms", label: "Terms" },
  { to: "/accessibility", label: "Accessibility" }
];

export const LegalLinks = (): ReactElement => (
  <nav aria-label="Legal" className="site-footer__legal">
    <ul>
      {LEGAL_LINKS.map(({ to, label }) => (
        <li key={to}>
          <Link
            to={to}
            className="site-footer__link"
          >
            {label}
          </Link>
        </li>
      ))}
    </ul>
  </nav>
);

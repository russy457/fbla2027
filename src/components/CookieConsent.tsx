/**
 * CookieConsent.tsx
 * Storage notice (SPEC 1.2 Tier 2 "cookie consent"; ported from the old app's
 * banner per PORT_LEDGER, re-texted and restyled). The app keeps only
 * essential data in the browser and ships no analytics, so instead of an
 * Accept/Decline choice the notice says exactly what is stored and is
 * dismissed once with "Got it" (remembered on this device through
 * src/lib/consent.ts). The Mapbox map, the one third party that sets its
 * own storage, loads only when the visitor opens it, and the notice says so.
 *
 * Accessibility: a labelled region in normal page flow above <main> (not a
 * fixed overlay, so it never covers controls or the tab bar and never steals
 * focus). After dismissal, focus moves to <main> so keyboard users do not
 * land on <body>.
 */
import { useState, type ReactElement } from "react";
import { Link } from "react-router-dom";
import { Cookie } from "@phosphor-icons/react";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { APP_NAME } from "@/lib/brand";
import { getConsent, setConsent } from "@/lib/consent";

const HEADING_ID = "storage-notice-title";

export const CookieConsent = (): ReactElement | null => {
  const [isDismissed, setIsDismissed] = useState(() => getConsent() !== null);
  if (isDismissed) return null;

  const dismiss = (): void => {
    // Essential storage only: no optional storage was offered, so none is granted.
    setConsent("denied");
    setIsDismissed(true);
    requestAnimationFrame(() => document.getElementById("main")?.focus({ preventScroll: true }));
  };

  return (
    <section aria-labelledby={HEADING_ID} className="border-b border-border bg-surface-sunken">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Cookie aria-hidden="true" size={22} className="mt-0.5 shrink-0 text-fg-muted" />
          <div className="min-w-0">
            <h2 id={HEADING_ID} className="text-sm font-semibold text-fg">
              Essential storage only
            </h2>
            <p className="text-sm text-pretty text-fg-muted">
              {APP_NAME} keeps your sign-in and display settings in this browser. No analytics or advertising cookies. The
              optional map loads Mapbox only when you open it.{" "}
              <Link to="/privacy" className="font-semibold text-accent underline underline-offset-2 hover:text-accent-hover">
                Privacy policy
              </Link>
            </p>
          </div>
        </div>
        <button type="button" onClick={dismiss} className={buttonClassName("secondary", "shrink-0 self-start sm:self-center")}>
          Got it
        </button>
      </div>
    </section>
  );
};

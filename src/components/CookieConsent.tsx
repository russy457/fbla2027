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
import { buttonClassName } from "@/components/ui/buttonStyles";
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
      <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-2 sm:px-6">
        <h2 id={HEADING_ID} className="font-sans text-sm font-semibold text-fg">
          Essential storage only
        </h2>
        <button type="button" onClick={dismiss} className={buttonClassName("secondary", "col-start-2 row-start-1 shrink-0")}>
          Got it
        </button>
        <p className="col-span-2 text-sm text-pretty text-fg-muted sm:col-span-1 sm:row-start-2">
          We store sign-in and display settings. No analytics or ads. Mapbox loads only when you open the map.{" "}
          <Link to="/privacy" className="font-semibold text-accent underline underline-offset-2 hover:text-accent-hover">
            Privacy policy
          </Link>
        </p>
      </div>
    </section>
  );
};

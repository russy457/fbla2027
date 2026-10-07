/**
 * KioskPage.tsx
 * Route "/org/:orgId/kiosk/:instanceId". The check-in tablet. It renders
 * outside the app shell (no nav) because kiosk mode is locked to one shift
 * (D4, G15). Placeholder until Tier 0 builds the rotating code and live roster.
 */
import type { ReactElement } from "react";
import { ScreenPlaceholder } from "@/components/ScreenPlaceholder";

const KioskPage = (): ReactElement => (
  <main id="main" className="mx-auto flex min-h-dvh w-full max-w-5xl items-center px-6 py-10">
    <ScreenPlaceholder title="Check-in kiosk">
      This screen will show a rotating check-in code for volunteers to enter on their phones, next to a live list of
      arrivals.
    </ScreenPlaceholder>
  </main>
);

export default KioskPage;

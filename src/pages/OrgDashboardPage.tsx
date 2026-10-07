/**
 * OrgDashboardPage.tsx
 * Route "/org/:orgId/dashboard". Coordinator home for one organization:
 * today's shift with Start kiosk, a needs-attention queue, and upcoming shifts
 * (D1, D9). Placeholder until Tier 0.
 */
import type { ReactElement } from "react";
import { ScreenPlaceholder } from "@/components/ScreenPlaceholder";

const OrgDashboardPage = (): ReactElement => (
  <ScreenPlaceholder title="Coordinator dashboard">
    This screen will show today&apos;s shift with a Start kiosk button, hours waiting for your approval, and your
    upcoming shifts.
  </ScreenPlaceholder>
);

export default OrgDashboardPage;

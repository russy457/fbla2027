/**
 * AdminPage.tsx
 * Route "/admin" (SPEC#screen-inventory "Admin", Tier 0: jobs and clock).
 * Gated by the admin claim (RequireAdmin). Holds the demo controls: Advance
 * clock 15 min, Reset clock, Run due jobs, and Reset demo data (Tier 1
 * lane C). Tier 1 lane B adds the organization verification queue, the job
 * run history with "Run due jobs now" and the last run time, and
 * revoke-a-letter-by-code.
 */
import type { ReactElement } from "react";
import { DemoControls } from "@/components/org/DemoControls";
import { PageHeader } from "@/components/ui/PageHeader";
// Tier 1 lane B
import { JobRunsPanel } from "@/components/admin/JobRunsPanel";
import { RevokeLetterByCode } from "@/components/admin/RevokeLetterByCode";
import { VerificationQueue } from "@/components/admin/VerificationQueue";
// End Tier 1 lane B
import { isDemoMode } from "@/lib/demoMode";
// Tier 1 lane C
import { ResetDemoDataControl } from "@/components/admin/ResetDemoDataControl";
// Tier 2 lane B
import { AdminCollectionsPanel } from "@/components/admin/AdminCollectionsPanel";

const AdminPage = (): ReactElement => (
  <div className="flex flex-col gap-8">
    <PageHeader title="Admin">Keep the system honest: run background jobs and, in demo mode, move the demo clock.</PageHeader>
    {/* Tier 1 lane B */}
    <VerificationQueue />
    <JobRunsPanel />
    <RevokeLetterByCode />
    {/* End Tier 1 lane B */}
    {/* Tier 2 lane B */}
    <AdminCollectionsPanel />
    {isDemoMode() ? (
      <>
        <DemoControls />
        {/* Tier 1 lane C */}
        <ResetDemoDataControl />
      </>
    ) : (
      <p className="text-fg-muted">Demo controls are off in this environment. Background jobs run on their own every 5 minutes.</p>
    )}
  </div>
);

export default AdminPage;

/**
 * AdminPage.tsx
 * Route "/admin" (SPEC#screen-inventory "Admin", Tier 0: jobs and clock).
 * Gated by the admin claim (RequireAdmin). Holds the demo controls: Advance
 * clock 15 min, Reset clock, and Run due jobs. Organization verification and
 * the job run history arrive with Tier 1.
 */
import type { ReactElement } from "react";
import { DemoControls } from "@/components/org/DemoControls";
import { PageHeader } from "@/components/ui/PageHeader";
import { isDemoMode } from "@/lib/demoMode";

const AdminPage = (): ReactElement => (
  <div className="flex flex-col gap-8">
    <PageHeader title="Admin">Keep the system honest: run background jobs and, in demo mode, move the demo clock.</PageHeader>
    {isDemoMode() ? (
      <DemoControls />
    ) : (
      <p className="text-fg-muted">Demo controls are off in this environment. Background jobs run on their own every 5 minutes.</p>
    )}
  </div>
);

export default AdminPage;

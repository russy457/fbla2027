/**
 * OrgDashboardPage.tsx
 * Route "/org/:orgId/dashboard" (SPEC#screen-inventory "Coordinator
 * Dashboard", Tier 0: today and upcoming). The featured shift shows its
 * counts, Start kiosk, Finalize shift, and the live roster; upcoming shifts
 * follow; the labeled Demo controls box comes last, only in demo mode (D11, X12).
 * Guarded by RequireCoordinator, so the viewer is an owner or coordinator.
 */
import type { ReactElement } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { formatShiftTime } from "@fbla/shared";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { DemoControls } from "@/components/org/DemoControls";
import { FinalizeShiftButton } from "@/components/org/FinalizeShiftButton";
import { RosterTable } from "@/components/org/RosterTable";
import { StartKioskControl } from "@/components/org/StartKioskControl";
import { PageHeader } from "@/components/ui/PageHeader";
import { useMembership } from "@/hooks/useMemberships";
import { useNow } from "@/hooks/useNow";
import { useOrgInstances } from "@/hooks/useShiftData";
import { getOrganization } from "@/lib/data/orgs";
import type { Instance } from "@/lib/data/instances";
import { pickFeaturedShift } from "@/lib/orgShifts";
import { useSessionUser } from "@/store/authStore";

const DASHBOARD_TICK_MS = 15_000;

const FeaturedShift = ({ orgId, shift, nowMs, canViewContacts }: { orgId: string; shift: Instance; nowMs: number; canViewContacts: boolean }): ReactElement => {
  const hasStarted = nowMs >= shift.start.toMillis();
  return (
    <section aria-labelledby="featured-shift-title" className="flex flex-col gap-6 border-l-4 border-accent bg-surface py-5 pr-4 pl-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-accent">{hasStarted ? "Happening now" : "Next shift"}</p>
          <h2 id="featured-shift-title" className="text-2xl font-semibold text-fg">
            {shift.title}
          </h2>
          <p className="font-mono text-sm text-fg">{formatShiftTime(shift.start.toDate(), shift.timeZone)}</p>
          <p className="text-fg-muted">
            {shift.signupCount} of {shift.capacity} signed up, {shift.checkedInCount} checked in
          </p>
        </div>
        <div className="flex flex-col gap-3 lg:items-end">
          <StartKioskControl orgId={orgId} instanceId={shift.id} />
          <FinalizeShiftButton instanceId={shift.id} hasEnded={nowMs >= shift.end.toMillis()} isFinalized={shift.status === "finalized"} />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-fg-muted">Roster (updates live)</h3>
        <RosterTable orgId={orgId} instanceId={shift.id} timeZone={shift.timeZone} canViewContacts={canViewContacts} />
      </div>
    </section>
  );
};

const OrgDashboardPage = (): ReactElement => {
  const { orgId = "" } = useParams();
  const user = useSessionUser();
  const nowMs = useNow(DASHBOARD_TICK_MS);
  const org = useQuery({ queryKey: ["organization", orgId], queryFn: () => getOrganization(orgId), staleTime: 60_000 });
  const membership = useMembership(orgId, user?.uid ?? null);
  const shifts = useOrgInstances(orgId);

  if (shifts.error || org.isError) return <ErrorState title="We couldn't load this dashboard" description="Check your connection, then reload." />;
  if (shifts.isLoading || org.isPending) return <LoadingState label="Loading your dashboard" />;

  const { featured, upcoming } = pickFeaturedShift(shifts.data ?? [], nowMs);

  return (
    <div className="flex flex-col gap-10">
      <PageHeader title={org.data?.name ?? "Organization"}>Run today's shift: start the kiosk, watch arrivals, and finalize when it ends.</PageHeader>
      {featured ? (
        <FeaturedShift orgId={orgId} shift={featured} nowMs={nowMs} canViewContacts={membership.data?.canViewContacts === true} />
      ) : (
        <p className="text-fg-muted">No upcoming shifts right now.</p>
      )}
      {upcoming.length > 0 ? (
        <section aria-labelledby="upcoming-shifts-title">
          <h2 id="upcoming-shifts-title" className="border-b border-border-strong pb-2 text-sm font-semibold text-fg-muted">
            Upcoming shifts
          </h2>
          <ul className="divide-y divide-border">
            {upcoming.map((shift) => (
              <li key={shift.id} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-semibold text-fg">{shift.title}</span>
                <span className="text-sm text-fg-muted">
                  {formatShiftTime(shift.start.toDate(), shift.timeZone)}, {shift.signupCount} of {shift.capacity} signed up
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {/* Demo-only tools sit last so the real work (today's shift) stays on top. */}
      <DemoControls />
    </div>
  );
};

export default OrgDashboardPage;

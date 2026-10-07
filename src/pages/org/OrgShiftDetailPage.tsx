/**
 * OrgShiftDetailPage.tsx
 * Route "/org/:orgId/shifts/:instanceId" (SPEC 9.2 "Shift roster": watch
 * arrivals, fix attendance). Header with time (org zone), seats, check-ins,
 * and status; Start kiosk and Finalize; the live roster with attendance
 * changes (setAttendance); then edit shift, edit opportunity, and cancel.
 * The instance is live, so a cancel or finalize shows immediately.
 */
import type { ReactElement } from "react";
import { useParams } from "react-router-dom";
import { formatShiftTime } from "@fbla/shared";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { CancelShiftControl } from "@/components/org/CancelShiftControl";
import { FinalizeShiftButton } from "@/components/org/FinalizeShiftButton";
import { OrgPageShell } from "@/components/org/OrgPageShell";
import { ShiftAttendanceRoster } from "@/components/org/ShiftAttendanceRoster";
import { EditOpportunityPanel, EditShiftPanel } from "@/components/org/ShiftEditPanels";
import { StartKioskControl } from "@/components/org/StartKioskControl";
import { useMembership } from "@/hooks/useMemberships";
import { useNow } from "@/hooks/useNow";
import { useOpportunity } from "@/hooks/useOpportunity";
import { useInstance } from "@/hooks/useShiftData";
import { useSessionUser } from "@/store/authStore";

const OrgShiftDetailPage = (): ReactElement => {
  const { orgId = "", instanceId = "" } = useParams();
  const user = useSessionUser();
  const nowMs = useNow(15_000);
  const instance = useInstance(instanceId);
  const membership = useMembership(orgId, user?.uid ?? null);
  const opportunity = useOpportunity(instance.data?.opportunityId ?? null);

  if (instance.error) return <ErrorState title="We couldn't load this shift" description="Check your connection, then reload." />;
  if (instance.isLoading) return <LoadingState label="Loading the shift" />;
  const shift = instance.data;
  if (!shift || shift.orgId !== orgId) return <ErrorState title="Shift not found" description="It may have been removed. Go back to Shifts." />;
  const hasEnded = nowMs >= shift.end.toMillis();
  const isOpen = shift.status === "scheduled";
  const statusText = shift.status === "cancelled" ? "Cancelled" : shift.status === "finalized" ? "Finalized" : hasEnded ? "Ended" : "Scheduled";

  return (
    <OrgPageShell title={shift.title} intro={`${formatShiftTime(shift.start.toDate(), shift.timeZone)}. ${statusText}.`}>
      <section aria-label="Shift status" className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <p className="text-fg-muted">
          {shift.signupCount} of {shift.capacity} signed up, {shift.checkedInCount} checked in
          {shift.waitlist.length > 0 ? `, ${shift.waitlist.length} on the waitlist` : ""}
        </p>
        {shift.status !== "cancelled" ? (
          <div className="flex flex-col gap-3 lg:items-end">
            <StartKioskControl orgId={orgId} instanceId={shift.id} />
            <FinalizeShiftButton instanceId={shift.id} hasEnded={hasEnded} isFinalized={shift.status === "finalized"} />
          </div>
        ) : null}
      </section>
      <ShiftAttendanceRoster orgId={orgId} instance={shift} canViewContacts={membership.data?.canViewContacts === true} />
      {isOpen && !hasEnded ? <EditShiftPanel instance={shift} nowMs={nowMs} /> : null}
      {opportunity.data ? <EditOpportunityPanel opportunity={opportunity.data} /> : null}
      {!hasEnded ? <CancelShiftControl instanceId={shift.id} isCancelled={shift.status === "cancelled"} /> : null}
    </OrgPageShell>
  );
};

export default OrgShiftDetailPage;

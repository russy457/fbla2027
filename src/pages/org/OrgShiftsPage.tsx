/**
 * OrgShiftsPage.tsx
 * Route "/org/:orgId/shifts" (SPEC 9.2 "Shifts"): every shift of the
 * organization, upcoming first (soonest first) then past (newest first),
 * each with its time in the org zone, seats, status, and a link to the shift
 * page (roster, attendance, edit, cancel). Primary action: Create shift.
 */
import type { ReactElement } from "react";
import { Link, useParams } from "react-router-dom";
import { formatShiftTime } from "@fbla/shared";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { OrgPageShell } from "@/components/org/OrgPageShell";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { StatusBadge, type StatusTone } from "@/components/ui/StatusBadge";
import { useNow } from "@/hooks/useNow";
import { useOrgInstances } from "@/hooks/useShiftData";
import type { Instance } from "@/lib/data/instances";

const STATUS: Readonly<Record<Instance["status"], { tone: StatusTone; label: string }>> = {
  scheduled: { tone: "success", label: "Scheduled" },
  cancelled: { tone: "neutral", label: "Cancelled" },
  finalized: { tone: "neutral", label: "Finalized" }
};

const ShiftList = ({ title, shifts, orgId }: { title: string; shifts: readonly Instance[]; orgId: string }): ReactElement | null =>
  shifts.length === 0 ? null : (
    <section aria-label={title} className="flex flex-col gap-2">
      <h2 className="border-b border-border-strong pb-2 text-sm font-semibold text-fg-muted">{title}</h2>
      <ul className="divide-y divide-border">
        {shifts.map((shift) => (
          <li key={shift.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-0.5">
              <Link to={`/org/${orgId}/shifts/${shift.id}`} className="font-semibold text-accent underline underline-offset-2">
                {shift.title}
              </Link>
              <span className="font-mono text-sm text-fg-muted">{formatShiftTime(shift.start.toDate(), shift.timeZone)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">
              {shift.signupCount} of {shift.capacity} signed up
              {shift.waitlist.length > 0 ? `, ${shift.waitlist.length} waitlisted` : ""}
              <StatusBadge {...STATUS[shift.status]} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );

const OrgShiftsPage = (): ReactElement => {
  const { orgId = "" } = useParams();
  const nowMs = useNow(60_000);
  const shifts = useOrgInstances(orgId);
  const all = shifts.data ?? [];
  const upcoming = all.filter((shift) => shift.end.toMillis() > nowMs && shift.status === "scheduled");
  const past = all.filter((shift) => !upcoming.includes(shift)).reverse();

  return (
    <OrgPageShell title="Shifts" intro="Plan shifts, then open one to see its roster and fix attendance.">
      <Link to={`/org/${orgId}/shifts/new`} className={buttonClassName("primary", "w-fit")}>
        Create shift
      </Link>
      {shifts.error ? <ErrorState title="We couldn't load shifts" description="Check your connection, then reload." /> : null}
      {shifts.isLoading ? <LoadingState label="Loading shifts" lines={3} /> : null}
      {!shifts.isLoading && all.length === 0 ? <p className="text-fg-muted">No shifts yet. Create your first shift.</p> : null}
      <ShiftList title="Upcoming" shifts={upcoming} orgId={orgId} />
      <ShiftList title="Past and cancelled" shifts={past} orgId={orgId} />
    </OrgPageShell>
  );
};

export default OrgShiftsPage;

/**
 * MyShiftRow.tsx
 * One row in My Shifts' upcoming or past list: shift title, organization,
 * time in the org zone (D24), and the signup status as an icon + text badge
 * (D14). Reads its shift document live, so a cancellation by the
 * organization shows up without a reload. Tier 1: upcoming rows offer Add
 * to calendar (or Download cancellation once the org cancels), E2. Past
 * no-show rows offer Request review (T3).
 */
import type { ReactElement } from "react";
import { formatShiftTime } from "@fbla/shared";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useInstance } from "@/hooks/useShiftData";
import type { Signup } from "@/lib/data/signups";
import { SIGNUP_STATUS_LABELS } from "@/lib/statusLabels";
import { CalendarButton } from "./CalendarButton";
import { RequestReview } from "./RequestReview";

interface MyShiftRowProps {
  readonly signup: Signup;
  /** Show the calendar action (upcoming rows only). */
  readonly withCalendar?: boolean;
  /** Current time, for the review window on past no-show rows. */
  readonly nowMs?: number;
}

export const MyShiftRow = ({ signup, withCalendar = false, nowMs }: MyShiftRowProps): ReactElement => {
  const instance = useInstance(signup.instanceId);
  const status = SIGNUP_STATUS_LABELS[signup.status];
  const cancelledByOrg = instance.data?.status === "cancelled" && signup.status !== "cancelled";
  return (
    <li className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="font-semibold text-fg">{instance.data?.title ?? "Loading shift..."}</p>
        <p className="text-sm text-fg-muted">
          {instance.data ? `${instance.data.orgName}, ${formatShiftTime(instance.data.start.toDate(), instance.data.timeZone)}` : ""}
        </p>
      </div>
      <div className="flex flex-col items-start gap-1 sm:items-end">
        {cancelledByOrg ? (
          <StatusBadge tone="neutral" label="Cancelled by organization" />
        ) : (
          <StatusBadge tone={status.tone} label={status.label} />
        )}
        {withCalendar && instance.data && signup.status !== "waitlisted" ? (
          <CalendarButton instance={instance.data} signupId={signup.id} cancelled={cancelledByOrg} />
        ) : null}
        {nowMs !== undefined ? <RequestReview signup={signup} nowMs={nowMs} /> : null}
      </div>
    </li>
  );
};

/**
 * CheckinPage.tsx
 * Route "/checkin?i={instanceId}&c={code}" (SPEC#screen-inventory
 * "Check-in", SPEC 5.10 qrPayload). Opening the kiosk QR with the phone's
 * own camera lands here: the shift name, then the same check-in panel as My
 * Shifts with the code already filled in, so one tap on Submit code checks
 * in (or out). Without a valid link, or without a signup on that shift, it
 * explains what to do instead. The server still checks the code and the
 * time window; nothing is submitted automatically.
 */
import { useMemo, useState, type ReactElement } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckInPanel, type CheckOutResult } from "@/components/checkin/CheckInPanel";
import { DemoArc } from "@/components/checkin/DemoArc";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { PageHeader } from "@/components/ui/PageHeader";
import { useNow } from "@/hooks/useNow";
import { useInstance } from "@/hooks/useShiftData";
import { useMySignups } from "@/hooks/useVolunteerData";
import { readCheckinParams } from "@/lib/qr";
import { useSessionUser } from "@/store/authStore";

const ToMyShifts = (): ReactElement => (
  <Link to="/me/shifts" className={buttonClassName("primary", "w-fit")}>
    Go to My Shifts
  </Link>
);

const CheckinPage = (): ReactElement => {
  const [params] = useSearchParams();
  const payload = useMemo(() => readCheckinParams(params), [params]);
  const user = useSessionUser();
  const nowMs = useNow();
  const instance = useInstance(payload?.instanceId ?? null);
  const signups = useMySignups(user?.uid ?? null);
  const [checkedOut, setCheckedOut] = useState<CheckOutResult | null>(null);

  if (payload === null) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Check in">This check-in link is incomplete. Open My Shifts and type the code shown on the kiosk.</PageHeader>
        <ToMyShifts />
      </div>
    );
  }
  if (instance.error || signups.error) return <ErrorState title="We couldn't load this shift" description="Check your connection, then reload." />;
  if (instance.isLoading || signups.isLoading) return <LoadingState label="Loading your shift" />;
  const shift = instance.data;
  const signup = (signups.data ?? []).find((entry) => entry.instanceId === payload.instanceId) ?? null;

  if (!shift || signup === null) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Check in">{shift ? `You don't have a spot on ${shift.title}.` : "We couldn't find that shift."}</PageHeader>
        <ToMyShifts />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Check in: ${shift.title}`}>{shift.orgName}</PageHeader>
      {checkedOut ? (
        <DemoArc result={checkedOut} onDismiss={() => setCheckedOut(null)} />
      ) : (
        <CheckInPanel instance={shift} signup={signup} nowMs={nowMs} onCheckedOut={setCheckedOut} initialCode={payload.code} />
      )}
    </div>
  );
};

export default CheckinPage;

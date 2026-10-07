/**
 * MyShiftsPage.tsx
 * Route "/me/shifts" (SPEC#screen-inventory "My Shifts"). The next shift sits
 * on top with its check-in controls (SPEC#kiosk steps 3 and 5), then the
 * other upcoming shifts, then past ones. After check-out the demo arc (D11)
 * replaces the top section until dismissed. Empty state per D6.
 */
import { useMemo, useState, type ReactElement } from "react";
import { Link } from "react-router-dom";
import { formatShiftTime } from "@fbla/shared";
import { CheckInPanel, type CheckOutResult } from "@/components/checkin/CheckInPanel";
import { DemoArc } from "@/components/checkin/DemoArc";
import { CalendarButton } from "@/components/shifts/CalendarButton";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { MyShiftRow } from "@/components/shifts/MyShiftRow";
import { PromotionBanner } from "@/components/shifts/PromotionBanner";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { PageHeader } from "@/components/ui/PageHeader";
import { UnverifiedChip } from "@/components/ui/UnverifiedChip";
import { useNow } from "@/hooks/useNow";
import { useInstance } from "@/hooks/useShiftData";
import { useMySignups } from "@/hooks/useVolunteerData";
import type { Signup } from "@/lib/data/signups";
import { groupMyShifts } from "@/lib/myShifts";
import { useSessionUser } from "@/store/authStore";

const NextShift = ({ signup, nowMs, onCheckedOut }: { signup: Signup; nowMs: number; onCheckedOut: (result: CheckOutResult) => void }): ReactElement => {
  const instance = useInstance(signup.instanceId);
  if (instance.error) return <ErrorState title="We couldn't load this shift" description="Check your connection, then reload." />;
  if (!instance.data) return <LoadingState label="Loading your next shift" lines={2} />;
  const shift = instance.data;
  return (
    <section aria-labelledby="next-shift-title" className="flex flex-col gap-5 border-l-4 border-accent bg-surface py-5 pr-4 pl-5 shadow-sm">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-accent">Next shift</p>
        <h2 id="next-shift-title" className="text-2xl font-semibold text-fg">
          {shift.title}
        </h2>
        <p className="flex flex-wrap items-center gap-2 text-fg-muted">
          {shift.orgName}
          {shift.orgVerified ? null : <UnverifiedChip />}
        </p>
        <p className="font-mono text-sm text-fg">{formatShiftTime(shift.start.toDate(), shift.timeZone)}</p>
      </div>
      <CheckInPanel instance={shift} signup={signup} nowMs={nowMs} onCheckedOut={onCheckedOut} />
      {signup.status === "confirmed" ? <CalendarButton instance={shift} signupId={signup.id} cancelled={false} /> : null}
    </section>
  );
};

const MyShiftsPage = (): ReactElement => {
  const user = useSessionUser();
  const nowMs = useNow();
  const signups = useMySignups(user?.uid ?? null);
  const [checkedOut, setCheckedOut] = useState<CheckOutResult | null>(null);
  const groups = useMemo(() => groupMyShifts(signups.data ?? [], nowMs), [signups.data, nowMs]);

  if (signups.error) return <ErrorState title="We couldn't load your shifts" description="Check your connection, then reload the page." />;
  if (signups.isLoading) return <LoadingState label="Loading your shifts" />;

  const isEmpty = groups.next === null && groups.past.length === 0 && checkedOut === null;

  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="My Shifts">Check in at the kiosk, check out when you leave, and see where you have helped.</PageHeader>

      {/* Tier 1 lane A: promotion banner (Confirm / Can't make it) and reminders. */}
      {user ? <PromotionBanner uid={user.uid} signups={signups.data ?? []} nowMs={nowMs} /> : null}
      {checkedOut ? <DemoArc result={checkedOut} onDismiss={() => setCheckedOut(null)} /> : null}
      {groups.next ? <NextShift signup={groups.next} nowMs={nowMs} onCheckedOut={setCheckedOut} /> : null}

      {isEmpty ? (
        <section className="flex flex-col items-start gap-3">
          <h2 className="text-xl font-semibold text-fg">No shifts yet.</h2>
          <p className="text-fg-muted">Sign up for a shift on Explore and it will show up here.</p>
          <Link to="/" className={buttonClassName("primary")}>
            Find shifts
          </Link>
        </section>
      ) : null}

      {groups.upcoming.length > 0 ? (
        <section aria-labelledby="upcoming-title">
          <h2 id="upcoming-title" className="border-b border-border-strong pb-2 text-sm font-semibold text-fg-muted">
            Also coming up
          </h2>
          <ul className="divide-y divide-border">
            {groups.upcoming.map((signup) => (
              <MyShiftRow key={signup.id} signup={signup} withCalendar />
            ))}
          </ul>
        </section>
      ) : null}

      {groups.past.length > 0 ? (
        <section aria-labelledby="past-title">
          <h2 id="past-title" className="border-b border-border-strong pb-2 text-sm font-semibold text-fg-muted">
            Past shifts
          </h2>
          <ul className="divide-y divide-border">
            {groups.past.map((signup) => (
              <MyShiftRow key={signup.id} signup={signup} nowMs={nowMs} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
};

export default MyShiftsPage;

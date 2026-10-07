/**
 * OpportunityPage.tsx
 * Route "/opportunity/:instanceId" (SPEC#screen-inventory "Opportunity", D1,
 * Tier 0): decide and sign up. Above the fold, in SPEC order: date, time with
 * zone, place, seats left; the signup button (D5 matrix, the same
 * SignupAction Explore uses); the description; the organization with the
 * Unverified chip when needed. The shift is live (seats and status update
 * without a reload); the description and place come from its opportunity.
 */
import { useMemo, type ReactElement } from "react";
import { Link, useParams } from "react-router-dom";
import { formatInTimeZone } from "date-fns-tz";
import { CalendarBlank, Clock, MapPin, UsersThree } from "@phosphor-icons/react";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { SignupAction } from "@/components/shifts/SignupAction";
import { formatTimeRange, opportunityPathFor, seatsText } from "@/components/shifts/ShiftRow";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { PageHeader } from "@/components/ui/PageHeader";
import { UnverifiedChip } from "@/components/ui/UnverifiedChip";
import { useNow } from "@/hooks/useNow";
import { useOpportunity } from "@/hooks/useOpportunity";
import { useInstance } from "@/hooks/useShiftData";
import { useMySignups, usePrivateProfile } from "@/hooks/useVolunteerData";
import type { Instance } from "@/lib/data/instances";
import type { Opportunity } from "@/lib/data/opportunities";
import { seatsLeft } from "@/lib/signupButtonState";
import { useSessionUser } from "@/store/authStore";

/** Seats and "Shift started" re-check on the same 15-second tick as Explore. */
const OPPORTUNITY_TICK_MS = 15_000;

const placeOf = (opportunity: Opportunity | null | undefined): string | null => {
  const address = opportunity?.location?.address;
  return address ? `${address.line1}, ${address.city}, ${address.state} ${address.zip}` : null;
};

const Fact = ({ icon, children }: { icon: ReactElement; children: string }): ReactElement => (
  <li className="flex items-center gap-2 text-fg">
    {icon}
    <span>{children}</span>
  </li>
);

const ShiftFacts = ({ instance, place }: { instance: Instance; place: string | null }): ReactElement => (
  <ul className="flex flex-col gap-2 font-medium">
    <Fact icon={<CalendarBlank aria-hidden="true" size={20} />}>{formatInTimeZone(instance.start.toDate(), instance.timeZone, "EEEE, MMMM d, yyyy")}</Fact>
    <Fact icon={<Clock aria-hidden="true" size={20} />}>{formatTimeRange(instance)}</Fact>
    {place ? <Fact icon={<MapPin aria-hidden="true" size={20} />}>{place}</Fact> : null}
    <Fact icon={<UsersThree aria-hidden="true" size={20} />}>{`${seatsText(seatsLeft(instance.capacity, instance.signupCount))} of ${instance.capacity}`}</Fact>
  </ul>
);

const NotFound = (): ReactElement => (
  <section className="flex max-w-xl flex-col items-start gap-3">
    <PageHeader title="Shift not found">This shift may have been removed, or the link is incomplete.</PageHeader>
    <Link to="/explore" className={buttonClassName("primary")}>
      Find shifts
    </Link>
  </section>
);

const OpportunityPage = (): ReactElement => {
  const { instanceId = "" } = useParams();
  const nowMs = useNow(OPPORTUNITY_TICK_MS);
  const user = useSessionUser();
  const uid = user?.uid ?? null;
  const instance = useInstance(instanceId || null);
  const opportunity = useOpportunity(instance.data?.opportunityId ?? null);
  const signups = useMySignups(uid);
  const profile = usePrivateProfile(uid);
  const mySignup = useMemo(() => (signups.data ?? []).find((signup) => signup.instanceId === instanceId) ?? null, [signups.data, instanceId]);

  if (instance.error) return <ErrorState title="We couldn't load this shift" description="Check your connection, then reload the page." />;
  if (instance.isLoading) return <LoadingState label="Loading this shift" />;
  if (!instance.data) return <NotFound />;
  const shift = instance.data;

  return (
    <article className="flex max-w-3xl flex-col gap-8">
      <PageHeader title={shift.title} />
      <div className="flex flex-col gap-6 border-l-4 border-accent bg-surface py-5 pr-4 pl-5 shadow-sm md:flex-row md:items-start md:justify-between">
        <ShiftFacts instance={shift} place={placeOf(opportunity.data)} />
        <SignupAction
          instance={shift}
          signup={mySignup}
          birthDate={profile.data?.birthDate ?? null}
          signedIn={user !== null}
          nowMs={nowMs}
          returnPath={opportunityPathFor(shift.id)}
        />
      </div>
      <section aria-labelledby="about-shift" className="flex flex-col gap-2">
        <h2 id="about-shift" className="text-xl font-semibold text-fg">
          About this shift
        </h2>
        <p className="max-w-[65ch] text-fg-muted">{opportunity.data?.description ?? (opportunity.isLoading ? "Loading the description..." : "No description yet.")}</p>
        {shift.minAge > 13 ? <p className="text-sm text-fg-muted">Ages {shift.minAge}+.</p> : null}
      </section>
      <section aria-labelledby="about-org" className="flex flex-col gap-2">
        <h2 id="about-org" className="text-xl font-semibold text-fg">
          Organization
        </h2>
        <p className="flex flex-wrap items-center gap-2 text-fg">
          {shift.orgName}
          {shift.orgVerified ? null : <UnverifiedChip />}
        </p>
      </section>
    </article>
  );
};

export default OpportunityPage;

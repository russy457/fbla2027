/**
 * ShiftRow.tsx
 * One shift in the Explore list: title, organization (with the Unverified
 * chip, D23), time in the organization's zone with a zone label (D24), seats
 * left, minimum age, and the signup action (D5). Rows sit in a divided list
 * rather than a card grid, so time and action line up when scanning a day.
 * The title links to the shift's Opportunity page (/opportunity/:instanceId).
 */
import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { formatInTimeZone } from "date-fns-tz";
import { MapPin, UsersThree } from "@phosphor-icons/react";
import { UnverifiedChip } from "@/components/ui/UnverifiedChip";
import type { Instance } from "@/lib/data/instances";
import type { Signup } from "@/lib/data/signups";
import { seatsLeft } from "@/lib/signupButtonState";
import { SaveToggle } from "./SaveToggle";
import { SignupAction } from "./SignupAction";

interface ShiftRowProps {
  readonly instance: Instance;
  readonly signup: Signup | null;
  readonly birthDate: string | null;
  readonly signedIn: boolean;
  readonly nowMs: number;
}

/** "9:00 AM to 11:00 AM CDT" in the org zone. */
export const formatTimeRange = (instance: Instance): string => {
  const start = formatInTimeZone(instance.start.toDate(), instance.timeZone, "h:mm a");
  const end = formatInTimeZone(instance.end.toDate(), instance.timeZone, "h:mm a zzz");
  return `${start} to ${end}`;
};

export const opportunityPathFor = (instanceId: string): string => `/opportunity/${encodeURIComponent(instanceId)}`;

export const seatsText = (left: number): string => (left === 0 ? "No seats left" : left === 1 ? "1 seat left" : `${left} seats left`);

export const ShiftRow = ({ instance, signup, birthDate, signedIn, nowMs }: ShiftRowProps): ReactElement => {
  const left = seatsLeft(instance.capacity, instance.signupCount);
  const titleId = `shift-${instance.id}-title`;
  return (
    <li aria-labelledby={titleId} className="grid grid-cols-1 gap-4 py-5 md:grid-cols-[7.5rem_minmax(0,1fr)_auto] md:items-start md:gap-6">
      <p className="font-mono text-sm font-semibold text-fg md:pt-1">
        <time dateTime={instance.start.toDate().toISOString()}>{formatTimeRange(instance)}</time>
      </p>
      <div className="flex min-w-0 flex-col gap-1.5">
        <h3 id={titleId} className="text-lg font-semibold text-fg">
          <Link to={opportunityPathFor(instance.id)} className="underline-offset-4 hover:text-accent hover:underline focus-visible:underline">
            {instance.title}
          </Link>
        </h3>
        <p className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">
          <span className="inline-flex items-center gap-1">
            <MapPin aria-hidden="true" size={16} />
            {instance.orgName}
          </span>
          {instance.orgVerified ? null : <UnverifiedChip />}
        </p>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-fg-muted">
          <span className="inline-flex items-center gap-1">
            <UsersThree aria-hidden="true" size={16} />
            {seatsText(left)} of {instance.capacity}
          </span>
          {instance.minAge > 13 ? <span>Ages {instance.minAge}+</span> : null}
        </p>
        {/* Tier 1 lane A: save the listing (SPEC 3.18); signed-out visitors see nothing. */}
        <SaveToggle kind="opportunity" refId={instance.opportunityId} label={instance.title} />
      </div>
      <SignupAction instance={instance} signup={signup} birthDate={birthDate} signedIn={signedIn} nowMs={nowMs} />
    </li>
  );
};

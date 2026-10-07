import { useState, type ReactElement, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { formatInTimeZone } from "date-fns-tz";
import { ArrowUpRight, MapPin, UsersThree } from "@phosphor-icons/react";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { OrgLink } from "@/components/ui/OrgLink";
import { UnverifiedChip } from "@/components/ui/UnverifiedChip";
import { SaveToggle } from "@/components/shifts/SaveToggle";
import { SignupAction } from "@/components/shifts/SignupAction";
import { opportunityPathFor, seatsText } from "@/components/shifts/ShiftRow";
import { buttonClassName } from "@/components/ui/buttonStyles";
import type { InstanceDay } from "@/hooks/useInstanceDays";
import type { Instance } from "@/lib/data/instances";
import type { Signup } from "@/lib/data/signups";
import { seatsLeft } from "@/lib/signupButtonState";

interface ScheduleBoardProps {
  readonly days: readonly InstanceDay[];
  readonly unfilteredCount: number;
  readonly signups: ReadonlyMap<string, Signup>;
  readonly birthDate: string | null;
  readonly signedIn: boolean;
  readonly nowMs: number;
  readonly isLoading: boolean;
  readonly hasError: boolean;
  readonly onClearFilters: () => void;
  readonly mapContent?: ReactNode;
}

const ScheduleRow = ({ instance, index, signup, birthDate, signedIn, nowMs }: {
  readonly instance: Instance;
  readonly index: number;
  readonly signup: Signup | null;
  readonly birthDate: string | null;
  readonly signedIn: boolean;
  readonly nowMs: number;
}): ReactElement => {
  const titleId = `schedule-${instance.id}-title`;
  return (
    <li className="schedule-row" aria-labelledby={titleId}>
      <span className="schedule-row__index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
      <div className="schedule-row__time">
        <time dateTime={instance.start.toDate().toISOString()}>{formatInTimeZone(instance.start.toDate(), instance.timeZone, "h:mm a")}</time>
        <span>{formatInTimeZone(instance.end.toDate(), instance.timeZone, "h:mm a zzz")}</span>
      </div>
      <div className="schedule-row__details">
        <h3 id={titleId}><Link to={opportunityPathFor(instance.id)}>{instance.title}<ArrowUpRight aria-hidden="true" size={16} /></Link></h3>
        <p><MapPin aria-hidden="true" size={15} /><OrgLink orgId={instance.orgId} name={instance.orgName} className="underline-offset-4 hover:underline" />{instance.orgVerified ? null : <UnverifiedChip />}</p>
        <p><UsersThree aria-hidden="true" size={15} />{seatsText(seatsLeft(instance.capacity, instance.signupCount))}{instance.minAge > 13 ? ` · Ages ${instance.minAge}+` : ""}</p>
        <div className="schedule-row__save"><SaveToggle kind="opportunity" refId={instance.opportunityId} label={instance.title} /></div>
      </div>
      <div className="schedule-row__action">
        <SignupAction instance={instance} signup={signup} birthDate={birthDate} signedIn={signedIn} nowMs={nowMs} returnPath={opportunityPathFor(instance.id)} />
      </div>
    </li>
  );
};

export const ScheduleBoard = ({ days, unfilteredCount, signups, birthDate, signedIn, nowMs, isLoading, hasError, onClearFilters, mapContent }: ScheduleBoardProps): ReactElement => {
  const [selectedDay, setSelectedDay] = useState("all");
  const activeDay = days.find((day) => day.key === selectedDay);
  const visibleDays = activeDay ? [activeDay] : days;
  const count = days.reduce((total, day) => total + day.instances.length, 0);
  let rowIndex = 0;

  return (
    <section className="schedule-board" aria-labelledby="schedule-title">
      <div className="schedule-board__heading">
        <div>
          <p className="schedule-board__eyebrow">Your next shift starts here</p>
          <h2 id="schedule-title">Open <em>shifts.</em></h2>
        </div>
        <p aria-live="polite">{count === 1 ? "1 shift" : `${count} shifts`} available</p>
      </div>
      {!mapContent && days.length > 0 ? (
        <div role="group" aria-label="Choose a shift date" className="schedule-dates">
          <button type="button" aria-pressed={!activeDay} onClick={() => setSelectedDay("all")}>All dates</button>
          {days.slice(0, 5).map((day) => (
            <button key={day.key} type="button" aria-pressed={activeDay?.key === day.key} onClick={() => setSelectedDay(day.key)}>{day.label}</button>
          ))}
        </div>
      ) : null}
      {hasError ? (
        <div className="schedule-board__message"><ErrorState title="We couldn't load shifts" description="Check your connection, then reload the page." /></div>
      ) : isLoading ? (
        <div className="schedule-board__message"><LoadingState label="Loading shifts" /></div>
      ) : unfilteredCount === 0 ? (
        <div className="schedule-board__empty">
          <h3>No upcoming shifts right now.</h3>
          <p>New shifts appear here as organizations post them.</p>
          <Link to="/help/find-and-sign-up" className={buttonClassName("secondary")}>How signing up works</Link>
        </div>
      ) : mapContent ? (
        <div className="schedule-board__map">{mapContent}</div>
      ) : days.length === 0 ? (
        <div className="schedule-board__empty">
          <h3>No shifts match these filters.</h3>
          <button type="button" onClick={onClearFilters} className={buttonClassName("secondary")}>Clear filters</button>
        </div>
      ) : (
        <div className="schedule-board__days">
          {visibleDays.map((day) => (
            <section key={day.key} aria-labelledby={`day-${day.key}`} className="schedule-day">
              <h3 id={`day-${day.key}`}>{day.label}</h3>
              <ol>
                {day.instances.map((instance) => {
                  const index = rowIndex++;
                  return <ScheduleRow key={instance.id} instance={instance} index={index} signup={signups.get(instance.id) ?? null} birthDate={birthDate} signedIn={signedIn} nowMs={nowMs} />;
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </section>
  );
};

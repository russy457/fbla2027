/**
 * ShiftAttendanceRoster.tsx
 * The shift detail roster (SPEC 9.2 "Shift roster": watch arrivals, fix
 * attendance). Shows the live RosterTable, then an "Attendance" list of the
 * people whose attendance a coordinator may change (no-shows and completed
 * signups, SPEC 5.7), each with "Change attendance for NAME", which opens the
 * setAttendance editor inline. The roster listener is shared with
 * RosterTable through the query cache, so this adds no extra reads.
 */
import { useRef, useState, type ReactElement } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { useRoster } from "@/hooks/useShiftData";
import type { Instance } from "@/lib/data/instances";
import type { Signup } from "@/lib/data/signups";
import { SIGNUP_STATUS_LABELS } from "@/lib/statusLabels";
import { AttendanceEditor } from "./AttendanceEditor";
import { RosterTable } from "./RosterTable";

interface ShiftAttendanceRosterProps {
  readonly orgId: string;
  readonly instance: Instance;
  readonly canViewContacts: boolean;
}

const EDITABLE: ReadonlySet<Signup["status"]> = new Set(["no-show", "completed"]);

const AttendanceRow = ({ signup, scheduledMinutes, onSaved }: { signup: Signup; scheduledMinutes: number; onSaved: (message: string) => void }): ReactElement => {
  const [isEditing, setIsEditing] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const close = (message?: string): void => {
    setIsEditing(false);
    if (message) onSaved(message);
    window.requestAnimationFrame(() => button.current?.focus());
  };
  return (
    <li className="flex flex-col gap-3 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex flex-wrap items-center gap-2 font-semibold text-fg">
          {signup.displayName}
          <StatusBadge {...SIGNUP_STATUS_LABELS[signup.status]} />
          {signup.disputeOpen ? <StatusBadge tone="warning" label="Review requested" /> : null}
        </p>
        <button ref={button} type="button" disabled={isEditing} onClick={() => setIsEditing(true)} className={buttonClassName("secondary")}>
          {`Change attendance for ${signup.displayName}`}
        </button>
      </div>
      {isEditing ? (
        <AttendanceEditor
          signupId={signup.id}
          name={signup.displayName}
          status={signup.status}
          disputeOpen={signup.disputeOpen}
          scheduledMinutes={scheduledMinutes}
          onClose={close}
        />
      ) : null}
    </li>
  );
};

export const ShiftAttendanceRoster = ({ orgId, instance, canViewContacts }: ShiftAttendanceRosterProps): ReactElement => {
  const roster = useRoster(instance.id, orgId);
  const [message, setMessage] = useState<string | null>(null);
  const editable = (roster.data ?? []).filter((signup) => EDITABLE.has(signup.status));
  const scheduledMinutes = Math.round((instance.end.toMillis() - instance.start.toMillis()) / 60_000);

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="roster-title" className="flex flex-col gap-2">
        <h2 id="roster-title" className="text-lg font-semibold text-fg">
          Roster (updates live)
        </h2>
        <RosterTable orgId={orgId} instanceId={instance.id} timeZone={instance.timeZone} canViewContacts={canViewContacts} />
      </section>
      {editable.length > 0 ? (
        <section aria-labelledby="attendance-title" className="flex flex-col gap-2">
          <h2 id="attendance-title" className="text-lg font-semibold text-fg">
            Attendance
          </h2>
          <p className="text-sm text-fg-muted">Fix a no-show or a check-out after the shift. Every change needs a note.</p>
          <p role="status" className="text-sm font-medium text-fg empty:hidden">
            {message ?? ""}
          </p>
          <ul className="divide-y divide-border">
            {editable.map((signup) => (
              <AttendanceRow key={signup.id} signup={signup} scheduledMinutes={scheduledMinutes} onSaved={setMessage} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
};

/**
 * RosterTable.tsx
 * Live roster for one shift on the coordinator dashboard (SPEC#kiosk step 4).
 * Signups arrive through onSnapshot, so a volunteer checking in at the kiosk
 * appears here within a second, announced through a polite live region.
 * Display names for everyone; contact fields only where the rules allow
 * (rosterRows.ts). Desktop shows a table; under 768 px each person is a
 * stacked row (D19).
 */
import { useEffect, useRef, useState, type ReactElement } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useRoster, useRosterContacts } from "@/hooks/useShiftData";
import { buildRosterRows, type ContactCell, type RosterRow } from "@/lib/rosterRows";
import { SIGNUP_STATUS_LABELS } from "@/lib/statusLabels";

interface RosterTableProps {
  readonly orgId: string;
  readonly instanceId: string;
  readonly timeZone: string;
  readonly canViewContacts: boolean;
}

const ContactText = ({ cell }: { cell: ContactCell }): ReactElement => {
  if (cell.kind === "not-shared") return <span className="text-fg-subtle">Not shared with you</span>;
  if (cell.kind === "hidden-unverified") return <span className="text-fg-muted">Contact hidden until your organization is verified</span>;
  return (
    <span className="flex flex-col break-all">
      {cell.email ? <a className="text-accent underline underline-offset-2" href={`mailto:${cell.email}`}>{cell.email}</a> : null}
      {cell.phone ? <span>{cell.phone}</span> : null}
    </span>
  );
};

/** Announces new check-ins ("Jordan R. checked in") without moving focus. */
const useArrivalAnnouncement = (rows: readonly RosterRow[]): string => {
  const seen = useRef<Set<string> | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const arrived = rows.filter((row) => row.status === "checked-in");
    if (seen.current !== null) {
      const fresh = arrived.filter((row) => !seen.current?.has(row.id));
      if (fresh.length > 0) setMessage(fresh.map((row) => `${row.displayName} checked in`).join(". "));
    }
    seen.current = new Set(arrived.map((row) => row.id));
  }, [rows]);
  return message;
};

export const RosterTable = ({ orgId, instanceId, timeZone, canViewContacts }: RosterTableProps): ReactElement => {
  const roster = useRoster(instanceId, orgId);
  const contacts = useRosterContacts(orgId, instanceId, canViewContacts);
  const rows = buildRosterRows(roster.data ?? [], contacts.data ?? [], canViewContacts && contacts.error === null);
  const announcement = useArrivalAnnouncement(rows);
  const time = (ms: number | null): string => (ms === null ? "Not yet" : formatInTimeZone(new Date(ms), timeZone, "h:mm a"));

  if (roster.error) return <ErrorState title="We couldn't load the roster" description="Check your connection, then reload." />;
  if (roster.isLoading) return <LoadingState label="Loading the roster" lines={3} />;

  return (
    <div className="flex flex-col gap-3">
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {rows.length === 0 ? (
        <p className="text-fg-muted">No one has signed up yet.</p>
      ) : (
        <>
          <table className="hidden w-full text-left text-sm md:table">
            <caption className="sr-only">Volunteers on this shift</caption>
            <thead>
              <tr className="border-b border-border-strong text-fg-muted">
                <th scope="col" className="py-2 pr-4 font-semibold">Volunteer</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Status</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Checked in</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Checked out</th>
                <th scope="col" className="py-2 font-semibold">Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.id}>
                  <th scope="row" className="py-3 pr-4 font-semibold text-fg">
                    {row.displayName}
                    {row.walkUp ? <span className="ml-2 text-xs font-medium text-fg-muted">Walk-up</span> : null}
                  </th>
                  <td className="py-3 pr-4"><StatusBadge {...SIGNUP_STATUS_LABELS[row.status]} /></td>
                  <td className="py-3 pr-4 font-mono">{time(row.checkInAtMs)}</td>
                  <td className="py-3 pr-4 font-mono">{time(row.checkOutAtMs)}</td>
                  <td className="py-3"><ContactText cell={row.contact} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="divide-y divide-border md:hidden" aria-label="Volunteers on this shift">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-col gap-1.5 py-3">
                <p className="flex flex-wrap items-center justify-between gap-2 font-semibold text-fg">
                  {row.displayName}
                  <StatusBadge {...SIGNUP_STATUS_LABELS[row.status]} />
                </p>
                <p className="text-sm text-fg-muted">
                  In {time(row.checkInAtMs)}, out {time(row.checkOutAtMs)}
                </p>
                <p className="text-sm"><ContactText cell={row.contact} /></p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

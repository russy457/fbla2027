/**
 * CheckInPanel.tsx
 * The check-in and check-out controls for the volunteer's next shift
 * (SPEC#kiosk steps 3 and 5, SPEC#screen-kiosk-states "Phone check-in").
 * Which control shows comes from checkInPhase(); the server re-checks every
 * window. After check-in the live signup snapshot drives the success line
 * "Checked in at 9:02 AM, check-out opens 9:17 AM". Check-out is a separate,
 * explicit action with its own code entry; its result is handed to the page
 * so it can show the demo arc (D11).
 */
import { useState, type ReactElement } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { CheckCircle } from "@phosphor-icons/react";
import { formatClockTime, type OpOutput } from "@fbla/shared";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { api } from "@/lib/api";
import { checkInPhase } from "@/lib/checkInPhase";
import type { Instance } from "@/lib/data/instances";
import type { Signup } from "@/lib/data/signups";
import { CodeEntryForm } from "./CodeEntryForm";

export type CheckOutResult = OpOutput<"kiosk", "checkOut">;

interface CheckInPanelProps {
  readonly instance: Instance;
  readonly signup: Signup;
  readonly nowMs: number;
  readonly onCheckedOut: (result: CheckOutResult) => void;
}

/** "9:02 AM" in the shift's zone, as in the SPEC success line. */
const clockOnly = (ms: number, timeZone: string): string => formatInTimeZone(new Date(ms), timeZone, "h:mm a");

const Notice = ({ children }: { children: string }): ReactElement => <p className="text-fg-muted">{children}</p>;

export const CheckInPanel = ({ instance, signup, nowMs, onCheckedOut }: CheckInPanelProps): ReactElement => {
  const [entryOpen, setEntryOpen] = useState(false);
  const zone = instance.timeZone;
  const phase = checkInPhase({
    nowMs,
    instance: { status: instance.status, startMs: instance.start.toMillis(), endMs: instance.end.toMillis() },
    signup: { status: signup.status, checkInAtMs: signup.checkInAt?.toMillis() ?? null }
  });

  const checkIn = async (code: string): Promise<void> => {
    await api.kiosk.checkIn({ instanceId: instance.id, code });
    setEntryOpen(false);
  };
  const checkOut = async (code: string): Promise<void> => {
    const result = await api.kiosk.checkOut({ instanceId: instance.id, code });
    setEntryOpen(false);
    onCheckedOut(result);
  };

  const checkedInLine =
    "checkInAtMs" in phase && phase.kind !== "check-out-closed"
      ? `Checked in at ${clockOnly(phase.checkInAtMs, zone)}, check-out opens ${clockOnly(phase.opensAtMs, zone)}`
      : null;

  return (
    <div className="flex flex-col gap-4">
      {checkedInLine ? (
        <p role="status" className="flex items-start gap-2 text-lg font-semibold text-status-success">
          <CheckCircle aria-hidden="true" size={24} weight="bold" className="mt-0.5 shrink-0" />
          <span className="text-fg">{checkedInLine}</span>
        </p>
      ) : null}

      {phase.kind === "check-in-not-open" ? (
        <div className="flex flex-col items-start gap-2">
          <button type="button" disabled className={buttonClassName("primary")}>
            Check in
          </button>
          <Notice>{`Check-in opens ${formatClockTime(new Date(phase.opensAtMs), zone)}`}</Notice>
        </div>
      ) : null}

      {phase.kind === "check-in-open" ? (
        entryOpen ? (
          <CodeEntryForm actionLabel="Check in" onSubmitCode={checkIn} onCancel={() => setEntryOpen(false)} />
        ) : (
          <button type="button" onClick={() => setEntryOpen(true)} className={buttonClassName("primary", "w-fit")}>
            Check in
          </button>
        )
      ) : null}

      {phase.kind === "check-out-not-open" ? (
        <div className="flex flex-col items-start gap-2">
          <button type="button" disabled className={buttonClassName("secondary")}>
            Check out
          </button>
          <Notice>{`Check-out opens ${clockOnly(phase.opensAtMs, zone)}`}</Notice>
        </div>
      ) : null}

      {phase.kind === "check-out-open" ? (
        entryOpen ? (
          <CodeEntryForm actionLabel="Check out" onSubmitCode={checkOut} onCancel={() => setEntryOpen(false)} />
        ) : (
          <button type="button" onClick={() => setEntryOpen(true)} className={buttonClassName("primary", "w-fit")}>
            Check out
          </button>
        )
      ) : null}

      {phase.kind === "check-out-closed" ? (
        <Notice>Check-out for this shift has closed. Your coordinator will confirm your hours.</Notice>
      ) : null}
      {phase.kind === "check-in-closed" ? <Notice>Check-in for this shift has closed.</Notice> : null}
      {phase.kind === "shift-cancelled" ? <Notice>This shift was cancelled by the organization.</Notice> : null}
    </div>
  );
};

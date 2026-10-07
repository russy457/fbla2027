/**
 * CheckInPanel.tsx
 * The check-in and check-out controls for the volunteer's next shift
 * (SPEC#kiosk steps 3 and 5, SPEC#screen-kiosk-states "Phone check-in").
 * Which control shows comes from checkInPhase(); the server re-checks every
 * window. After check-in the live signup snapshot drives the success line
 * "Checked in at 9:02 AM, check-out opens 9:17 AM". Check-out is a separate,
 * explicit action with its own code entry; its result is handed to the page
 * so it can show the demo arc (D11).
 * Tier 1 QR: in a secure context the code entry offers "Scan QR" (QrScanner).
 * Camera blocked, or no readable code within 10 s, returns to typing with
 * the message shown and focus in the code field (D20); a scanned code that
 * the server refuses comes back the same way with the catalog message.
 * /checkin passes initialCode and startOpen from the kiosk QR link.
 */
import { useState, type ReactElement } from "react";
import { Camera } from "@phosphor-icons/react";
import { formatInTimeZone } from "date-fns-tz";
import { CheckCircle } from "@phosphor-icons/react";
import { formatClockTime, type OpOutput, type UserError } from "@fbla/shared";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { ApiError, NETWORK_USER_ERROR, api } from "@/lib/api";
import { checkInPhase } from "@/lib/checkInPhase";
import type { Instance } from "@/lib/data/instances";
import type { Signup } from "@/lib/data/signups";
import { isQrAvailable } from "@/lib/qr";
import { CodeEntryForm } from "./CodeEntryForm";
import { QrScanner } from "./QrScanner";

export type CheckOutResult = OpOutput<"kiosk", "checkOut">;

interface CheckInPanelProps {
  readonly instance: Instance;
  readonly signup: Signup;
  readonly nowMs: number;
  readonly onCheckedOut: (result: CheckOutResult) => void;
  /** Tier 1: open code entry right away with this code (from a /checkin link). */
  readonly initialCode?: string;
}

/** "9:02 AM" in the shift's zone, as in the SPEC success line. */
const clockOnly = (ms: number, timeZone: string): string => formatInTimeZone(new Date(ms), timeZone, "h:mm a");

const Notice = ({ children }: { children: string }): ReactElement => <p className="text-fg-muted">{children}</p>;

/** A notice shown when typing takes over from the scanner (no code, catalog-free). */
const scanNotice = (message: string): UserError => ({ ...NETWORK_USER_ERROR, title: "Type the code", message, fix: "Type the 6-digit code shown on the kiosk." });

export const CheckInPanel = ({ instance, signup, nowMs, onCheckedOut, initialCode }: CheckInPanelProps): ReactElement => {
  const [entryOpen, setEntryOpen] = useState(initialCode !== undefined);
  const [scanning, setScanning] = useState(false);
  const [entryError, setEntryError] = useState<UserError | null>(null);
  const [prefill, setPrefill] = useState(initialCode ?? "");
  const zone = instance.timeZone;
  const phase = checkInPhase({
    nowMs,
    instance: { status: instance.status, startMs: instance.start.toMillis(), endMs: instance.end.toMillis() },
    signup: { status: signup.status, checkInAtMs: signup.checkInAt?.toMillis() ?? null }
  });

  const closeEntry = (): void => {
    setEntryOpen(false);
    setScanning(false);
    setEntryError(null);
    setPrefill("");
  };
  const checkIn = async (code: string): Promise<void> => {
    await api.kiosk.checkIn({ instanceId: instance.id, code });
    closeEntry();
  };
  const checkOut = async (code: string): Promise<void> => {
    const result = await api.kiosk.checkOut({ instanceId: instance.id, code });
    closeEntry();
    onCheckedOut(result);
  };

  /** Back to typing: the form remounts, shows the message, and focuses the code field. */
  const fallBackToTyping = (message: string): void => {
    setScanning(false);
    setEntryError(message === "" ? null : scanNotice(message));
  };
  const submitScanned = (submit: (code: string) => Promise<void>) => (code: string): void => {
    void submit(code).catch((error: unknown) => {
      setPrefill("");
      setScanning(false);
      setEntryError(error instanceof ApiError ? error.userError : NETWORK_USER_ERROR);
    });
  };

  const entry = (actionLabel: string, submit: (code: string) => Promise<void>): ReactElement =>
    scanning ? (
      <QrScanner instanceId={instance.id} onCode={submitScanned(submit)} onFallback={fallBackToTyping} />
    ) : (
      <CodeEntryForm
        key={entryError?.message ?? "typed"}
        actionLabel={actionLabel}
        onSubmitCode={submit}
        onCancel={closeEntry}
        initialCode={prefill}
        initialError={entryError}
        extraAction={
          isQrAvailable() ? (
            <button type="button" onClick={() => setScanning(true)} className={buttonClassName("secondary")}>
              <Camera aria-hidden="true" size={18} />
              Scan QR
            </button>
          ) : null
        }
      />
    );

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
          entry("Check in", checkIn)
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
          entry("Check out", checkOut)
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

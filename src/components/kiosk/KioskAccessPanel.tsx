/**
 * KioskAccessPanel.tsx
 * Every kiosk screen that needs a coordinator (SPEC#kiosk "Kiosk lock", X15):
 *   sign-in   signed out: coordinator signs in to start the kiosk here
 *   start     a coordinator is signed in: "Start kiosk on this device"
 *             (startKiosk, then this device signs out and signs in as kiosk)
 *   expired   "Kiosk session expired, coordinator sign-in" (assertive)
 *   exit      leaving kiosk mode requires a coordinator sign-in
 * The panel is centered and free of app navigation, like the kiosk itself.
 */
import { useEffect, useRef, useState, type ReactElement } from "react";
import { LockKey } from "@phosphor-icons/react";
import type { UserError } from "@fbla/shared";
import { SignInForm } from "@/components/auth/SignInForm";
import { ErrorNotice } from "@/components/errors/ErrorNotice";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { ApiError, NETWORK_USER_ERROR, api } from "@/lib/api";
import { AuthFormError, switchToKioskSession } from "@/lib/authClient";

export type KioskAccessMode = "sign-in" | "start" | "expired" | "exit";

interface KioskAccessPanelProps {
  readonly mode: KioskAccessMode;
  readonly instanceId: string;
  readonly shiftTitle: string | null;
  /** exit: called after the coordinator signs in (kiosk session is replaced). */
  readonly onExited?: () => void;
  /** exit: return to the kiosk without leaving. */
  readonly onCancelExit?: () => void;
}

const COPY: Readonly<Record<KioskAccessMode, { title: string; body: string }>> = {
  "sign-in": { title: "Coordinator sign-in", body: "Sign in as a coordinator of this organization to start the check-in kiosk on this device." },
  start: { title: "Start the kiosk on this device", body: "This device will be signed out and will show only the check-in code and arrivals." },
  expired: { title: "Kiosk session expired, coordinator sign-in", body: "A coordinator needs to sign in again to restart the kiosk for this shift." },
  exit: { title: "Exit kiosk", body: "A coordinator must sign in to leave kiosk mode." }
};

const StartButton = ({ instanceId }: { instanceId: string }): ReactElement => {
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<UserError | null>(null);
  const start = async (): Promise<void> => {
    setIsStarting(true);
    setError(null);
    try {
      const { customToken } = await api.coordinator.startKiosk({ instanceId });
      await switchToKioskSession(customToken);
    } catch (startError) {
      if (startError instanceof ApiError) setError(startError.userError);
      else if (startError instanceof AuthFormError) setError({ ...NETWORK_USER_ERROR, title: "Kiosk sign-in failed", message: startError.message });
      else setError(NETWORK_USER_ERROR);
      setIsStarting(false);
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={() => void start()} disabled={isStarting} className={buttonClassName("primary", "w-full")}>
        {isStarting ? "Starting kiosk..." : "Start kiosk on this device"}
      </button>
      {error ? <ErrorNotice error={error} expandDetails /> : null}
    </div>
  );
};

export const KioskAccessPanel = ({ mode, instanceId, shiftTitle, onExited, onCancelExit }: KioskAccessPanelProps): ReactElement => {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), [mode]);
  const copy = COPY[mode];

  return (
    <main id="main" className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <section aria-labelledby="kiosk-access-title" className="flex w-full max-w-sm flex-col gap-5">
        <LockKey aria-hidden="true" size={36} className="text-accent" />
        <div className="flex flex-col gap-2" role={mode === "expired" ? "alert" : undefined}>
          <h1 id="kiosk-access-title" ref={headingRef} tabIndex={-1} className="text-2xl font-semibold text-fg outline-none">
            {copy.title}
          </h1>
          {shiftTitle ? <p className="text-sm font-semibold text-fg-muted">Shift: {shiftTitle}</p> : null}
          <p className="text-fg-muted">{copy.body}</p>
        </div>
        {mode === "start" ? (
          <StartButton instanceId={instanceId} />
        ) : (
          <SignInForm submitLabel={mode === "exit" ? "Sign in and exit kiosk" : "Sign in"} onSignedIn={() => onExited?.()} />
        )}
        {mode === "exit" && onCancelExit ? (
          <button type="button" onClick={onCancelExit} className={buttonClassName("quiet", "w-fit")}>
            Back to the kiosk
          </button>
        ) : null}
      </section>
    </main>
  );
};

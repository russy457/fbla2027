/**
 * KioskAccessPanel.tsx
 * Every kiosk screen that needs a coordinator (SPEC#kiosk "Kiosk lock", X15):
 *   sign-in   signed out: coordinator signs in to start the kiosk here
 *   start     a coordinator is signed in: "Start kiosk on this device"
 *             (startKiosk, then this device signs out and signs in as kiosk)
 *   expired   "Kiosk session expired, coordinator sign-in" (assertive)
 *   exit      leaving kiosk mode requires a coordinator sign-in; the person
 *             is checked as an owner or coordinator of the shift's org
 *             BEFORE the kiosk session is replaced (lib/kioskExit.ts), so
 *             anyone else gets an error and the kiosk keeps running
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
import { exitKioskWithCredentials } from "@/lib/kioskExit";

export type KioskAccessMode = "sign-in" | "start" | "expired" | "exit";

interface KioskAccessPanelProps {
  readonly mode: KioskAccessMode;
  readonly instanceId: string;
  /** The shift's organization (from the instance doc); exit requires a coordinator of it. */
  readonly orgId: string;
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

export const KioskAccessPanel = ({ mode, instanceId, orgId, shiftTitle, onExited, onCancelExit }: KioskAccessPanelProps): ReactElement => {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), [mode]);
  const copy = COPY[mode];

  return (
    <main id="main" className="kiosk-access-page min-h-dvh bg-bg">
      <section aria-labelledby="kiosk-access-title">
        <div className="kiosk-access-hero">
          <div className="kiosk-access-hero__copy" role={mode === "expired" ? "alert" : undefined}>
            <p>For coordinators</p>
            <h1 id="kiosk-access-title" ref={headingRef} tabIndex={-1} className="outline-none">{copy.title}</h1>
          </div>
        </div>
        <div className="kiosk-access-content">
          <LockKey aria-hidden="true" size={32} className="text-accent" />
          {shiftTitle ? <p className="text-sm font-semibold text-fg-muted">Shift: {shiftTitle}</p> : null}
          <p className="text-fg-muted">{copy.body}</p>
          {mode === "start" ? (
            <StartButton instanceId={instanceId} />
          ) : (
            <SignInForm
              submitLabel={mode === "exit" ? "Sign in and exit kiosk" : "Sign in"}
              authenticate={mode === "exit" ? (email, password) => exitKioskWithCredentials(email, password, orgId) : undefined}
              onSignedIn={() => onExited?.()}
            />
          )}
          {mode === "exit" && onCancelExit ? (
            <button type="button" onClick={onCancelExit} className={buttonClassName("quiet", "w-fit")}>
              Back to the kiosk
            </button>
          ) : null}
        </div>
      </section>
    </main>
  );
};

/**
 * KioskPage.tsx
 * Route "/org/:orgId/kiosk/:instanceId": the check-in tablet (SPEC#kiosk,
 * SPEC#fn-startkiosk, G15, X15). Rendered without the app shell. Decides
 * which screen this device shows:
 *   - a token handed over by "Start kiosk" on this device: sign the
 *     coordinator out and sign in as the kiosk (once),
 *   - a valid kiosk token for this shift: the locked KioskScreen,
 *   - an expired or mismatched kiosk token: "Kiosk session expired,
 *     coordinator sign-in", which leads back to this same shift,
 *   - a signed-in person: "Start kiosk on this device",
 *   - signed out: coordinator sign-in.
 * The browser Back button is intercepted while in kiosk mode and opens the
 * Exit panel instead; exiting requires a coordinator sign-in.
 */
import { useCallback, useEffect, useState, type ReactElement } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { clock } from "@fbla/shared";
import { ErrorState } from "@/components/ErrorState";
import { KioskAccessPanel } from "@/components/kiosk/KioskAccessPanel";
import { KioskScreen } from "@/components/kiosk/KioskScreen";
import { LoadingState } from "@/components/LoadingState";
import { useInstance } from "@/hooks/useShiftData";
import { switchToKioskSession } from "@/lib/authClient";
import { takeKioskHandoff } from "@/lib/kioskHandoff";
import { useSession } from "@/store/authStore";

const Centered = ({ children }: { children: ReactElement }): ReactElement => (
  <main id="main" className="flex min-h-dvh items-center justify-center bg-bg px-4">
    {children}
  </main>
);

/** Turns the browser Back button into "open the exit panel" while the kiosk is locked. */
const useBackButtonLock = (isLocked: boolean, onBack: () => void): void => {
  useEffect(() => {
    if (!isLocked) return undefined;
    window.history.pushState({ kioskLock: true }, "");
    const onPopState = (): void => {
      window.history.pushState({ kioskLock: true }, "");
      onBack();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [isLocked, onBack]);
};

const KioskPage = (): ReactElement => {
  const { orgId = "", instanceId = "" } = useParams();
  const navigate = useNavigate();
  const session = useSession();
  const instance = useInstance(instanceId);
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchFailed, setSwitchFailed] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // A token handed over by Start kiosk on this device: switch sessions once.
  useEffect(() => {
    const token = takeKioskHandoff(instanceId);
    if (token === null) return;
    setIsSwitching(true);
    switchToKioskSession(token)
      .catch(() => setSwitchFailed(true))
      .finally(() => setIsSwitching(false));
  }, [instanceId]);

  const isKioskForShift =
    session.status === "kiosk" && session.kiosk.instanceId === instanceId && session.kiosk.expMs > clock.nowMs() && !isExpired;
  const openExit = useCallback(() => setIsExiting(true), []);
  const markExpired = useCallback(() => setIsExpired(true), []);
  useBackButtonLock(isKioskForShift && !isExiting, openExit);

  // A person signing in (after expiry or exit) clears the kiosk-only flags.
  useEffect(() => {
    if (session.status !== "user") return;
    setIsExpired(false);
    setSwitchFailed(false);
  }, [session.status]);

  const shiftTitle = instance.data?.title ?? null;

  if (isSwitching || session.status === "loading" || instance.isLoading) {
    return (
      <Centered>
        <LoadingState label="Starting the kiosk" lines={2} />
      </Centered>
    );
  }
  if (instance.error || instance.data === null || instance.data === undefined) {
    return (
      <Centered>
        <ErrorState title="We couldn't find this shift" description="Check the kiosk link, or start the kiosk again from the coordinator dashboard." />
      </Centered>
    );
  }

  if (isExiting && session.status === "kiosk") {
    return (
      <KioskAccessPanel
        mode="exit"
        instanceId={instanceId}
        shiftTitle={shiftTitle}
        onExited={() => {
          setIsExiting(false);
          navigate(`/org/${orgId}/dashboard`, { replace: true });
        }}
        onCancelExit={() => setIsExiting(false)}
      />
    );
  }
  if (isKioskForShift) {
    return <KioskScreen instance={instance.data} onExit={openExit} onSessionExpired={markExpired} />;
  }
  if (session.status === "kiosk" || switchFailed) {
    return <KioskAccessPanel mode="expired" instanceId={instanceId} shiftTitle={shiftTitle} />;
  }
  if (session.status === "user") return <KioskAccessPanel mode="start" instanceId={instanceId} shiftTitle={shiftTitle} />;
  return <KioskAccessPanel mode="sign-in" instanceId={instanceId} shiftTitle={shiftTitle} />;
};

export default KioskPage;

/**
 * StartKioskControl.tsx
 * "Start kiosk" for one shift (SPEC#fn-startkiosk, SPEC#kiosk step 1, G15).
 * Because this device becomes the kiosk, the coordinator first confirms that
 * they will be signed out here. Confirming calls coordinator.startKiosk, hands
 * the custom token to the kiosk route in memory (kioskHandoff.ts), and opens
 * that route, which signs the coordinator out and signs in as the kiosk.
 */
import { useEffect, useRef, useState, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import { DeviceTablet } from "@phosphor-icons/react";
import type { UserError } from "@fbla/shared";
import { ErrorNotice } from "@/components/errors/ErrorNotice";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { ApiError, NETWORK_USER_ERROR, api } from "@/lib/api";
import { setKioskHandoff } from "@/lib/kioskHandoff";

interface StartKioskControlProps {
  readonly orgId: string;
  readonly instanceId: string;
}

export const kioskPathFor = (orgId: string, instanceId: string): string => `/org/${orgId}/kiosk/${instanceId}`;

export const StartKioskControl = ({ orgId, instanceId }: StartKioskControlProps): ReactElement => {
  const navigate = useNavigate();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<UserError | null>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const confirmTitleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (isConfirming) confirmTitleRef.current?.focus();
  }, [isConfirming]);

  const close = (): void => {
    setIsConfirming(false);
    // Focus goes back to the button that opened the confirmation (D20).
    window.requestAnimationFrame(() => openButtonRef.current?.focus());
  };

  const start = async (): Promise<void> => {
    setIsStarting(true);
    setError(null);
    try {
      const { customToken } = await api.coordinator.startKiosk({ instanceId });
      setKioskHandoff(instanceId, customToken);
      navigate(kioskPathFor(orgId, instanceId));
    } catch (startError) {
      setError(startError instanceof ApiError ? startError.userError : NETWORK_USER_ERROR);
      setIsStarting(false);
    }
  };

  if (!isConfirming) {
    return (
      <div className="flex flex-col gap-2">
        <button ref={openButtonRef} type="button" onClick={() => setIsConfirming(true)} className={buttonClassName("primary")}>
          <DeviceTablet aria-hidden="true" size={18} />
          Start kiosk
        </button>
        {error ? <ErrorNotice error={error} expandDetails /> : null}
      </div>
    );
  }

  return (
    <section aria-labelledby="start-kiosk-title" className="flex max-w-md flex-col gap-3 rounded-lg border border-accent bg-accent-subtle p-4">
      <h3 id="start-kiosk-title" ref={confirmTitleRef} tabIndex={-1} className="font-semibold text-fg outline-none">
        Turn this device into the kiosk?
      </h3>
      <p className="text-sm text-fg">
        Do this on the tablet at the check-in table. You will be signed out on this device, and it will show only the check-in
        code. To leave kiosk mode later, a coordinator signs in again.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void start()} disabled={isStarting} className={buttonClassName("primary")}>
          {isStarting ? "Starting kiosk..." : "Start kiosk on this device"}
        </button>
        <button type="button" onClick={close} disabled={isStarting} className={buttonClassName("quiet")}>
          Cancel
        </button>
      </div>
      {error ? <ErrorNotice error={error} expandDetails /> : null}
    </section>
  );
};

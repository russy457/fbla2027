/**
 * KioskScreen.tsx
 * The locked kiosk display for one shift, shown once this device holds a
 * valid kiosk token (SPEC#kiosk, D4). Left: shift title and the rotating
 * code (or the shift-not-open / ended / cancelled message). Right: live
 * arrivals. An "Exit kiosk" button sits apart in the corner; leaving
 * requires a coordinator to sign in (ExitKioskPanel).
 */
import { useEffect, type ReactElement } from "react";
import { DEFAULT_CONFIG, formatClockTime, kioskCodeWindow } from "@fbla/shared";
import { useKioskCode } from "@/hooks/useKioskCode";
import { useNow } from "@/hooks/useNow";
import type { Instance } from "@/lib/data/instances";
import { ArrivalsList } from "./ArrivalsList";
import { KioskCodeDisplay } from "./KioskCodeDisplay";

interface KioskScreenProps {
  readonly instance: Instance;
  readonly onExit: () => void;
  readonly onSessionExpired: () => void;
}

const BigMessage = ({ children }: { children: string }): ReactElement => (
  <p role="status" className="text-3xl font-semibold text-fg lg:text-4xl">
    {children}
  </p>
);

export const KioskScreen = ({ instance, onExit, onSessionExpired }: KioskScreenProps): ReactElement => {
  const nowMs = useNow();
  const codeWindow = kioskCodeWindow(instance.start.toMillis(), instance.end.toMillis(), DEFAULT_CONFIG);
  const isCancelled = instance.status === "cancelled";
  const hasEnded = instance.status === "finalized" || nowMs > codeWindow.toMs;
  const notOpenYet = nowMs < codeWindow.fromMs;
  const codeState = useKioskCode(instance.id, !isCancelled && !hasEnded && !notOpenYet);

  useEffect(() => {
    if (codeState.kind === "expired") onSessionExpired();
  }, [codeState.kind, onSessionExpired]);

  const codeArea = isCancelled || codeState.kind === "cancelled" ? (
    <BigMessage>This shift was cancelled.</BigMessage>
  ) : hasEnded ? (
    <BigMessage>This shift has ended. Exit kiosk to return.</BigMessage>
  ) : notOpenYet || codeState.kind === "not-open" ? (
    <BigMessage>{`Check-in opens at ${formatClockTime(new Date(codeWindow.fromMs), instance.timeZone)}`}</BigMessage>
  ) : codeState.kind === "loading" || codeState.kind === "live" || codeState.kind === "paused" ? (
    <KioskCodeDisplay state={codeState} />
  ) : null;

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="kiosk-screen-header flex items-start justify-between gap-4 px-6 py-8 lg:px-10 lg:py-10">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-inherit">{instance.orgName}</p>
          <h1 className="text-2xl font-semibold text-inherit lg:text-3xl">{instance.title}</h1>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="inline-flex min-h-touch items-center rounded-full border border-current px-4 text-sm font-semibold text-inherit hover:bg-surface hover:text-fg"
        >
          Exit kiosk
        </button>
      </header>
      <main id="main" className="grid flex-1 grid-cols-1 gap-10 px-6 py-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:px-10">
        <section aria-label="Check-in code" className="flex flex-col justify-center">
          {codeArea}
        </section>
        <ArrivalsList instanceId={instance.id} timeZone={instance.timeZone} />
      </main>
    </div>
  );
};

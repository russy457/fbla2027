/**
 * KioskCodeDisplay.tsx
 * The big rotating check-in code (SPEC#screen-kiosk-states D4). At 1024 px
 * and wider the digits are at least 120 px tall. States:
 *   loading   placeholder where the code goes, announced "Loading code"
 *   live      code + countdown ring; a polite live region says "New code"
 *             each time it changes (the digits themselves are not read out
 *             every 30 seconds)
 *   paused    the last code dimmed and struck through, with "Reconnecting,
 *             codes paused"; an expired code is never shown as live
 */
import { useEffect, useRef, useState, type ReactElement } from "react";
import { WifiSlash } from "@phosphor-icons/react";
import { DEFAULT_CONFIG } from "@fbla/shared";
import type { KioskCodeState } from "@/hooks/useKioskCode";
import { cn } from "@/lib/cn";
import { CountdownRing } from "./CountdownRing";

interface KioskCodeDisplayProps {
  readonly state: Extract<KioskCodeState, { kind: "loading" | "live" | "paused" }>;
}

/**
 * Sized in px on purpose: the kiosk code must stay at least 120 px tall at
 * 1024 px and wider (D19) and stay on one line, whatever text size the
 * device's display preference sets for the rest of the page.
 */
const CODE_CLASSES = "font-mono font-bold whitespace-nowrap leading-none tracking-[0.06em] tabular-nums text-[clamp(72px,11.5vw,168px)]";

/** "482913" -> "482 913": easier to read across a table. */
const spaced = (code: string): string => `${code.slice(0, 3)} ${code.slice(3)}`;

const useAnnouncement = (state: KioskCodeDisplayProps["state"]): string => {
  const [message, setMessage] = useState("Loading code");
  const lastCode = useRef<string | null>(null);
  useEffect(() => {
    if (state.kind === "paused") setMessage("Connection lost, codes paused");
    if (state.kind === "live" && state.code !== lastCode.current) {
      setMessage(lastCode.current === null ? "Code ready" : "New code");
      lastCode.current = state.code;
    }
  }, [state]);
  return message;
};

export const KioskCodeDisplay = ({ state }: KioskCodeDisplayProps): ReactElement => {
  const announcement = useAnnouncement(state);
  return (
    <div className="flex flex-col gap-6">
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <p className="text-lg font-semibold text-fg-muted">Check-in code</p>
      {state.kind === "loading" ? (
        <span aria-hidden="true" className={cn(CODE_CLASSES, "animate-pulse text-fg-subtle")}>
          --- ---
        </span>
      ) : state.kind === "live" ? (
        <span key={state.code} data-testid="kiosk-code" className={cn(CODE_CLASSES, "text-fg motion-safe:animate-[fade-in_var(--duration-base)_ease-out]")}>
          {spaced(state.code)}
        </span>
      ) : (
        <span aria-hidden="true" className={cn(CODE_CLASSES, "text-fg-subtle line-through opacity-50")}>
          {state.lastCode ? spaced(state.lastCode) : "--- ---"}
        </span>
      )}
      <div className="flex items-center gap-5">
        <CountdownRing
          expiresAtMs={state.kind === "live" ? state.expiresAtMs : 0}
          totalSeconds={DEFAULT_CONFIG.kioskRotationSec}
          isPaused={state.kind !== "live"}
        />
        {state.kind === "paused" ? (
          <p role="status" className="flex items-center gap-2 text-xl font-semibold text-status-warning">
            <WifiSlash aria-hidden="true" size={28} weight="bold" />
            Reconnecting, codes paused
          </p>
        ) : (
          <p className="max-w-[32ch] text-lg text-fg-muted">Type this code in the app under My Shifts. It changes every 30 seconds.</p>
        )}
      </div>
    </div>
  );
};

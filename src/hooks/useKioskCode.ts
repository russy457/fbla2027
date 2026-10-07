/**
 * useKioskCode.ts
 * Keeps the kiosk's 6-digit code current (SPEC#kiosk step 2, 5.10, D4).
 *   - Calls kiosk.issueKioskCode at each 30 s window boundary, and again on
 *     visibilitychange, on reconnect, and when the demo clock moves.
 *   - Tracks when the shown code expires on THIS device's clock, so a code is
 *     never presented as live after its window ends: once it is stale and no
 *     fresh code has arrived, the state becomes "paused" (dimmed code,
 *     "Reconnecting, codes paused").
 *   - Maps catalog errors to kiosk states: KIOSK_SESSION_EXPIRED -> expired,
 *     KIOSK_NOT_OPEN -> not open, SHIFT_CANCELLED -> cancelled.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { useClockStore } from "./useNow";

export type KioskCodeState =
  | { readonly kind: "loading" }
  | { readonly kind: "live"; readonly code: string; readonly expiresAtMs: number; readonly qrPayload: string }
  | { readonly kind: "paused"; readonly lastCode: string | null }
  | { readonly kind: "not-open" }
  | { readonly kind: "cancelled" }
  | { readonly kind: "expired" };

/** Ask for the next code a moment after the boundary so the server is surely in the new window. */
const BOUNDARY_DELAY_MS = 400;
/** A code past its window by this much is stale: show "paused", never the old code as live. */
const STALE_AFTER_MS = 1500;
const RETRY_OFFLINE_MS = 5000;
const RETRY_NOT_OPEN_MS = 30_000;
/** The Functions cache the demo offset for 5 s; ask again after that so a clock jump is picked up. */
const DEMO_OFFSET_SETTLE_MS = 5500;

export const useKioskCode = (instanceId: string, enabled: boolean): KioskCodeState => {
  const [state, setState] = useState<KioskCodeState>({ kind: "loading" });
  const timer = useRef<number | null>(null);
  const inFlight = useRef(false);
  const offsetMs = useClockStore((store) => store.offsetMs);

  const schedule = useCallback((delayMs: number, run: () => void) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(run, delayMs);
  }, []);

  const fetchCode = useCallback(async (): Promise<void> => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const out = await api.kiosk.issueKioskCode({ instanceId });
      const expiresAtMs = Date.now() + out.secondsRemaining * 1000;
      setState({ kind: "live", code: out.code, expiresAtMs, qrPayload: out.qrPayload });
      schedule(out.secondsRemaining * 1000 + BOUNDARY_DELAY_MS, () => void fetchCode());
    } catch (error) {
      const code = error instanceof ApiError ? error.userError.code : null;
      if (code === "KIOSK_SESSION_EXPIRED" || code === "AUTH_REQUIRED" || code === "PERMISSION_DENIED") {
        setState({ kind: "expired" });
      } else if (code === "SHIFT_CANCELLED") {
        setState({ kind: "cancelled" });
      } else if (code === "KIOSK_NOT_OPEN") {
        setState({ kind: "not-open" });
        schedule(RETRY_NOT_OPEN_MS, () => void fetchCode());
      } else {
        setState((current) => ({ kind: "paused", lastCode: current.kind === "live" ? current.code : current.kind === "paused" ? current.lastCode : null }));
        schedule(RETRY_OFFLINE_MS, () => void fetchCode());
      }
    } finally {
      inFlight.current = false;
    }
  }, [instanceId, schedule]);

  // Start, and refetch whenever the demo clock offset changes (twice: now, and after the server cache settles).
  useEffect(() => {
    if (!enabled) return undefined;
    void fetchCode();
    const settle = window.setTimeout(() => void fetchCode(), DEMO_OFFSET_SETTLE_MS);
    return () => {
      window.clearTimeout(settle);
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [enabled, fetchCode, offsetMs]);

  // Network and visibility: pause on offline; fetch again on reconnect or when the tab returns.
  useEffect(() => {
    if (!enabled) return undefined;
    const pause = (): void => setState((current) => ({ kind: "paused", lastCode: current.kind === "live" ? current.code : null }));
    const resume = (): void => void fetchCode();
    const onVisibility = (): void => {
      if (document.visibilityState === "visible") resume();
    };
    window.addEventListener("offline", pause);
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("offline", pause);
      window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, fetchCode]);

  // Stale guard: if a live code outlives its window (for example a missed fetch), pause it.
  useEffect(() => {
    if (state.kind !== "live") return undefined;
    const check = window.setInterval(() => {
      if (Date.now() > state.expiresAtMs + STALE_AFTER_MS) {
        setState({ kind: "paused", lastCode: state.code });
        void fetchCode();
      }
    }, 500);
    return () => window.clearInterval(check);
  }, [state, fetchCode]);

  return state;
};

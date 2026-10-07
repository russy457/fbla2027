/**
 * useNow.ts
 * The current time for countdowns and "opens at" checks, read from the one
 * shared clock (SPEC#clock G6) so the demo clock offset applies on every
 * screen. Re-renders every `intervalMs` and immediately when the demo offset
 * changes (Advance clock 15 min), so buttons such as Check out unlock without
 * a reload.
 */
import { useEffect, useState } from "react";
import { create } from "zustand";
import { clock, setOffsetMs } from "@fbla/shared";

interface ClockState {
  readonly offsetMs: number;
  readonly setOffset: (offsetMs: number) => void;
}

/** Mirrors the shared clock's demo offset into React so components can depend on it. */
export const useClockStore = create<ClockState>()((set) => ({
  offsetMs: 0,
  setOffset: (offsetMs) => {
    setOffsetMs(offsetMs);
    set({ offsetMs });
  }
}));

const DEFAULT_TICK_MS = 1000;

export const useNow = (intervalMs: number = DEFAULT_TICK_MS): number => {
  const offsetMs = useClockStore((state) => state.offsetMs);
  const [nowMs, setNowMs] = useState(() => clock.nowMs());

  useEffect(() => {
    setNowMs(clock.nowMs());
    const timer = window.setInterval(() => setNowMs(clock.nowMs()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, offsetMs]);

  return nowMs;
};

/**
 * CountdownRing.tsx
 * The 30-second ring around the seconds left on the current kiosk code
 * (SPEC#kiosk step 2, D4). The ring is decorative (aria-hidden); the number
 * in the middle is the real information. It redraws each second from the
 * code's local expiry time, so it restarts cleanly with every new code.
 * Under reduced motion the stroke still updates but without a transition.
 */
import { useEffect, useState, type ReactElement } from "react";

interface CountdownRingProps {
  readonly expiresAtMs: number;
  readonly totalSeconds: number;
  readonly isPaused: boolean;
}

const RADIUS = 44;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export const secondsLeftUntil = (expiresAtMs: number, nowMs: number, totalSeconds: number): number =>
  Math.max(0, Math.min(totalSeconds, Math.ceil((expiresAtMs - nowMs) / 1000)));

export const CountdownRing = ({ expiresAtMs, totalSeconds, isPaused }: CountdownRingProps): ReactElement => {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const tick = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(tick);
  }, []);

  const secondsLeft = isPaused ? 0 : secondsLeftUntil(expiresAtMs, nowMs, totalSeconds);
  const fraction = secondsLeft / totalSeconds;

  return (
    <div className="relative size-28 shrink-0 lg:size-36">
      <svg aria-hidden="true" viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={RADIUS} fill="none" strokeWidth="8" className="stroke-surface-sunken" />
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
          className="stroke-accent transition-[stroke-dashoffset] duration-(--duration-slow) ease-linear"
        />
      </svg>
      <p className="absolute inset-0 flex flex-col items-center justify-center text-fg">
        <span className="font-mono text-3xl font-semibold tabular-nums lg:text-4xl">{isPaused ? "--" : secondsLeft}</span>
        <span className="text-xs font-medium text-fg-muted">seconds</span>
      </p>
    </div>
  );
};

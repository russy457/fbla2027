/**
 * HoursTotal.tsx
 * The approved-hours total at the top of Impact. CountUp (React Bits, D15)
 * plays only when the total changed since the last time this browser showed
 * it ("on first view after a change, not on every revisit"); otherwise the
 * number renders still. The last seen value is a per-viewer convenience in
 * localStorage, wrapped in try/catch because storage can be blocked.
 */
import { useEffect, useState, type ReactElement } from "react";
import { round2 } from "@fbla/shared";
import CountUp from "@/components/bits/CountUp";

interface HoursTotalProps {
  readonly uid: string;
  readonly hours: number;
}

const storageKey = (uid: string): string => `fbla2027:impact-last-seen-hours:${uid}`;

const readLastSeen = (uid: string): number | null => {
  try {
    const raw = window.localStorage.getItem(storageKey(uid));
    const value = raw === null ? Number.NaN : Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
};

const writeLastSeen = (uid: string, hours: number): void => {
  try {
    window.localStorage.setItem(storageKey(uid), String(hours));
  } catch {
    // Not remembered this time; the number still shows correctly.
  }
};

export const HoursTotal = ({ uid, hours }: HoursTotalProps): ReactElement => {
  const total = round2(hours);
  // Read once per mount: where the count should start from, or null to show the number still.
  const [countFrom] = useState(() => {
    const lastSeen = readLastSeen(uid);
    return lastSeen !== null && lastSeen !== total ? lastSeen : null;
  });

  useEffect(() => writeLastSeen(uid, total), [uid, total]);

  return (
    <p className="flex flex-wrap items-baseline gap-x-3">
      <span className="font-mono text-6xl font-semibold tracking-tight text-fg tabular-nums md:text-7xl">
        {countFrom === null ? (
          total
        ) : (
          <>
            {/* The counting digits are hidden from screen readers; they hear the final number once. */}
            <span aria-hidden="true">
              <CountUp from={countFrom} to={total} duration={1.2} />
            </span>
            <span className="sr-only">{total}</span>
          </>
        )}
      </span>
      <span className="text-lg font-medium text-fg-muted">approved {total === 1 ? "hour" : "hours"}</span>
    </p>
  );
};

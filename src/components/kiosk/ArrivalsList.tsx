/**
 * ArrivalsList.tsx
 * Live arrivals on the kiosk (SPEC#kiosk step 4, D4, D15). Reads the shift's
 * signups with the kiosk token (display names and status only; contact data
 * lives elsewhere and the kiosk cannot read it). Rows enter through
 * AnimatedList (static under reduced motion), newest first; each new
 * check-in is announced as "{name} checked in". Row styles per D4:
 * checked-in (success + check), checked-out (neutral + done), no-show
 * (danger + x, after finalize), and a "Walk-up" tag.
 */
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { formatInTimeZone } from "date-fns-tz";
import AnimatedList from "@/components/bits/AnimatedList";
import { StatusBadge, type StatusTone } from "@/components/ui/StatusBadge";
import { useRoster } from "@/hooks/useShiftData";
import type { Signup } from "@/lib/data/signups";

interface ArrivalsListProps {
  readonly instanceId: string;
  readonly timeZone: string;
}

const ROW_STYLE: Partial<Record<Signup["status"], { tone: StatusTone; label: string }>> = {
  "checked-in": { tone: "success", label: "Checked in" },
  completed: { tone: "neutral", label: "Checked out" },
  "no-show": { tone: "danger", label: "No-show" }
};

const arrivedAtMs = (signup: Signup): number => signup.checkInAt?.toMillis() ?? 0;

export const ArrivalsList = ({ instanceId, timeZone }: ArrivalsListProps): ReactElement => {
  const roster = useRoster(instanceId, null);
  const arrivals = useMemo(
    () => (roster.data ?? []).filter((signup) => ROW_STYLE[signup.status] !== undefined).sort((a, b) => arrivedAtMs(b) - arrivedAtMs(a)),
    [roster.data]
  );
  const checkedInCount = arrivals.filter((signup) => signup.status === "checked-in" || signup.status === "completed").length;

  // Announce each new check-in once, without moving focus.
  const announced = useRef<Set<string> | null>(null);
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    const checkedIn = arrivals.filter((signup) => signup.status === "checked-in");
    if (announced.current !== null) {
      const fresh = checkedIn.filter((signup) => !announced.current?.has(signup.id));
      if (fresh.length > 0) setAnnouncement(fresh.map((signup) => `${signup.displayName} checked in`).join(". "));
    }
    announced.current = new Set(checkedIn.map((signup) => signup.id));
  }, [arrivals]);

  return (
    <section aria-labelledby="arrivals-title" className="flex min-h-0 flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="arrivals-title" className="text-2xl font-semibold text-fg">
          Arrivals
        </h2>
        <p className="font-mono text-lg text-fg-muted">
          <span className="font-semibold text-fg">{checkedInCount}</span> checked in
        </p>
      </div>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {roster.error ? (
        <p role="alert" className="text-fg-muted">
          Arrivals can't load right now. Check-in still works.
        </p>
      ) : arrivals.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border-strong p-6 text-center text-lg text-fg-muted">No arrivals yet</p>
      ) : (
        <AnimatedList
          items={arrivals}
          label="Volunteers who have arrived"
          getKey={(signup) => signup.id}
          showGradients={false}
          enableArrowNavigation
          renderItem={(signup) => {
            const style = ROW_STYLE[signup.status] ?? { tone: "neutral" as const, label: signup.status };
            return (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-lg font-semibold text-fg">{signup.displayName}</span>
                <span className="flex items-center gap-3">
                  {signup.walkUp ? <span className="text-sm font-medium text-fg-muted">Walk-up</span> : null}
                  {signup.checkInAt ? (
                    <span className="font-mono text-sm text-fg-muted">{formatInTimeZone(signup.checkInAt.toDate(), timeZone, "h:mm a")}</span>
                  ) : null}
                  <StatusBadge tone={style.tone} label={style.label} />
                </span>
              </div>
            );
          }}
        />
      )}
    </section>
  );
};

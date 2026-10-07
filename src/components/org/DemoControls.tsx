/**
 * DemoControls.tsx
 * The labeled "Demo controls" box (SPEC#clock X12, D11, SPEC 5.11). Rendered
 * only in demo mode. Advance clock 15 min and Reset clock call
 * admin.setDemoClock; Run due jobs calls admin.runDueJobs (the same work the
 * 5-minute scheduler does, which never fires on the emulators). Both ops need
 * the admin claim, so a non-admin sees the buttons disabled with the reason.
 * Errors show expanded details (D22, coordinators and admins).
 */
import { useState, type ReactElement } from "react";
import { Flask } from "@phosphor-icons/react";
import type { UserError } from "@fbla/shared";
import { ErrorNotice } from "@/components/errors/ErrorNotice";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { ApiError, NETWORK_USER_ERROR, api } from "@/lib/api";
import { isDemoMode } from "@/lib/demoMode";
import { useSessionUser } from "@/store/authStore";

type Action = "advance" | "reset" | "jobs";

const minutesOf = (offsetMs: number): number => Math.round(offsetMs / 60_000);

export const DemoControls = (): ReactElement | null => {
  const user = useSessionUser();
  const [pending, setPending] = useState<Action | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<UserError | null>(null);

  if (!isDemoMode()) return null;
  const isAdmin = user?.isAdmin === true;

  const run = async (action: Action): Promise<void> => {
    setPending(action);
    setError(null);
    setResult(null);
    try {
      if (action === "jobs") {
        const out = await api.admin.runDueJobs({});
        setResult(`Due jobs ran (${out.outcome}): ${out.processed.finalized} shifts finalized, ${out.processed.cutoffs} waitlist cutoffs.`);
      } else {
        const out = await api.admin.setDemoClock(action === "advance" ? { advanceMinutes: 15 } : { offsetMs: 0 });
        setResult(out.offsetMs === 0 ? "Demo clock reset to real time." : `Demo clock is ${minutesOf(out.offsetMs)} minutes ahead.`);
      }
    } catch (runError) {
      setError(runError instanceof ApiError ? runError.userError : NETWORK_USER_ERROR);
    } finally {
      setPending(null);
    }
  };

  const button = (action: Action, label: string, busyLabel: string): ReactElement => (
    <button type="button" disabled={!isAdmin || pending !== null} onClick={() => void run(action)} className={buttonClassName("secondary")}>
      {pending === action ? busyLabel : label}
    </button>
  );

  return (
    <section aria-labelledby="demo-controls-title" className="flex flex-col gap-3 rounded-lg border-2 border-dashed border-status-warning bg-status-warning-subtle p-4">
      <h2 id="demo-controls-title" className="flex items-center gap-2 font-semibold text-fg">
        <Flask aria-hidden="true" size={20} />
        Demo controls
      </h2>
      <p className="text-sm text-fg">For rehearsing the demo only. These change time and run background jobs for everyone on this site.</p>
      {isAdmin ? null : <p className="text-sm font-medium text-fg">Sign in with the admin demo account to use these controls.</p>}
      <div className="flex flex-wrap gap-2">
        {button("advance", "Advance clock 15 min", "Advancing...")}
        {button("reset", "Reset clock", "Resetting...")}
        {button("jobs", "Run due jobs", "Running...")}
      </div>
      {result ? (
        <p role="status" className="text-sm font-medium text-fg">
          {result}
        </p>
      ) : null}
      {error ? <ErrorNotice error={error} expandDetails /> : null}
    </section>
  );
};

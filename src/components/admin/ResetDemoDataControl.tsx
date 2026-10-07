/**
 * ResetDemoDataControl.tsx
 * The admin "Reset demo data" control (SPEC 9.2 Admin row, E1). Calls
 * admin.resetDemoData, which wipes every document and reseeds the demo
 * (server refuses unless the caller is an admin and DEMO_MODE is on).
 * Because it deletes everything, it asks for a second, explicit confirm and
 * says what will happen. After success the page reloads so every screen
 * re-reads the fresh data and the refreshed demo session.
 */
import { useState, type ReactElement } from "react";
import { ArrowCounterClockwise } from "@phosphor-icons/react";
import type { UserError } from "@fbla/shared";
import { ErrorNotice } from "@/components/errors/ErrorNotice";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { ApiError, NETWORK_USER_ERROR, api } from "@/lib/api";
import { isDemoMode } from "@/lib/demoMode";
import { useSessionUser } from "@/store/authStore";

type Phase = "idle" | "confirming" | "resetting" | "done";

interface ResetDemoDataControlProps {
  /** Called after a successful reset; the app reloads the page. */
  readonly onReset?: () => void;
}

const reloadPage = (): void => window.location.reload();

export const ResetDemoDataControl = ({ onReset = reloadPage }: ResetDemoDataControlProps): ReactElement | null => {
  const user = useSessionUser();
  const [phase, setPhase] = useState<Phase>("idle");
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<UserError | null>(null);

  if (!isDemoMode()) return null;
  const isAdmin = user?.isAdmin === true;

  const reset = async (): Promise<void> => {
    setPhase("resetting");
    setError(null);
    try {
      const out = await api.admin.resetDemoData({});
      setSummary(`Demo data reset: ${out.documents} documents written. The demo shift starts at ${new Date(out.demoShiftStartsAt).toLocaleTimeString()}.`);
      setPhase("done");
      onReset();
    } catch (resetError) {
      setError(resetError instanceof ApiError ? resetError.userError : NETWORK_USER_ERROR);
      setPhase("idle");
    }
  };

  return (
    <section aria-labelledby="reset-demo-title" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <h2 id="reset-demo-title" className="flex items-center gap-2 font-semibold text-fg">
        <ArrowCounterClockwise aria-hidden="true" size={20} />
        Reset demo data
      </h2>
      <p className="text-sm text-fg-muted">
        Deletes every shift, signup, hours log, and letter, then reloads the demo organizations, people, and history. The demo
        shift will start 10 minutes from now. Demo control.
      </p>
      {phase === "confirming" ? (
        <div role="group" aria-label="Confirm reset" className="flex flex-wrap items-center gap-2">
          <p className="w-full text-sm font-semibold text-status-danger">This cannot be undone. Reset all demo data now?</p>
          <button type="button" onClick={() => void reset()} className={buttonClassName("primary")}>
            Yes, reset demo data
          </button>
          <button type="button" onClick={() => setPhase("idle")} className={buttonClassName("secondary")}>
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={!isAdmin || phase === "resetting"}
          onClick={() => setPhase("confirming")}
          className={buttonClassName("secondary", "self-start")}
        >
          {phase === "resetting" ? "Resetting..." : "Reset demo data"}
        </button>
      )}
      {!isAdmin ? <p className="text-sm text-fg-muted">Only admins can reset demo data.</p> : null}
      <div aria-live="polite" className="empty:hidden">
        {summary ? <p className="text-sm text-fg">{summary}</p> : null}
      </div>
      {error ? <ErrorNotice error={error} expandDetails /> : null}
    </section>
  );
};

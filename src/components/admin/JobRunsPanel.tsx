/**
 * JobRunsPanel.tsx
 * Background job health on the admin page (SPEC 9.2 "Admin", SPEC 5.11,
 * 10.17 G23): when runDueJobs last ran (relative and absolute time), the
 * recent jobRuns with trigger, outcome, processed counts, and errors, and the
 * primary action "Run due jobs now" (admin.runDueJobs). The list is live, so
 * a run started here appears as soon as it finishes.
 *   JobRunsPanel      container (live jobRuns)
 *   JobRunsView       presentational (tested directly)
 */
import type { ReactElement } from "react";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { OpFeedback } from "@/components/org/OpFeedback";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { StatusBadge, type StatusTone } from "@/components/ui/StatusBadge";
import { useJobRuns } from "@/hooks/useAdminData";
import { useNow } from "@/hooks/useNow";
import { useOpRunner } from "@/hooks/useOpRunner";
import { api } from "@/lib/api";
import type { JobRun } from "@/lib/data/adminData";

const OUTCOME_TONES: Readonly<Record<JobRun["outcome"], StatusTone>> = { ok: "success", partial: "warning", error: "danger", "skipped-lease": "neutral" };

const absolute = (ms: number): string => new Date(ms).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "medium" });

/** "just now", "4 minutes ago", "3 hours ago", "2 days ago". */
export const relativeTime = (ms: number, nowMs: number): string => {
  const minutes = Math.floor(Math.max(0, nowMs - ms) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return `${Math.floor(hours / 24)} days ago`;
};

export const JobRunsView = ({ runs, nowMs }: { runs: readonly JobRun[]; nowMs: number }): ReactElement => {
  const runner = useOpRunner();
  const latest = runs[0];
  return (
    <section aria-labelledby="jobs-title" className="flex flex-col gap-4">
      <h2 id="jobs-title" className="text-xl font-semibold text-fg">Background jobs</h2>
      <p className="text-fg">
        <span className="font-semibold">Last run: </span>
        {latest ? `${relativeTime(latest.finishedAt.toMillis(), nowMs)} (${absolute(latest.finishedAt.toMillis())})` : "No runs yet"}
      </p>
      <button
        type="button"
        disabled={runner.pending !== null}
        onClick={() => void runner.run("run", () => api.admin.runDueJobs({}), (out) => `Due jobs ran (${out.outcome}): ${out.processed.finalized} finalized, ${out.processed.cutoffs} waitlist cutoffs.`)}
        className={buttonClassName("primary", "w-fit")}
      >
        {runner.pending ? "Running..." : "Run due jobs now"}
      </button>
      <OpFeedback message={runner.message} error={runner.error} />
      {runs.length > 0 ? (
        <ul className="divide-y divide-border" aria-label="Recent job runs">
          {runs.map((run) => (
            <li key={run.id} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="font-mono text-fg">{absolute(run.startedAt.toMillis())}</span>
              <span className="text-fg-muted">
                {run.trigger === "admin" ? "Run by an admin" : "Scheduled"}: {run.processed.finalized} finalized, {run.processed.cutoffs} cutoffs
                {run.errors.length > 0 ? `, ${run.errors.length} errors` : ""}
              </span>
              <StatusBadge tone={OUTCOME_TONES[run.outcome]} label={run.outcome} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
};

export const JobRunsPanel = (): ReactElement => {
  const runs = useJobRuns();
  const nowMs = useNow(30_000);
  if (runs.error) return <ErrorState title="We couldn't load job history" description="Check your connection, then reload." />;
  if (runs.isLoading) return <LoadingState label="Loading job history" lines={2} />;
  return <JobRunsView runs={runs.data ?? []} nowMs={nowMs} />;
};

/**
 * SeriesSignupPanel.tsx
 * "Sign up for the whole series" on the opportunity page (Tier 2, SPEC 5.2,
 * 9.4). Shown for a shift that belongs to a recurring series: the rule in
 * plain words, one button that runs volunteer.signupSeries, then the result
 * as a date list with Signed up / Waitlisted / Skipped chips (icon + text,
 * D14) and "Series signup covers through DATE".
 *
 * The series does not follow the volunteer automatically (SPEC "no
 * auto-extend"): once the organization adds later dates, a one-click Extend
 * (volunteer.extendSeriesSignup) signs up for only those. No optimistic UI:
 * the coverage line re-renders from the live seriesSignups record.
 */
import { useState, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import { Repeat } from "@phosphor-icons/react";
import { describeSeriesRule, formatYmd, lastMaterializedDate, type SeriesSignupOutput, type UserError } from "@fbla/shared";
import { ErrorNotice } from "@/components/errors/ErrorNotice";
import { loginPathFor } from "@/components/guards/RouteGuards";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useMySeriesSignup, useSeries } from "@/hooks/useSeries";
import { toUserErrorOrNetwork } from "@/hooks/useOpRunner";
import { api } from "@/lib/api";
import { seriesOutcomeView } from "@/lib/seriesForm";

interface SeriesSignupPanelProps {
  readonly seriesId: string;
  readonly uid: string | null;
  readonly returnPath: string;
}

const ResultList = ({ output }: { output: SeriesSignupOutput }): ReactElement => (
  <ul aria-label="Series signup results" className="flex flex-col divide-y divide-border">
    {output.results.map((result) => {
      const view = seriesOutcomeView(result);
      return (
        <li key={result.instanceId} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <span className="font-mono text-sm text-fg">{formatYmd(result.date)}</span>
          <StatusBadge tone={view.tone} label={view.label} />
        </li>
      );
    })}
  </ul>
);

export const SeriesSignupPanel = ({ seriesId, uid, returnPath }: SeriesSignupPanelProps): ReactElement | null => {
  const navigate = useNavigate();
  const series = useSeries(seriesId);
  const record = useMySeriesSignup(seriesId, uid);
  const [pending, setPending] = useState<"signup" | "extend" | null>(null);
  const [output, setOutput] = useState<SeriesSignupOutput | null>(null);
  const [error, setError] = useState<UserError | null>(null);

  if (!series.data) return null;
  const covered = record.data?.coversThrough ?? null;
  const lastDate = lastMaterializedDate(series.data.materializedThrough.toMillis(), series.data.timeZone);
  const canExtend = covered !== null && lastDate > covered;

  const run = async (kind: "signup" | "extend"): Promise<void> => {
    if (uid === null) {
      navigate(loginPathFor(returnPath));
      return;
    }
    setPending(kind);
    setError(null);
    try {
      setOutput(kind === "signup" ? await api.volunteer.signupSeries({ seriesId }) : await api.volunteer.extendSeriesSignup({ seriesId }));
    } catch (runError) {
      setError(toUserErrorOrNetwork(runError));
    } finally {
      setPending(null);
    }
  };

  return (
    <section aria-labelledby="series-signup" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <h2 id="series-signup" className="flex items-center gap-2 text-xl font-semibold text-fg">
        <Repeat aria-hidden="true" size={22} />
        This shift repeats
      </h2>
      <p className="text-fg">{describeSeriesRule(series.data.rule)}.</p>
      {covered !== null ? (
        <p role="status" className="text-sm font-medium text-fg">
          Series signup covers through {formatYmd(covered)}.
        </p>
      ) : (
        <p className="text-sm text-fg-muted">Sign up for every upcoming date at once. Full dates put you on the waitlist; dates you can't join are skipped, not lost.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {covered === null ? (
          <button type="button" onClick={() => void run("signup")} disabled={pending !== null} className={buttonClassName("primary")}>
            {pending === "signup" ? "Signing up..." : uid === null ? "Sign in to sign up for the whole series" : "Sign up for the whole series"}
          </button>
        ) : null}
        {canExtend ? (
          <button type="button" onClick={() => void run("extend")} disabled={pending !== null} className={buttonClassName("primary")}>
            {pending === "extend" ? "Extending..." : `Extend through ${formatYmd(lastDate)}`}
          </button>
        ) : null}
      </div>
      {output !== null && output.results.length === 0 ? <p className="text-sm text-fg-muted">No new dates to sign up for yet.</p> : null}
      {output !== null && output.results.length > 0 ? <ResultList output={output} /> : null}
      {error ? <ErrorNotice error={error} /> : null}
    </section>
  );
};

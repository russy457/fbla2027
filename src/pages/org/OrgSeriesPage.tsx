/**
 * OrgSeriesPage.tsx
 * Route "/org/:orgId/series/:seriesId" (Tier 2, SPEC 3.7): one recurring
 * series for its coordinators. Shows the rule in plain words, how far shifts
 * exist ("Shifts created through DATE"), and the upcoming dates with seats,
 * each linking to its shift page. Secondary actions: Create dates now
 * (extendSeries; the scheduler also does this weekly) and Edit series
 * (upsertSeries). An edit moves empty future shifts to the new rule and
 * leaves shifts that already have volunteers alone, and says so.
 */
import type { ReactElement } from "react";
import { Link, useParams } from "react-router-dom";
import { describeSeriesRule, formatShiftTime, formatYmd, lastMaterializedDate } from "@fbla/shared";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { OpFeedback } from "@/components/org/OpFeedback";
import { OrgPageShell } from "@/components/org/OrgPageShell";
import { SeriesForm } from "@/components/org/SeriesForm";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useNow } from "@/hooks/useNow";
import { useOpRunner } from "@/hooks/useOpRunner";
import { useSeries, useSeriesInstances } from "@/hooks/useSeries";
import { api } from "@/lib/api";
import type { Instance } from "@/lib/data/instances";
import type { Series } from "@/lib/data/series";
import { seriesFormFromDoc, type SeriesInput } from "@/lib/seriesForm";

const SUMMARY_CLASS = "inline-flex min-h-touch cursor-pointer items-center text-lg font-semibold text-fg";

/** "Saved. 2 shifts moved, 1 removed, 1 kept because volunteers signed up." */
const editMessage = (out: { materialized: number; rescheduled: number; removed: number; keptWithVolunteers: number }): string => {
  const parts = [
    out.materialized > 0 ? `${out.materialized} added` : null,
    out.rescheduled > 0 ? `${out.rescheduled} updated` : null,
    out.removed > 0 ? `${out.removed} removed` : null,
    out.keptWithVolunteers > 0 ? `${out.keptWithVolunteers} kept as they were because volunteers signed up (edit those one by one)` : null
  ].filter((part): part is string => part !== null);
  return parts.length === 0 ? "Series saved. No shifts changed." : `Series saved. Shifts: ${parts.join(", ")}.`;
};

const UpcomingDates = ({ orgId, shifts }: { orgId: string; shifts: readonly Instance[] }): ReactElement => (
  <section aria-labelledby="series-dates" className="flex flex-col gap-2">
    <h2 id="series-dates" className="border-b border-border-strong pb-2 text-sm font-semibold text-fg-muted">
      Upcoming dates
    </h2>
    {shifts.length === 0 ? <p className="text-fg-muted">No upcoming dates yet.</p> : null}
    <ul className="divide-y divide-border">
      {shifts.map((shift) => (
        <li key={shift.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
          <Link to={`/org/${orgId}/shifts/${shift.id}`} className="font-mono text-sm font-semibold text-accent underline underline-offset-2">
            {formatShiftTime(shift.start.toDate(), shift.timeZone)}
          </Link>
          <span className="flex items-center gap-2 text-sm text-fg-muted">
            {shift.signupCount} of {shift.capacity} signed up
            {shift.status === "cancelled" ? <StatusBadge tone="neutral" label="Cancelled" /> : null}
          </span>
        </li>
      ))}
    </ul>
  </section>
);

const SeriesBody = ({ orgId, series, nowMs }: { orgId: string; series: Series; nowMs: number }): ReactElement => {
  const shifts = useSeriesInstances(series.opportunityId, series.id);
  const runner = useOpRunner();
  const upcoming = (shifts.data ?? []).filter((shift) => shift.end.toMillis() > nowMs);
  const through = lastMaterializedDate(series.materializedThrough.toMillis(), series.timeZone);

  const extend = (): void => {
    void runner.run("extend", () => api.coordinator.extendSeries({ seriesId: series.id }), (out) => (out.created > 0 ? `Created ${out.created} more shifts.` : "Every date in the next 8 weeks already has a shift."));
  };
  const save = (input: SeriesInput): void => {
    void runner.run("save", () => api.coordinator.upsertSeries({ opportunityId: series.opportunityId, ...input }), editMessage);
  };

  return (
    <>
      <section aria-label="Series status" className="flex flex-col gap-3 border-l-4 border-accent bg-surface py-4 pr-4 pl-5">
        <p className="text-xl font-semibold text-fg">{describeSeriesRule(series.rule)}</p>
        <p className="text-fg-muted">
          {series.capacity} seats per shift. Starts {formatYmd(series.startsOn)}
          {series.endsOn ? `, ends ${formatYmd(series.endsOn)}` : ", no end date"}. Shifts created through {formatYmd(through)}.
        </p>
        <button type="button" onClick={extend} disabled={runner.pending !== null} className={buttonClassName("secondary", "w-fit")}>
          {runner.pending === "extend" ? "Creating..." : "Create dates now"}
        </button>
      </section>
      <OpFeedback message={runner.message} error={runner.error} />
      {shifts.error ? <ErrorState title="We couldn't load the dates" description="Check your connection, then reload." /> : null}
      {shifts.isLoading ? <LoadingState label="Loading dates" lines={3} /> : <UpcomingDates orgId={orgId} shifts={upcoming} />}
      <details className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <summary className={SUMMARY_CLASS}>Edit series</summary>
        <p className="text-sm text-fg-muted">Empty future shifts follow the new schedule. Shifts with volunteers stay as they are, so nobody's plans change without a notice.</p>
        <SeriesForm timeZone={series.timeZone} nowMs={nowMs} initial={seriesFormFromDoc(series)} submitLabel="Save series" isPending={runner.pending === "save"} onSubmit={save} />
      </details>
    </>
  );
};

const OrgSeriesPage = (): ReactElement => {
  const { orgId = "", seriesId = "" } = useParams();
  const nowMs = useNow(60_000);
  const series = useSeries(seriesId || null);

  if (series.error) return <ErrorState title="We couldn't load this series" description="Check your connection, then reload." />;
  if (series.isLoading) return <LoadingState label="Loading the series" />;
  if (!series.data || series.data.orgId !== orgId) return <ErrorState title="Series not found" description="It may have been removed. Go back to Shifts." />;

  return (
    <OrgPageShell title="Recurring series" intro="One schedule, many shifts. Volunteers can sign up for every date at once.">
      <SeriesBody orgId={orgId} series={series.data} nowMs={nowMs} />
    </OrgPageShell>
  );
};

export default OrgSeriesPage;

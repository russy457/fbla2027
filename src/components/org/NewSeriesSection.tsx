/**
 * NewSeriesSection.tsx
 * "Repeats" on the new-shift page (Tier 2, SPEC 3.7, 9.2 Shifts /new): the
 * SeriesForm pre-filled from the plain-words planner (its date's weekday,
 * times, and head count) or from tomorrow 9-1, saved with
 * coordinator.upsertSeries. The series id comes from the opportunity, so a
 * double click or a retry lands on the same series. Opens the series page
 * after saving, where the created dates are listed.
 */
import type { ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import { weekdayOfYmd } from "@fbla/shared";
import { useOpRunner } from "@/hooks/useOpRunner";
import { api } from "@/lib/api";
import type { SeriesFormValues, SeriesInput } from "@/lib/seriesForm";
import { OpFeedback } from "./OpFeedback";
import { SeriesForm } from "./SeriesForm";

export interface SeriesStart {
  readonly date: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly capacity: number;
}

interface NewSeriesSectionProps {
  readonly orgId: string;
  readonly opportunityId: string;
  readonly timeZone: string;
  readonly nowMs: number;
  readonly start: SeriesStart;
}

/** A weekly series on the starting date's weekday. */
export const initialSeriesValues = (start: SeriesStart): SeriesFormValues => ({
  frequency: "weekly",
  weekdays: [weekdayOfYmd(start.date)],
  monthWeek: 1,
  startTime: start.startTime,
  endTime: start.endTime,
  capacity: String(start.capacity),
  startsOn: start.date,
  endsOn: ""
});

export const NewSeriesSection = ({ orgId, opportunityId, timeZone, nowMs, start }: NewSeriesSectionProps): ReactElement => {
  const runner = useOpRunner();
  const navigate = useNavigate();

  const save = async (input: SeriesInput): Promise<void> => {
    const result = await runner.run("series", () => api.coordinator.upsertSeries({ opportunityId, ...input }), (out) => `Series saved: ${out.materialized} shifts created.`);
    if (result) navigate(`/org/${orgId}/series/${result.seriesId}`);
  };

  return (
    <div className="flex flex-col gap-3">
      <SeriesForm timeZone={timeZone} nowMs={nowMs} initial={initialSeriesValues(start)} submitLabel="Create series" isPending={runner.pending === "series"} onSubmit={(input) => void save(input)} />
      <OpFeedback message={runner.message} error={runner.error} />
    </div>
  );
};

/**
 * ReliabilityPreview.tsx
 * On-screen reliability charts in the report preview (Tier 2 lane B, SPEC
 * 8.6, SPEC 7.2, D12). They draw the same shared aggregation the PDF draws
 * (functions/src/reports/pdf/sections/reliabilityCharts.ts), with the same
 * labels and value text, so preview and download always agree.
 *
 *   OrgReliabilityPreview      volunteers per attendance band, counts only
 *   TrackRecordPreview         the volunteer's attended / no-shows / late
 *                              cancels and "Attended 8 of 10 recent shifts"
 */
import type { ReactElement } from "react";
import type { ReliabilityDistribution, TrackRecordReport } from "@fbla/shared";
import { BarChart } from "@/components/charts/BarChart";

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? "" : "s"}`;
const EMPTY = <p className="text-sm text-fg-muted">No finished shifts in this range.</p>;

export const OrgReliabilityPreview = ({ distribution }: { distribution: ReliabilityDistribution }): ReactElement => {
  if (distribution.volunteers === 0) return EMPTY;
  const data = distribution.buckets.map((row) => ({ key: row.bucket, label: row.label, value: row.volunteers, valueLabel: plural(row.volunteers, "volunteer") }));
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-fg-muted">
        Share of finished shifts each volunteer attended in this range (late cancels count half). {plural(distribution.volunteers, "volunteer")} finished at least one shift.
      </p>
      <BarChart
        title="Reliability distribution"
        description={data.map((row) => `${row.label}: ${row.valueLabel}`).join("; ")}
        data={data}
        valueHeader="Volunteers"
      />
    </div>
  );
};

export const TrackRecordPreview = ({ record }: { record: TrackRecordReport }): ReactElement => {
  if (record.total === 0) return EMPTY;
  const data = record.rows.map((row) => ({ key: row.key, label: row.label, value: row.count, valueLabel: plural(row.count, "shift") }));
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-fg">{record.summary}</p>
      <BarChart title="Track record" description={`${record.summary}. ${data.map((row) => `${row.label}: ${row.valueLabel}`).join("; ")}`} data={data} valueHeader="Shifts" />
    </div>
  );
};

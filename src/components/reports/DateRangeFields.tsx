/**
 * DateRangeFields.tsx
 * From / To date inputs for a report (SPEC 8.6 "date range"). Dates are
 * calendar days (YYYY-MM-DD) read in the report's time zone. The default
 * range starts on the first day of the month three months back and ends
 * today, both from the shared clock so the demo offset applies (SPEC#clock).
 */
import type { ReactElement } from "react";
import { localDateIn } from "@fbla/shared";
import { TextField } from "@/components/ui/TextField";

export interface DateRange {
  readonly from: string;
  readonly to: string;
}

const MONTHS_BACK = 3;

/** { from: first of the month MONTHS_BACK months ago, to: today } in the zone. */
export const defaultReportRange = (nowMs: number, timeZone: string): DateRange => {
  const today = localDateIn(new Date(nowMs), timeZone);
  const [year, month] = today.split("-").map(Number) as [number, number];
  const index = year * 12 + (month - 1) - MONTHS_BACK;
  const from = `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}-01`;
  return { from, to: today };
};

export const rangeError = (range: DateRange): string | null =>
  range.from === "" || range.to === "" ? "Pick both dates." : range.from > range.to ? "The start date must be on or before the end date." : null;

interface DateRangeFieldsProps {
  readonly value: DateRange;
  readonly max: string;
  readonly onChange: (next: DateRange) => void;
}

export const DateRangeFields = ({ value, max, onChange }: DateRangeFieldsProps): ReactElement => {
  const error = rangeError(value);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-semibold text-fg">Dates</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="From" type="date" value={value.from} max={max} onChange={(event) => onChange({ ...value, from: event.target.value })} />
        <TextField label="To" type="date" value={value.to} max={max} error={error ?? undefined} onChange={(event) => onChange({ ...value, to: event.target.value })} />
      </div>
    </fieldset>
  );
};

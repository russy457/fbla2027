/**
 * SeriesForm.tsx
 * The repeat rule for a recurring shift (Tier 2, SPEC 3.7): how often (every
 * week, every other week, or once a month on the 1st-4th or last weekday),
 * which weekdays, local start and end times in the org zone (D24), seats,
 * and the first and optional last date. A plain-English summary ("Every
 * Saturday, 9:00 AM to 1:00 PM") updates as the coordinator edits, so they
 * can read back what they are about to create. Checks match the server's
 * SERIES_RULE_INVALID rule (lib/seriesForm.ts); errors sit next to fields.
 * Weekdays are real checkboxes styled as chips, so keyboard and screen
 * readers get native semantics.
 */
import { useId, useState, type FormEvent, type ReactElement } from "react";
import { MAX_CAPACITY, MONTH_WEEKS, WEEKDAY_NAMES, describeSeriesRule, type MonthWeek, type SeriesFrequency } from "@fbla/shared";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { INPUT_CLASSES, TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import { toSeriesInput, type SeriesField, type SeriesFormValues, type SeriesInput } from "@/lib/seriesForm";
import { zoneLabel } from "@/lib/shiftForm";

interface SeriesFormProps {
  readonly timeZone: string;
  readonly nowMs: number;
  readonly initial: SeriesFormValues;
  readonly submitLabel: string;
  readonly isPending: boolean;
  readonly onSubmit: (input: SeriesInput) => void;
}

const FREQUENCIES: ReadonlyArray<{ value: SeriesFrequency; label: string }> = [
  { value: "weekly", label: "Every week" },
  { value: "biweekly", label: "Every other week" },
  { value: "monthly", label: "Once a month" }
];

const MONTH_WEEK_LABELS: Readonly<Record<MonthWeek, string>> = { 1: "First", 2: "Second", 3: "Third", 4: "Fourth", [-1]: "Last" };

/** Monday-first, the way people read a week. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

const CHIP_CLASSES =
  "relative inline-flex min-h-touch min-w-touch cursor-pointer items-center justify-center rounded-full border border-border-strong px-3 text-sm font-semibold text-fg " +
  "transition-colors duration-(--duration-fast) hover:bg-surface-sunken has-[:checked]:border-accent has-[:checked]:bg-accent has-[:checked]:text-accent-fg " +
  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus";

type Errors = Partial<Record<SeriesField, string>>;

export const SeriesForm = ({ timeZone, nowMs, initial, submitLabel, isPending, onSubmit }: SeriesFormProps): ReactElement => {
  const [values, setValues] = useState<SeriesFormValues>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const ids = { frequency: useId(), weekdaysError: useId(), monthWeek: useId() };
  const zone = zoneLabel(timeZone, nowMs);
  const preview = toSeriesInput(values);
  const set = (patch: Partial<SeriesFormValues>): void => setValues((current) => ({ ...current, ...patch }));
  const toggleDay = (day: number, on: boolean): void =>
    set({ weekdays: on ? [...values.weekdays, day] : values.weekdays.filter((item) => item !== day) });

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (!preview.ok) return setErrors({ [preview.field]: preview.message });
    setErrors({});
    onSubmit(preview.input);
  };

  return (
    <form onSubmit={submit} noValidate className="flex max-w-2xl flex-col gap-5">
      <p className="text-sm text-fg-muted">Times are in the organization's time zone ({timeZone}, {zone}). Shifts are created 8 weeks ahead and extended automatically.</p>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold text-fg">How often</legend>
        <div className="flex flex-wrap gap-2">
          {FREQUENCIES.map((option) => (
            <label key={option.value} className={CHIP_CLASSES}>
              <input type="radio" name={ids.frequency} value={option.value} checked={values.frequency === option.value} onChange={() => set({ frequency: option.value })} className="absolute inset-0 m-0 cursor-pointer opacity-0" />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      {values.frequency === "monthly" ? (
        <div className="flex max-w-xs flex-col gap-2">
          <label htmlFor={ids.monthWeek} className="text-sm font-semibold text-fg">
            Week of the month
          </label>
          <select id={ids.monthWeek} value={values.monthWeek} onChange={(event) => set({ monthWeek: Number(event.target.value) as MonthWeek })} className={INPUT_CLASSES}>
            {MONTH_WEEKS.map((week) => (
              <option key={week} value={week}>
                {MONTH_WEEK_LABELS[week]}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <fieldset aria-describedby={errors.weekdays ? ids.weekdaysError : undefined} className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold text-fg">On these days</legend>
        <div className="flex flex-wrap gap-2">
          {WEEK_ORDER.map((day) => (
            <label key={day} className={CHIP_CLASSES}>
              <input type="checkbox" checked={values.weekdays.includes(day)} onChange={(event) => toggleDay(day, event.target.checked)} className="absolute inset-0 m-0 cursor-pointer opacity-0" />
              <span aria-hidden="true">{(WEEKDAY_NAMES[day] as string).slice(0, 3)}</span>
              <span className="sr-only">{WEEKDAY_NAMES[day]}</span>
            </label>
          ))}
        </div>
        {errors.weekdays ? (
          <p id={ids.weekdaysError} className="text-sm font-medium text-status-danger">
            {errors.weekdays}
          </p>
        ) : null}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label={`Start time (${zone})`} type="time" step={900} value={values.startTime} onChange={(event) => set({ startTime: event.target.value })} error={errors.startTime} />
        <TextField label={`End time (${zone})`} type="time" step={900} value={values.endTime} onChange={(event) => set({ endTime: event.target.value })} error={errors.endTime} />
        <TextField label="Capacity" hint={`Seats per shift, 1 to ${MAX_CAPACITY}.`} type="number" min={1} max={MAX_CAPACITY} value={values.capacity} onChange={(event) => set({ capacity: event.target.value })} error={errors.capacity} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="First date" type="date" value={values.startsOn} onChange={(event) => set({ startsOn: event.target.value })} error={errors.startsOn} />
        <TextField label="Last date (optional)" hint="Leave empty to keep it going." type="date" value={values.endsOn} onChange={(event) => set({ endsOn: event.target.value })} error={errors.endsOn} />
      </div>

      <p aria-live="polite" className={cn("border-l-4 py-1 pl-3 text-base font-semibold", preview.ok ? "border-accent text-fg" : "border-border text-fg-muted")}>
        {preview.ok ? describeSeriesRule(preview.input.rule) : "Pick days and times to see the schedule."}
      </p>
      <button type="submit" disabled={isPending} className={buttonClassName("primary", "w-fit")}>
        {isPending ? "Saving..." : submitLabel}
      </button>
    </form>
  );
};

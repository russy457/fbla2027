/**
 * InstanceForm.tsx
 * Date, start and end time, and capacity for one shift (createInstance,
 * updateInstance). Times are typed in the organization's time zone and the
 * zone label is shown next to them (SPEC 7.5, D24); shiftForm.ts converts
 * them to instants and checks end after start, 12 hours max, and a future
 * start, matching the server's INSTANCE_TIME_INVALID rule.
 */
import { useState, type FormEvent, type ReactElement } from "react";
import { MAX_CAPACITY } from "@fbla/shared";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { TextField } from "@/components/ui/TextField";
import { toShiftInstants, zoneLabel, type ShiftTimesInput } from "@/lib/shiftForm";

export interface InstanceFormValues {
  readonly start: string;
  readonly end: string;
  readonly capacity: number;
}

interface InstanceFormProps {
  readonly timeZone: string;
  readonly nowMs: number;
  readonly initial: ShiftTimesInput & { readonly capacity: number };
  readonly submitLabel: string;
  readonly isPending: boolean;
  readonly onSubmit: (values: InstanceFormValues) => void;
}

type Errors = Partial<Record<keyof ShiftTimesInput | "capacity", string>>;

export const InstanceForm = ({ timeZone, nowMs, initial, submitLabel, isPending, onSubmit }: InstanceFormProps): ReactElement => {
  const [times, setTimes] = useState<ShiftTimesInput>(initial);
  const [capacity, setCapacity] = useState(String(initial.capacity));
  const [errors, setErrors] = useState<Errors>({});
  const zone = zoneLabel(timeZone, nowMs);

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    const seats = Number(capacity);
    if (!Number.isInteger(seats) || seats < 1 || seats > MAX_CAPACITY) {
      return setErrors({ capacity: `Enter a whole number from 1 to ${MAX_CAPACITY}.` });
    }
    const result = toShiftInstants(times, timeZone, nowMs);
    if (!result.ok) return setErrors({ [result.field]: result.message });
    setErrors({});
    onSubmit({ start: result.start, end: result.end, capacity: seats });
  };

  return (
    <form onSubmit={submit} noValidate className="flex max-w-2xl flex-col gap-4">
      <p className="text-sm text-fg-muted">Times are in the organization's time zone ({timeZone}, {zone}).</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label="Date" type="date" value={times.date} onChange={(event) => setTimes({ ...times, date: event.target.value })} error={errors.date} />
        <TextField label={`Start time (${zone})`} type="time" step={900} value={times.startTime} onChange={(event) => setTimes({ ...times, startTime: event.target.value })} error={errors.startTime} />
        <TextField label={`End time (${zone})`} type="time" step={900} value={times.endTime} onChange={(event) => setTimes({ ...times, endTime: event.target.value })} error={errors.endTime} />
      </div>
      <TextField label="Capacity" hint="Seats available, 1 to 200." type="number" min={1} max={MAX_CAPACITY} value={capacity} onChange={(event) => setCapacity(event.target.value)} error={errors.capacity} className="max-w-48" />
      <button type="submit" disabled={isPending} className={buttonClassName("primary", "w-fit")}>
        {isPending ? "Saving..." : submitLabel}
      </button>
    </form>
  );
};

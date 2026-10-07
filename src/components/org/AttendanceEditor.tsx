/**
 * AttendanceEditor.tsx
 * The setAttendance form (SPEC#fn-setattendance, SPEC 5.7 table):
 *   no-show   -> Excused, or Completed (minutes required, 15-minute steps up
 *                to the scheduled length), or Keep as no-show when the
 *                volunteer opened a dispute (closes it without a change)
 *   completed -> No-show (the hours log is rejected; letters that counted it
 *                become Superseded)
 * A note is always required and is kept in the audit trail. Focus moves to
 * the first option when the form opens (D20); the caller restores focus on
 * close. Pending until the op returns, no optimistic UI.
 */
import { useEffect, useId, useRef, useState, type FormEvent, type ReactElement } from "react";
import type { AttendanceTarget, SignupStatus } from "@fbla/shared";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { TextAreaField } from "@/components/ui/TextAreaField";
import { INPUT_CLASSES } from "@/components/ui/TextField";
import { useOpRunner } from "@/hooks/useOpRunner";
import { api } from "@/lib/api";
import { OpFeedback } from "./OpFeedback";

export interface AttendanceEditorProps {
  readonly signupId: string;
  readonly name: string;
  readonly status: SignupStatus;
  readonly disputeOpen: boolean;
  readonly scheduledMinutes: number;
  /** Called with a success message after a save, or with nothing on Cancel. */
  readonly onClose: (savedMessage?: string) => void;
}

const TARGET_LABELS: Readonly<Record<AttendanceTarget, string>> = {
  excused: "Excused",
  completed: "Completed (credit hours)",
  "no-show": "No-show",
  keep: "Keep as no-show (close the review request)"
};

/** Targets allowed from a status (SPEC 5.7). */
export const attendanceTargetsFor = (status: SignupStatus, disputeOpen: boolean): AttendanceTarget[] => {
  if (status === "no-show") return disputeOpen ? ["excused", "completed", "keep"] : ["excused", "completed"];
  if (status === "completed") return ["no-show"];
  return [];
};

const MAX_MINUTES = 720;
const minuteOptions = (scheduled: number): number[] =>
  Array.from({ length: Math.floor(Math.min(scheduled, MAX_MINUTES) / 15) + 1 }, (_, index) => index * 15);

export const AttendanceEditor = ({ signupId, name, status, disputeOpen, scheduledMinutes, onClose }: AttendanceEditorProps): ReactElement => {
  const targets = attendanceTargetsFor(status, disputeOpen);
  const [target, setTarget] = useState<AttendanceTarget | null>(null);
  const [minutes, setMinutes] = useState("");
  const [note, setNote] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const runner = useOpRunner();
  const firstOption = useRef<HTMLInputElement>(null);
  const minutesId = useId();

  useEffect(() => firstOption.current?.focus(), []);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (target === null) return setFieldError("Choose the new attendance.");
    if (target === "completed" && minutes === "") return setFieldError("Enter the minutes served.");
    if (note.trim().length < 3) return setFieldError("Write a short note (at least 3 characters).");
    setFieldError(null);
    const input = { signupId, to: target, note: note.trim(), ...(target === "completed" ? { minutes: Number(minutes) } : {}) };
    const result = await runner.run("save", () => api.coordinator.setAttendance(input), () => `Attendance for ${name} saved.`);
    if (result) onClose(`Attendance for ${name} saved.`);
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4 rounded-lg border border-border-strong bg-surface p-4" aria-label={`Attendance for ${name}`}>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-fg">New attendance</legend>
        {targets.map((option, index) => (
          <label key={option} className="flex min-h-touch items-center gap-3 text-fg">
            <input ref={index === 0 ? firstOption : undefined} type="radio" name={`attendance-${signupId}`} value={option} checked={target === option} onChange={() => setTarget(option)} />
            {TARGET_LABELS[option]}
          </label>
        ))}
      </fieldset>
      {target === "completed" ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={minutesId} className="text-sm font-semibold text-fg">
            Minutes served
          </label>
          <select id={minutesId} value={minutes} onChange={(event) => setMinutes(event.target.value)} className={INPUT_CLASSES}>
            <option value="">Choose minutes</option>
            {minuteOptions(scheduledMinutes).map((value) => (
              <option key={value} value={value}>
                {value} minutes ({value / 60} h)
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <TextAreaField label="Note" hint="Why the change? Kept in the audit trail." value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />
      {fieldError ? (
        <p role="alert" className="text-sm font-medium text-status-danger">
          {fieldError}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={runner.pending !== null} className={buttonClassName("primary")}>
          {runner.pending ? "Saving..." : "Save attendance"}
        </button>
        <button type="button" onClick={() => onClose()} disabled={runner.pending !== null} className={buttonClassName("quiet")}>
          Cancel
        </button>
      </div>
      <OpFeedback message={null} error={runner.error} />
    </form>
  );
};

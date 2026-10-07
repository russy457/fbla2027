/**
 * PlannerBox.tsx
 * "Describe the shift in plain words" on the new-shift page (H2,
 * SPEC#screen-planner 9.14, SPEC#ai 8.4). The deterministic parser in
 * shared/plannerParse.ts reads a sentence such as "need 12 people Sat 9-1
 * sorting at the food bank" with today's date in the org's zone, and the
 * parent pre-fills the structured form with what it recognized. It never
 * creates anything: the coordinator reviews the highlighted fields and saves
 * with the form's own buttons. The result line is aria-live so screen reader
 * users hear what was filled.
 */
import { useState, type FormEvent, type ReactElement } from "react";
import { localDateIn, parsePlannerText } from "@fbla/shared";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { TextAreaField } from "@/components/ui/TextAreaField";
import { prefillFromDraft, prefillSummary, type PlannerPrefill } from "@/lib/plannerPrefill";

export const PLANNER_EXAMPLE = "need 12 people Sat 9-1 sorting at the food bank";
/** Same limit as the parser and the Tier 2 AI op (SPEC 8.4 input 2,000 chars). */
const MAX_CHARS = 2000;

interface PlannerBoxProps {
  readonly timeZone: string;
  readonly nowMs: number;
  readonly onPrefill: (prefill: PlannerPrefill) => void;
}

export const PlannerBox = ({ timeZone, nowMs, onPrefill }: PlannerBoxProps): ReactElement => {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [result, setResult] = useState<PlannerPrefill | null>(null);

  const fill = (event: FormEvent): void => {
    event.preventDefault();
    if (text.trim() === "") {
      setError("Write a sentence about the shift first.");
      return;
    }
    setError(undefined);
    const draft = parsePlannerText(text, { referenceDate: localDateIn(new Date(nowMs), timeZone) });
    const prefill = prefillFromDraft(draft);
    setResult(prefill);
    if (prefill.filled.size > 0) onPrefill(prefill);
  };

  return (
    <section aria-labelledby="planner-title" className="flex max-w-2xl flex-col gap-3 border-l-4 border-accent bg-surface py-4 pr-4 pl-5">
      <h2 id="planner-title" className="text-lg font-semibold text-fg">
        Describe the shift in plain words
      </h2>
      <form onSubmit={fill} noValidate className="flex flex-col gap-3">
        <TextAreaField
          label="Shift description"
          hint="We fill in the form below from it. Nothing is saved until you press Save."
          placeholder={PLANNER_EXAMPLE}
          rows={2}
          maxLength={MAX_CHARS}
          value={text}
          error={error}
          onChange={(event) => setText(event.target.value)}
        />
        <button type="submit" className={buttonClassName("secondary", "w-fit")}>
          Fill in the form
        </button>
      </form>
      <div aria-live="polite" className="flex flex-col gap-1 empty:hidden">
        {result ? <p className="text-sm font-medium text-fg">{prefillSummary(result)}</p> : null}
        {result && result.hints.length > 0 ? (
          <ul className="list-disc pl-5 text-sm text-fg-muted">
            {result.hints.map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
};

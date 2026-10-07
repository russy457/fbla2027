/**
 * OpportunityForm.tsx
 * Create or edit an opportunity listing (SPEC#dm-opportunities,
 * coordinator.upsertOpportunity): title, description, cause area, type,
 * skills, minimum age, and a location (none for virtual listings). Checked
 * with the shared opportunityFieldsSchema before submitting; the server checks
 * again. The parent runs the op and shows pending and errors. Fields filled
 * by the plain-words planner arrive in `initial` and are named in
 * `highlighted`, which marks them for the coordinator to check.
 */
import { useId, useState, type FormEvent, type ReactElement } from "react";
import { CAUSE_AREAS, OPPORTUNITY_TYPES, opportunityFieldsSchema, type CauseArea, type OpportunityFields, type OpportunityType } from "@fbla/shared";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { TextAreaField } from "@/components/ui/TextAreaField";
import { INPUT_CLASSES, TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import { CAUSE_AREA_LABELS } from "@/lib/causeAreas";
import type { PrefillField } from "@/lib/plannerPrefill";
import { fieldErrorsOf, type FieldErrors } from "@/lib/validation/fieldErrors";
import { AddressFields, EMPTY_ADDRESS } from "./AddressFields";
import { PREFILLED_HINT, PREFILLED_INPUT_CLASSES } from "./plannerHighlight";

const TYPE_LABELS: Readonly<Record<OpportunityType, string>> = {
  "one-time": "One-time",
  recurring: "Recurring",
  virtual: "Virtual",
  skilled: "Skilled"
};

export const EMPTY_OPPORTUNITY: OpportunityFields = {
  title: "",
  description: "",
  causeArea: "hunger-food-security",
  type: "one-time",
  skills: [],
  minAge: 13,
  location: { address: EMPTY_ADDRESS }
};

interface OpportunityFormProps {
  readonly initial?: OpportunityFields;
  readonly submitLabel: string;
  readonly isPending: boolean;
  readonly onSubmit: (fields: OpportunityFields) => void;
  readonly highlighted?: ReadonlySet<PrefillField>;
}

const NONE: ReadonlySet<PrefillField> = new Set();

export const OpportunityForm = ({ initial = EMPTY_OPPORTUNITY, submitLabel, isPending, onSubmit, highlighted = NONE }: OpportunityFormProps): ReactElement => {
  const [fields, setFields] = useState(initial);
  const [skillsText, setSkillsText] = useState(initial.skills.join(", "));
  const [errors, setErrors] = useState<FieldErrors>({});
  const ids = { cause: useId(), type: useId() };
  const update = (patch: Partial<OpportunityFields>): void => setFields((current) => ({ ...current, ...patch }));
  const address = fields.location?.address ?? EMPTY_ADDRESS;

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    const skills = skillsText.split(",").map((skill) => skill.trim()).filter(Boolean);
    const parsed = opportunityFieldsSchema.safeParse({ ...fields, skills, location: fields.type === "virtual" ? null : { address } });
    if (!parsed.success) return setErrors(fieldErrorsOf(parsed.error));
    setErrors({});
    onSubmit(parsed.data);
  };

  return (
    <form onSubmit={submit} noValidate className="flex max-w-2xl flex-col gap-4">
      <TextField
        label="Title"
        hint={highlighted.has("title") ? PREFILLED_HINT : "4 to 80 characters, for example Sort and pack food boxes."}
        {...(highlighted.has("title") ? { inputClassName: PREFILLED_INPUT_CLASSES } : {})}
        value={fields.title} onChange={(event) => update({ title: event.target.value })} error={errors.title} />
      <TextAreaField label="Description" rows={4} maxLength={2000} value={fields.description} onChange={(event) => update({ description: event.target.value })} error={errors.description} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor={ids.cause} className="text-sm font-semibold text-fg">Cause area</label>
          {highlighted.has("causeArea") ? <p className="text-sm text-fg-muted">{PREFILLED_HINT}</p> : null}
          <select id={ids.cause} value={fields.causeArea} onChange={(event) => update({ causeArea: event.target.value as CauseArea })} className={cn(INPUT_CLASSES, highlighted.has("causeArea") && PREFILLED_INPUT_CLASSES)}>
            {CAUSE_AREAS.map((cause) => (
              <option key={cause} value={cause}>{CAUSE_AREA_LABELS[cause]}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={ids.type} className="text-sm font-semibold text-fg">Type</label>
          <select id={ids.type} value={fields.type} onChange={(event) => update({ type: event.target.value as OpportunityType })} className={INPUT_CLASSES}>
            {OPPORTUNITY_TYPES.map((type) => (
              <option key={type} value={type}>{TYPE_LABELS[type]}</option>
            ))}
          </select>
        </div>
      </div>
      <TextField label="Skills" hint="Optional, separated by commas (up to 10)." value={skillsText} onChange={(event) => setSkillsText(event.target.value)} error={errors.skills} />
      <TextField label="Minimum age" type="number" min={13} max={21} value={fields.minAge} onChange={(event) => update({ minAge: Number(event.target.value) })} error={errors.minAge} />
      {fields.type === "virtual" ? (
        <p className="text-sm text-fg-muted">Virtual opportunities have no location.</p>
      ) : (
        <AddressFields value={address} onChange={(next) => update({ location: { address: next } })} errors={errors} errorPrefix="location.address" highlightLine1={highlighted.has("location")} />
      )}
      <button type="submit" disabled={isPending} className={buttonClassName("primary", "w-fit")}>
        {isPending ? "Saving..." : submitLabel}
      </button>
    </form>
  );
};

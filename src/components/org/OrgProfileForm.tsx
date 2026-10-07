/**
 * OrgProfileForm.tsx
 * The organization profile form shared by Org register and Org settings
 * (SPEC 9.2, 5.8): name, mission, 1-3 cause areas, EIN (NN-NNNNNNN), address,
 * contact email and phone, website, and time zone. Validated with
 * orgProfileFormSchema before the op runs; read-only for coordinators who
 * are not the owner (fieldset disabled).
 */
import { useId, useState, type FormEvent, type ReactElement } from "react";
import { CAUSE_AREAS, type CauseArea } from "@fbla/shared";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { TextAreaField } from "@/components/ui/TextAreaField";
import { INPUT_CLASSES, TextField } from "@/components/ui/TextField";
import { CAUSE_AREA_LABELS } from "@/lib/causeAreas";
import { fieldErrorsOf, type FieldErrors } from "@/lib/validation/fieldErrors";
import { US_TIME_ZONES, orgProfileFormSchema, type OrgProfileDraft, type OrgProfileValues } from "@/lib/validation/orgForms";
import { AddressFields, EMPTY_ADDRESS } from "./AddressFields";

export const EMPTY_ORG_PROFILE: OrgProfileDraft = {
  name: "",
  mission: "",
  causeAreas: [],
  ein: "",
  address: EMPTY_ADDRESS,
  contactEmail: "",
  contactPhone: "",
  website: "",
  timeZone: "America/Chicago"
};

interface OrgProfileFormProps {
  readonly initial?: OrgProfileDraft;
  readonly submitLabel: string;
  readonly isPending: boolean;
  readonly readOnly?: boolean;
  readonly onSubmit: (values: OrgProfileValues) => void;
}

const CauseAreaChoices = ({ value, onChange, error }: { value: readonly CauseArea[]; onChange: (next: CauseArea[]) => void; error?: string | undefined }): ReactElement => {
  const toggle = (cause: CauseArea): void => onChange(value.includes(cause) ? value.filter((item) => item !== cause) : [...value, cause]);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-semibold text-fg">Cause areas (pick 1 to 3)</legend>
      <div className="grid gap-1 sm:grid-cols-2">
        {CAUSE_AREAS.map((cause) => (
          <label key={cause} className="flex min-h-touch items-center gap-3 text-fg">
            <input type="checkbox" checked={value.includes(cause)} disabled={!value.includes(cause) && value.length >= 3} onChange={() => toggle(cause)} />
            {CAUSE_AREA_LABELS[cause]}
          </label>
        ))}
      </div>
      {error ? <p className="text-sm font-medium text-status-danger">{error}</p> : null}
    </fieldset>
  );
};

export const OrgProfileForm = ({ initial = EMPTY_ORG_PROFILE, submitLabel, isPending, readOnly = false, onSubmit }: OrgProfileFormProps): ReactElement => {
  const [draft, setDraft] = useState<OrgProfileDraft>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const zoneId = useId();
  const update = (patch: Partial<OrgProfileDraft>): void => setDraft((current) => ({ ...current, ...patch }));

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    const parsed = orgProfileFormSchema.safeParse(draft);
    if (!parsed.success) return setErrors(fieldErrorsOf(parsed.error));
    setErrors({});
    onSubmit(parsed.data);
  };

  return (
    <form onSubmit={submit} noValidate className="flex max-w-2xl flex-col gap-4">
      <fieldset disabled={readOnly} className="flex flex-col gap-4">
        <TextField label="Organization name" value={draft.name} onChange={(event) => update({ name: event.target.value })} error={errors.name} />
        <TextAreaField label="Mission" rows={3} maxLength={500} value={draft.mission} onChange={(event) => update({ mission: event.target.value })} error={errors.mission} />
        <CauseAreaChoices value={draft.causeAreas} onChange={(causeAreas) => update({ causeAreas })} error={errors.causeAreas} />
        <TextField label="EIN" hint="Format NN-NNNNNNN, from your IRS letter." value={draft.ein} onChange={(event) => update({ ein: event.target.value })} error={errors.ein} />
        <AddressFields value={draft.address} onChange={(address) => update({ address })} errors={errors} errorPrefix="address" />
        <TextField label="Contact email" type="email" value={draft.contactEmail} onChange={(event) => update({ contactEmail: event.target.value })} error={errors.contactEmail} />
        <TextField label="Contact phone (optional)" hint="Like +12105550123." type="tel" value={draft.contactPhone} onChange={(event) => update({ contactPhone: event.target.value })} error={errors.contactPhone} />
        <TextField label="Website (optional)" type="url" value={draft.website} onChange={(event) => update({ website: event.target.value })} error={errors.website} />
        <div className="flex flex-col gap-2">
          <label htmlFor={zoneId} className="text-sm font-semibold text-fg">Time zone</label>
          <select id={zoneId} value={draft.timeZone} onChange={(event) => update({ timeZone: event.target.value })} className={INPUT_CLASSES}>
            {[...new Set([draft.timeZone, ...US_TIME_ZONES])].map((zone) => (
              <option key={zone} value={zone}>{zone}</option>
            ))}
          </select>
        </div>
      </fieldset>
      {readOnly ? (
        <p className="text-sm text-fg-muted">Only the organization owner can edit these details.</p>
      ) : (
        <button type="submit" disabled={isPending} className={buttonClassName("primary", "w-fit")}>
          {isPending ? "Saving..." : submitLabel}
        </button>
      )}
    </form>
  );
};

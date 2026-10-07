/**
 * PreferenceSteps.tsx
 * Onboarding steps 4 to 7 (SPEC#screen-onboarding D10): interests (at least
 * one), then skills, availability, and ZIP, which are skippable. Each step
 * validates with zod before moving on. Checkbox groups use <fieldset> and
 * <legend> so the question is read with every option.
 */
import { useState, type ReactElement } from "react";
import { CAUSE_AREAS, type Availability, type CauseArea } from "@fbla/shared";
import { TextField } from "@/components/ui/TextField";
import { CAUSE_AREA_LABELS } from "@/lib/causeAreas";
import { BLOCKS, DAYS, DAY_LABELS, emptyAvailability } from "@/lib/onboardingDraft";
import { interestsStepSchema, skillsStepSchema, zipStepSchema } from "@/lib/validation/formSchemas";
import { StepFrame } from "./StepFrame";

interface StepNav {
  readonly stepNumber: number;
  readonly stepCount: number;
  readonly onBack: () => void;
}

const CHECK_ROW = "flex min-h-touch cursor-pointer items-center gap-3 rounded-md border border-border bg-surface px-3 has-[:checked]:border-accent has-[:checked]:bg-accent-subtle";

const FieldError = ({ message }: { message: string | null }): ReactElement | null =>
  message ? (
    <p role="alert" className="text-sm font-medium text-status-danger">
      {message}
    </p>
  ) : null;

export const InterestsStep = ({ defaults, onNext, ...nav }: StepNav & { defaults: readonly CauseArea[]; onNext: (interests: CauseArea[]) => void }): ReactElement => {
  const [selected, setSelected] = useState<readonly CauseArea[]>(defaults);
  const [error, setError] = useState<string | null>(null);
  const toggle = (area: CauseArea): void =>
    setSelected((current) => (current.includes(area) ? current.filter((item) => item !== area) : [...current, area]));

  const submit = (): void => {
    const parsed = interestsStepSchema.safeParse({ interests: selected });
    if (parsed.success) onNext(parsed.data.interests);
    else setError(parsed.error.issues[0]?.message ?? "Pick at least one cause.");
  };

  return (
    <StepFrame {...nav} title="What causes do you care about?" description="We use these to suggest shifts. Pick as many as you like." onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Causes</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {CAUSE_AREAS.map((area) => (
            <label key={area} className={CHECK_ROW}>
              <input type="checkbox" checked={selected.includes(area)} onChange={() => toggle(area)} className="size-5 accent-accent" />
              <span className="text-fg">{CAUSE_AREA_LABELS[area]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <FieldError message={error} />
    </StepFrame>
  );
};

export const SkillsStep = ({ defaults, onNext, onSkip, ...nav }: StepNav & { defaults: readonly string[]; onNext: (skills: string[]) => void; onSkip: () => void }): ReactElement => {
  const [text, setText] = useState(defaults.join(", "));
  const [error, setError] = useState<string | undefined>(undefined);
  const submit = (): void => {
    const skills = text.split(",").map((skill) => skill.trim()).filter((skill) => skill.length > 0);
    const parsed = skillsStepSchema.safeParse({ skills });
    if (parsed.success) onNext(parsed.data.skills);
    else setError(parsed.error.issues[0]?.message);
  };
  return (
    <StepFrame {...nav} onSkip={onSkip} title="Any skills to share?" description="For example: Spanish, first aid, lifting boxes, tutoring." onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <TextField label="Skills" hint="Separate skills with commas." value={text} error={error} onChange={(event) => setText(event.target.value)} />
    </StepFrame>
  );
};

export const AvailabilityStep = ({ defaults, onNext, onSkip, ...nav }: StepNav & { defaults: Availability | null; onNext: (value: Availability) => void; onSkip: () => void }): ReactElement => {
  const [value, setValue] = useState<Availability>(defaults ?? emptyAvailability());
  const toggle = (day: (typeof DAYS)[number], block: (typeof BLOCKS)[number]): void =>
    setValue((current) => ({ ...current, [day]: { ...current[day], [block]: !current[day][block] } }));
  return (
    <StepFrame {...nav} onSkip={onSkip} title="When are you usually free?" description="Rough is fine. You can change this later." onSubmit={(event) => { event.preventDefault(); onNext(value); }}>
      <div className="flex flex-col gap-3">
        {DAYS.map((day) => (
          <fieldset key={day} className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold text-fg">{DAY_LABELS[day]}</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {BLOCKS.map((block) => (
                <label key={block} className={CHECK_ROW}>
                  <input type="checkbox" checked={value[day][block]} onChange={() => toggle(day, block)} className="size-5 accent-accent" />
                  <span className="text-sm text-fg capitalize">{block}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </StepFrame>
  );
};

export const ZipStep = ({ defaults, onNext, onSkip, ...nav }: StepNav & { defaults: string; onNext: (zip: string) => void; onSkip: () => void }): ReactElement => {
  const [zip, setZip] = useState(defaults);
  const [error, setError] = useState<string | undefined>(undefined);
  const submit = (): void => {
    const parsed = zipStepSchema.safeParse({ zip });
    if (parsed.success) onNext(parsed.data.zip);
    else setError(parsed.error.issues[0]?.message);
  };
  return (
    <StepFrame {...nav} onSkip={onSkip} title="What's your ZIP code?" description="Used to find shifts near you. We never store your street address." onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <TextField label="ZIP code" inputMode="numeric" autoComplete="postal-code" maxLength={5} value={zip} error={error} onChange={(event) => setZip(event.target.value)} />
    </StepFrame>
  );
};

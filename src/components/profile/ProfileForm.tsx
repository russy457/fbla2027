/**
 * ProfileForm.tsx
 * The editable part of /me/profile (SPEC#screen-inventory "Profile"): name,
 * interests, skills, availability, phone, and ZIP. Save sends only what
 * changed through volunteer.updateProfile; there is no optimistic UI, the
 * button shows pending until the op returns, then a status line confirms and
 * the live profile re-renders the values. Each group is a <fieldset> or a
 * labeled field with an id, so "Add interests" and the Explore distance hint
 * can link straight to it (#interests, #zip).
 */
import { useState, type FormEvent, type ReactElement } from "react";
import { CAUSE_AREAS, type CauseArea, type PrivateProfileDoc, type UserError } from "@fbla/shared";
import { ErrorNotice } from "@/components/errors/ErrorNotice";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { TextField } from "@/components/ui/TextField";
import { toUserErrorOrNetwork } from "@/hooks/useOpRunner";
import { api } from "@/lib/api";
import { CAUSE_AREA_LABELS } from "@/lib/causeAreas";
import { BLOCKS, DAYS, DAY_LABELS } from "@/lib/onboardingDraft";
import { profileFormValues, toUpdateProfileRequest, type ProfileErrors, type ProfileFormValues } from "@/lib/profileForm";

const CHECK_ROW =
  "flex min-h-touch cursor-pointer items-center gap-3 rounded-md border border-border bg-surface px-3 has-[:checked]:border-accent has-[:checked]:bg-accent-subtle";
const SECTION_TITLE = "text-lg font-semibold text-fg";

interface ProfileFormProps {
  readonly profile: PrivateProfileDoc;
}

export const ProfileForm = ({ profile }: ProfileFormProps): ReactElement => {
  const [values, setValues] = useState<ProfileFormValues>(() => profileFormValues(profile));
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<UserError | null>(null);
  const update = (patch: Partial<ProfileFormValues>): void => setValues((current) => ({ ...current, ...patch }));
  const toggleInterest = (area: CauseArea): void =>
    update({ interests: values.interests.includes(area) ? values.interests.filter((item) => item !== area) : [...values.interests, area] });
  const toggleBlock = (day: (typeof DAYS)[number], block: (typeof BLOCKS)[number]): void =>
    update({ availability: { ...values.availability, [day]: { ...values.availability[day], [block]: !values.availability[day][block] } } });

  const save = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setMessage(null);
    setError(null);
    const result = toUpdateProfileRequest(values, profile);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    if (Object.keys(result.request).length === 0) {
      setMessage("Nothing changed.");
      return;
    }
    setPending(true);
    try {
      const saved = await api.volunteer.updateProfile(result.request);
      const zipNote = result.request.zip && saved.homeGeohash === null ? " We cannot locate that ZIP yet, so distance filters stay off." : "";
      setMessage(`Profile saved.${zipNote}`);
    } catch (saveError) {
      setError(toUserErrorOrNetwork(saveError));
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={(event) => void save(event)} noValidate className="flex max-w-2xl flex-col gap-10">
      <section aria-labelledby="profile-name" className="flex flex-col gap-4">
        <h2 id="profile-name" className={SECTION_TITLE}>
          Name
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="First name" autoComplete="given-name" value={values.firstName} error={errors.firstName} onChange={(event) => update({ firstName: event.target.value })} />
          <TextField label="Last name" autoComplete="family-name" value={values.lastName} error={errors.lastName} onChange={(event) => update({ lastName: event.target.value })} />
        </div>
        <p className="text-sm text-fg-muted">Organizations and verify pages show your first name and last initial only.</p>
      </section>

      <fieldset id="interests" tabIndex={-1} className="flex flex-col gap-2 outline-none">
        <legend className={`${SECTION_TITLE} mb-1`}>Interests</legend>
        <p className="text-sm text-fg-muted">Explore uses these to pick shifts for you.</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {CAUSE_AREAS.map((area) => (
            <label key={area} className={CHECK_ROW}>
              <input type="checkbox" checked={values.interests.includes(area)} onChange={() => toggleInterest(area)} className="size-5 accent-accent" />
              <span className="text-fg">{CAUSE_AREA_LABELS[area]}</span>
            </label>
          ))}
        </div>
        {errors.interests ? (
          <p role="alert" className="text-sm font-medium text-status-danger">
            {errors.interests}
          </p>
        ) : null}
      </fieldset>

      <section aria-labelledby="profile-skills" className="flex flex-col gap-2">
        <h2 id="profile-skills" className={SECTION_TITLE}>
          Skills
        </h2>
        <TextField label="Skills" hint="Separate skills with commas, for example Spanish, first aid." value={values.skills} error={errors.skills} onChange={(event) => update({ skills: event.target.value })} />
      </section>

      <fieldset className="flex flex-col gap-3">
        <legend className={`${SECTION_TITLE} mb-1`}>When you're usually free</legend>
        {DAYS.map((day) => (
          <fieldset key={day} className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold text-fg">{DAY_LABELS[day]}</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {BLOCKS.map((block) => (
                <label key={block} className={CHECK_ROW}>
                  <input type="checkbox" checked={values.availability[day][block]} onChange={() => toggleBlock(day, block)} className="size-5 accent-accent" />
                  <span className="text-sm text-fg capitalize">{block}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </fieldset>

      <section aria-labelledby="profile-contact" className="flex flex-col gap-4">
        <h2 id="profile-contact" className={SECTION_TITLE}>
          Phone and area
        </h2>
        <TextField label="Phone (optional)" type="tel" autoComplete="tel" hint="Only coordinators of shifts you join can see it." value={values.phone} error={errors.phone} onChange={(event) => update({ phone: event.target.value })} />
        <div id="zip" tabIndex={-1} className="outline-none">
          <TextField
            label="ZIP code (optional)"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            hint="Used for distance filters. We keep a rough area of about 5 km, never your address."
            value={values.zip}
            error={errors.zip}
            onChange={(event) => update({ zip: event.target.value })}
          />
        </div>
      </section>

      <div className="flex flex-col gap-3">
        <button type="submit" disabled={pending} className={buttonClassName("primary", "w-fit")}>
          {pending ? "Saving..." : "Save profile"}
        </button>
        <p role="status" className="text-sm font-medium text-fg empty:hidden">
          {message ?? ""}
        </p>
        {error ? <ErrorNotice error={error} /> : null}
      </div>
    </form>
  );
};

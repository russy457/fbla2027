/**
 * ManualHoursPage.tsx
 * Route "/impact/hours/new" (volunteer.submitManualHours, SPEC 5.2; help
 * article manual-hours). A volunteer logs service done off the app: the
 * organization, a date in the last 12 months (not in the future), hours in
 * 15-minute steps, and a short description. The entry goes to that
 * organization's coordinators as pending (Needs attention) and counts only
 * after approval. One request nonce per entry, kept across retries.
 */
import { useId, useState, type FormEvent, type ReactElement } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { DEFAULT_TIME_ZONE, localDateIn, submitManualHoursInput } from "@fbla/shared";
import { OpFeedback } from "@/components/org/OpFeedback";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { PageHeader } from "@/components/ui/PageHeader";
import { TextAreaField } from "@/components/ui/TextAreaField";
import { INPUT_CLASSES, TextField } from "@/components/ui/TextField";
import { useNow } from "@/hooks/useNow";
import { useOpRunner } from "@/hooks/useOpRunner";
import { api, newRequestNonce } from "@/lib/api";
import { getOrganizations } from "@/lib/data/orgs";
import { fieldErrorsOf, type FieldErrors } from "@/lib/validation/fieldErrors";

const MINUTE_CHOICES = Array.from({ length: 48 }, (_, index) => (index + 1) * 15);
const YEAR_MS = 365 * 86_400_000;

const ManualHoursPage = (): ReactElement => {
  const nowMs = useNow(60_000);
  const orgs = useQuery({ queryKey: ["organizations"], queryFn: getOrganizations, staleTime: 60_000 });
  const [draft, setDraft] = useState({ orgId: "", date: "", minutes: "60", description: "" });
  const [nonce, setNonce] = useState(newRequestNonce);
  const [errors, setErrors] = useState<FieldErrors>({});
  const runner = useOpRunner();
  const ids = { org: useId(), minutes: useId() };
  const today = localDateIn(new Date(nowMs), DEFAULT_TIME_ZONE);
  const earliest = localDateIn(new Date(nowMs - YEAR_MS), DEFAULT_TIME_ZONE);
  const choices = (orgs.data ?? []).filter((org) => !org.archived).sort((a, b) => a.name.localeCompare(b.name));

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const parsed = submitManualHoursInput.safeParse({ ...draft, minutes: Number(draft.minutes), requestNonce: nonce });
    const outOfRange = draft.date !== "" && (draft.date > today || draft.date < earliest);
    if (!parsed.success || outOfRange) {
      return setErrors({ ...(parsed.success ? {} : fieldErrorsOf(parsed.error)), ...(outOfRange ? { date: "Pick a date in the last 12 months, not in the future." } : {}) });
    }
    setErrors({});
    const orgName = choices.find((org) => org.id === draft.orgId)?.name ?? "the organization";
    const result = await runner.run("submit", () => api.volunteer.submitManualHours(parsed.data), () => `Sent to ${orgName} for review.`);
    if (result) {
      setDraft({ orgId: "", date: "", minutes: "60", description: "" });
      setNonce(newRequestNonce());
    }
  };

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <PageHeader title="Log outside hours">Volunteered somewhere without checking in here? Send the hours to the organization to approve.</PageHeader>
      <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor={ids.org} className="text-sm font-semibold text-fg">Organization</label>
          <select id={ids.org} value={draft.orgId} onChange={(event) => setDraft({ ...draft, orgId: event.target.value })} className={INPUT_CLASSES} aria-invalid={errors.orgId ? true : undefined}>
            <option value="">Choose an organization</option>
            {choices.map((org) => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
          {errors.orgId ? <p className="text-sm font-medium text-status-danger">Choose an organization.</p> : null}
        </div>
        <TextField label="Date" type="date" min={earliest} max={today} value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} error={errors.date} />
        <div className="flex flex-col gap-2">
          <label htmlFor={ids.minutes} className="text-sm font-semibold text-fg">Hours</label>
          <select id={ids.minutes} value={draft.minutes} onChange={(event) => setDraft({ ...draft, minutes: event.target.value })} className={INPUT_CLASSES}>
            {MINUTE_CHOICES.map((minutes) => (
              <option key={minutes} value={minutes}>{minutes / 60} hours</option>
            ))}
          </select>
        </div>
        <TextAreaField label="What did you do?" hint="10 to 500 characters." maxLength={500} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} error={errors.description} />
        <button type="submit" disabled={runner.pending !== null} className={buttonClassName("primary", "w-fit")}>
          {runner.pending ? "Sending..." : "Send for review"}
        </button>
      </form>
      <OpFeedback message={runner.message} error={runner.error} />
      <Link to="/impact" className="w-fit text-sm font-semibold text-accent underline underline-offset-2">Back to Impact</Link>
    </div>
  );
};

export default ManualHoursPage;

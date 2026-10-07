/**
 * CollectionEditor.tsx
 * Create or edit a curated collection (SPEC 3.19, Tier 2; coordinators for
 * their org, admins for app-wide collections). Title, description, the
 * shifts and organizations it lists (checkboxes, kept in the order picked,
 * at most 30), and Published. Validated with the shared schema before the
 * write; the rules check it again. The collection id is chosen once by the
 * caller, so a retried Save rewrites the same document.
 */
import { useId, useState, type FormEvent, type ReactElement } from "react";
import { COLLECTION_DESCRIPTION_MAX, COLLECTION_ITEMS_MAX, COLLECTION_TITLE_MAX, collectionFieldsSchema, type CollectionFields, type CollectionItem } from "@fbla/shared";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { TextAreaField } from "@/components/ui/TextAreaField";
import { TextField } from "@/components/ui/TextField";
import { useClientWrite } from "@/hooks/useClientWrite";
import { saveCollection } from "@/lib/data/curatedCollections";
import { fieldErrorsOf, type FieldErrors } from "@/lib/validation/fieldErrors";
import { WriteFeedback } from "./WriteFeedback";

export interface CollectionChoice {
  readonly kind: CollectionItem["kind"];
  readonly refId: string;
  readonly label: string;
  readonly detail: string;
}

interface CollectionEditorProps {
  readonly collectionId: string;
  readonly orgId: string | null;
  readonly authorUid: string;
  readonly initial: CollectionFields;
  readonly choices: readonly CollectionChoice[];
  /** Called after a successful save with the sentence to announce. */
  readonly onSaved: (message: string) => void;
  readonly onCancel: () => void;
}

export const EMPTY_COLLECTION: CollectionFields = { title: "", description: "", items: [], published: false };

const sameItem = (a: CollectionItem, b: CollectionItem): boolean => a.kind === b.kind && a.refId === b.refId;

const ChoiceGroup = ({ legend, choices, items, onToggle }: { legend: string; choices: readonly CollectionChoice[]; items: readonly CollectionItem[]; onToggle: (item: CollectionItem) => void }): ReactElement | null =>
  choices.length === 0 ? null : (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-sm font-semibold text-fg">{legend}</legend>
      <ul className="flex max-h-72 flex-col overflow-y-auto rounded-md border border-border">
        {choices.map((choice) => {
          const item = { kind: choice.kind, refId: choice.refId };
          const checked = items.some((existing) => sameItem(existing, item));
          return (
            <li key={`${choice.kind}_${choice.refId}`} className="border-b border-border last:border-b-0">
              <label className="flex min-h-touch cursor-pointer items-start gap-3 px-3 py-2 hover:bg-surface-sunken">
                <input type="checkbox" checked={checked} onChange={() => onToggle(item)} className="mt-1 size-4 accent-(--accent)" />
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium text-fg">{choice.label}</span>
                  <span className="truncate text-xs text-fg-muted">{choice.detail}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );

export const CollectionEditor = ({ collectionId, orgId, authorUid, initial, choices, onSaved, onCancel }: CollectionEditorProps): ReactElement => {
  const [fields, setFields] = useState<CollectionFields>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const write = useClientWrite();
  const publishedId = useId();
  const full = fields.items.length >= COLLECTION_ITEMS_MAX;

  const toggle = (item: CollectionItem): void =>
    setFields((current) => {
      const present = current.items.some((existing) => sameItem(existing, item));
      if (!present && current.items.length >= COLLECTION_ITEMS_MAX) return current;
      return { ...current, items: present ? current.items.filter((existing) => !sameItem(existing, item)) : [...current.items, item] };
    });

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const parsed = collectionFieldsSchema.safeParse(fields);
    if (!parsed.success) return setErrors(fieldErrorsOf(parsed.error));
    setErrors({});
    const success = parsed.data.published ? `Saved and published "${parsed.data.title}".` : `Saved "${parsed.data.title}" as a draft.`;
    const saved = await write.run(
      () => saveCollection({ collectionId, orgId, authorUid, fields: parsed.data }),
      success,
      "We couldn't save this collection. Check your connection and that you still manage this organization, then try again."
    );
    if (saved) onSaved(success);
  };

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="flex max-w-2xl flex-col gap-4 border-l-4 border-accent bg-surface py-4 pr-4 pl-5">
      <TextField label="Title" hint={`4 to ${COLLECTION_TITLE_MAX} characters, for example Weekend food drives.`} maxLength={COLLECTION_TITLE_MAX} value={fields.title} onChange={(event) => setFields({ ...fields, title: event.target.value })} error={errors.title} />
      <TextAreaField label="Description" hint="Optional. Who is this for, and why these picks?" rows={3} maxLength={COLLECTION_DESCRIPTION_MAX} value={fields.description} onChange={(event) => setFields({ ...fields, description: event.target.value })} error={errors.description} />
      <p className="text-sm text-fg-muted" aria-live="polite">
        {fields.items.length} of {COLLECTION_ITEMS_MAX} picked{full ? ". Remove one to add another." : "."}
      </p>
      <ChoiceGroup legend="Shifts" choices={choices.filter((choice) => choice.kind === "opportunity")} items={fields.items} onToggle={toggle} />
      <ChoiceGroup legend="Organizations" choices={choices.filter((choice) => choice.kind === "org")} items={fields.items} onToggle={toggle} />
      {errors.items ? <p className="text-sm font-medium text-status-danger">{errors.items}</p> : null}
      <div className="flex items-center gap-3">
        <input id={publishedId} type="checkbox" checked={fields.published} onChange={(event) => setFields({ ...fields, published: event.target.checked })} className="size-4 accent-(--accent)" />
        <label htmlFor={publishedId} className="text-sm font-semibold text-fg">
          Published (shows on Explore for everyone)
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={write.pending} className={buttonClassName("primary")}>
          {write.pending ? "Saving..." : "Save collection"}
        </button>
        <button type="button" onClick={onCancel} className={buttonClassName("quiet")}>
          Cancel
        </button>
      </div>
      <WriteFeedback message={write.message} error={write.error} />
    </form>
  );
};

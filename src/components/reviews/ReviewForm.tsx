/**
 * ReviewForm.tsx
 * Write or edit an org experience review (SPEC 3.20, Tier 2): a 1-5 star
 * rating (radio group), optional tags, optional text (at most 1,000
 * characters, plain text only), and, when creating, whether to post with the
 * public name (first name + last initial, SPEC 4.2) or as "A volunteer".
 * Validated with the shared schema; the rules re-check attendance, fields,
 * and the 30 s edit cooldown, whose refusal gets its own plain sentence.
 */
import { useId, useState, type FormEvent, type ReactElement } from "react";
import { Star } from "@phosphor-icons/react";
import {
  ANONYMOUS_REVIEWER_NAME,
  REVIEW_EDIT_COOLDOWN_SEC,
  REVIEW_TAGS,
  REVIEW_TAG_LABELS,
  REVIEW_TEXT_MAX,
  reviewFieldsSchema,
  reviewerName,
  type ReviewFields,
  type ReviewTag
} from "@fbla/shared";
import { WriteFeedback } from "@/components/collections/WriteFeedback";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { TextAreaField } from "@/components/ui/TextAreaField";
import { useClientWrite } from "@/hooks/useClientWrite";
import { cn } from "@/lib/cn";
import { createReview, updateReview, type Review } from "@/lib/data/reviews";
import { fieldErrorsOf, type FieldErrors } from "@/lib/validation/fieldErrors";

export type ReviewFormTarget =
  | { readonly mode: "create"; readonly signupId: string; readonly orgId: string; readonly uid: string; readonly publicName: string; readonly shiftLabel: string }
  | { readonly mode: "edit"; readonly review: Review };

interface ReviewFormProps {
  readonly target: ReviewFormTarget;
  readonly onDone: (message: string) => void;
  readonly onCancel?: () => void;
}

const STARS = [1, 2, 3, 4, 5] as const;
const PILL = "inline-flex min-h-touch cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors duration-(--duration-fast) has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-(--focus-ring)";
const pillClass = (selected: boolean): string => cn(PILL, selected ? "border-accent bg-accent-subtle text-accent" : "border-border-strong bg-surface text-fg hover:bg-surface-sunken");

const initialFields = (target: ReviewFormTarget): ReviewFields =>
  target.mode === "edit" ? { rating: target.review.rating, tags: [...target.review.tags], text: target.review.text } : { rating: 0, tags: [], text: "" };

export const ReviewForm = ({ target, onDone, onCancel }: ReviewFormProps): ReactElement => {
  const [fields, setFields] = useState<ReviewFields>(() => initialFields(target));
  const [anonymous, setAnonymous] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const write = useClientWrite();
  const ids = { anonymous: useId(), rating: useId() };

  const toggleTag = (tag: ReviewTag): void =>
    setFields((current) => ({ ...current, tags: current.tags.includes(tag) ? current.tags.filter((existing) => existing !== tag) : [...current.tags, tag] }));

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const parsed = reviewFieldsSchema.safeParse(fields);
    if (!parsed.success) return setErrors(fieldErrorsOf(parsed.error));
    setErrors({});
    const done =
      target.mode === "create"
        ? await write.run(
            () => createReview({ signupId: target.signupId, orgId: target.orgId, uid: target.uid, displayName: reviewerName(target.publicName, anonymous), fields: parsed.data }),
            "Thanks! Your review is posted.",
            "We couldn't post your review. Reviews are for shifts you finished here; check your connection and try again."
          )
        : await write.run(
            () => updateReview(target.review.id, parsed.data),
            "Your review is updated.",
            `We couldn't update your review. If you just changed it, wait ${REVIEW_EDIT_COOLDOWN_SEC} seconds and try again.`
          );
    if (done) onDone(target.mode === "create" ? "Thanks! Your review is posted." : "Your review is updated.");
  };

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="flex max-w-2xl flex-col gap-4 border-l-4 border-accent bg-surface py-4 pr-4 pl-5">
      {target.mode === "create" ? <p className="text-sm text-fg-muted">For your shift: {target.shiftLabel}</p> : null}
      <fieldset aria-describedby={errors.rating ? ids.rating : undefined} className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-fg">Rating</legend>
        <div className="flex flex-wrap gap-2">
          {STARS.map((value) => (
            <label key={value} className={pillClass(fields.rating === value)}>
              <input type="radio" name="rating" value={value} checked={fields.rating === value} onChange={() => setFields({ ...fields, rating: value })} className="sr-only" />
              <Star aria-hidden="true" size={16} weight={fields.rating >= value ? "fill" : "regular"} />
              {value} {value === 1 ? "star" : "stars"}
            </label>
          ))}
        </div>
        {errors.rating ? (
          <p id={ids.rating} className="text-sm font-medium text-status-danger">
            Choose a rating from 1 to 5 stars.
          </p>
        ) : null}
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-fg">What stood out? (optional)</legend>
        <div className="flex flex-wrap gap-2">
          {REVIEW_TAGS.map((tag) => (
            <label key={tag} className={pillClass(fields.tags.includes(tag))}>
              <input type="checkbox" checked={fields.tags.includes(tag)} onChange={() => toggleTag(tag)} className="sr-only" />
              {REVIEW_TAG_LABELS[tag]}
            </label>
          ))}
        </div>
      </fieldset>
      <TextAreaField
        label="Your experience (optional)"
        hint={`Plain words, up to ${REVIEW_TEXT_MAX.toLocaleString("en-US")} characters. Don't include phone numbers, emails, or other people's names. ${fields.text.length}/${REVIEW_TEXT_MAX}`}
        rows={4}
        maxLength={REVIEW_TEXT_MAX}
        value={fields.text}
        onChange={(event) => setFields({ ...fields, text: event.target.value })}
        error={errors.text}
      />
      {target.mode === "create" ? (
        <div className="flex items-start gap-3">
          <input id={ids.anonymous} type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} className="mt-1 size-4 accent-(--accent)" />
          <label htmlFor={ids.anonymous} className="text-sm text-fg">
            Post as "{ANONYMOUS_REVIEWER_NAME}" instead of "{target.publicName}"
          </label>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={write.pending} className={buttonClassName("primary")}>
          {write.pending ? "Saving..." : target.mode === "create" ? "Post review" : "Save changes"}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} className={buttonClassName("quiet")}>
            Cancel
          </button>
        ) : null}
      </div>
      <WriteFeedback message={null} error={write.error} />
    </form>
  );
};

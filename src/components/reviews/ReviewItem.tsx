/**
 * ReviewItem.tsx
 * One review on the public org page (SPEC 3.20): name (first name + last
 * initial, or "A volunteer"), rating as text with stars beside it, tags,
 * the text as plain text (never HTML), the date, and the organization's
 * response. Actions depend on who is looking:
 *   author       Edit, Delete
 *   coordinator  Respond / Edit response / Remove response (org members only)
 *   admin        Remove review (moderation; SPEC 4.3 delete: author or admin)
 */
import { useState, type ReactElement } from "react";
import { Star } from "@phosphor-icons/react";
import { REVIEW_EDIT_COOLDOWN_SEC, REVIEW_RESPONSE_MAX, REVIEW_TAG_LABELS, formatLongDate } from "@fbla/shared";
import { WriteFeedback } from "@/components/collections/WriteFeedback";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { TextAreaField } from "@/components/ui/TextAreaField";
import { useClientWrite } from "@/hooks/useClientWrite";
import { deleteReview, setReviewResponse, type Review } from "@/lib/data/reviews";
import { ReviewForm } from "./ReviewForm";

export interface ReviewViewer {
  readonly uid: string | null;
  readonly isCoordinator: boolean;
  readonly isAdmin: boolean;
}

interface ReviewItemProps {
  readonly review: Review;
  readonly orgName: string;
  readonly timeZone: string;
  readonly viewer: ReviewViewer;
}

const Stars = ({ rating }: { rating: number }): ReactElement => (
  <span className="flex items-center gap-0.5 text-accent" aria-hidden="true">
    {[1, 2, 3, 4, 5].map((value) => (
      <Star key={value} size={14} weight={rating >= value ? "fill" : "regular"} />
    ))}
  </span>
);

const ResponseEditor = ({ review, uid, onDone }: { review: Review; uid: string; onDone: () => void }): ReactElement => {
  const [text, setText] = useState(review.response?.text ?? "");
  const write = useClientWrite();
  const save = async (): Promise<void> => {
    const ok = await write.run(() => setReviewResponse(review.id, uid, text), "Response saved.", "We couldn't save the response. Write 1 to 1,000 characters and try again.");
    if (ok) onDone();
  };
  return (
    <div className="flex flex-col gap-2">
      <TextAreaField label="Response from your organization" rows={3} maxLength={REVIEW_RESPONSE_MAX} value={text} onChange={(event) => setText(event.target.value)} />
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={write.pending || text.trim() === ""} onClick={() => void save()} className={buttonClassName("primary")}>
          Save response
        </button>
        <button type="button" onClick={onDone} className={buttonClassName("quiet")}>
          Cancel
        </button>
      </div>
      <WriteFeedback message={null} error={write.error} />
    </div>
  );
};

export const ReviewItem = ({ review, orgName, timeZone, viewer }: ReviewItemProps): ReactElement => {
  const [mode, setMode] = useState<"view" | "edit" | "respond">("view");
  const write = useClientWrite();
  const isAuthor = viewer.uid !== null && viewer.uid === review.uid;

  const remove = async (question: string): Promise<void> => {
    if (!window.confirm(question)) return;
    await write.run(() => deleteReview(review.id), "Review removed.", `We couldn't remove this review. If you just changed it, wait ${REVIEW_EDIT_COOLDOWN_SEC} seconds and try again.`);
  };

  if (mode === "edit") return <ReviewForm target={{ mode: "edit", review }} onDone={() => setMode("view")} onCancel={() => setMode("view")} />;

  return (
    <article aria-label={`Review by ${review.displayName}`} className="flex flex-col gap-2">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="font-semibold text-fg">{review.displayName}</p>
        <Stars rating={review.rating} />
        <p className="text-sm text-fg-muted">
          {review.rating} out of 5 · {formatLongDate(review.createdAt.toDate(), timeZone)}
        </p>
      </header>
      {review.tags.length > 0 ? (
        <ul aria-label="Tags" className="flex flex-wrap gap-1.5">
          {review.tags.map((tag) => (
            <li key={tag} className="rounded-full bg-surface-sunken px-2.5 py-0.5 text-xs text-fg">
              {REVIEW_TAG_LABELS[tag]}
            </li>
          ))}
        </ul>
      ) : null}
      {review.text ? <p className="max-w-[65ch] whitespace-pre-line text-fg">{review.text}</p> : null}
      {review.response && mode !== "respond" ? (
        <div className="ml-4 border-l-2 border-border-strong pl-3">
          <p className="text-sm font-semibold text-fg">Response from {orgName}</p>
          <p className="max-w-[60ch] whitespace-pre-line text-sm text-fg">{review.response.text}</p>
        </div>
      ) : null}
      {mode === "respond" && viewer.uid !== null ? <ResponseEditor review={review} uid={viewer.uid} onDone={() => setMode("view")} /> : null}
      {mode === "view" ? (
        <div className="flex flex-wrap gap-1">
          {isAuthor ? (
            <>
              <button type="button" onClick={() => setMode("edit")} className={buttonClassName("quiet")}>
                Edit my review
              </button>
              <button type="button" disabled={write.pending} onClick={() => void remove("Delete your review? This cannot be undone.")} className={buttonClassName("quiet")}>
                Delete my review
              </button>
            </>
          ) : null}
          {viewer.isCoordinator ? (
            <button type="button" onClick={() => setMode("respond")} className={buttonClassName("quiet")} aria-label={`${review.response ? "Edit response to" : "Respond to"} ${review.displayName}`}>
              {review.response ? "Edit response" : "Respond"}
            </button>
          ) : null}
          {viewer.isCoordinator && review.response && viewer.uid !== null ? (
            <button type="button" disabled={write.pending} onClick={() => void write.run(() => setReviewResponse(review.id, viewer.uid ?? "", null), "Response removed.", "We couldn't remove the response. Try again.")} className={buttonClassName("quiet")}>
              Remove response
            </button>
          ) : null}
          {viewer.isAdmin && !isAuthor ? (
            <button type="button" disabled={write.pending} onClick={() => void remove(`Remove the review by ${review.displayName}? Use this for reviews that break the community rules.`)} className={buttonClassName("quiet")} aria-label={`Remove review by ${review.displayName}`}>
              Remove review
            </button>
          ) : null}
        </div>
      ) : null}
      <WriteFeedback message={write.message} error={write.error} />
    </article>
  );
};

/**
 * RequestReview.tsx
 * "Request review" on a no-show row in My Shifts (SPEC#screen-inventory My
 * Shifts secondary action, T3, Appendix B item 30). The volunteer explains
 * what happened in a short note (10-500 characters) and
 * volunteer.requestAttendanceReview opens a dispute that the organization's
 * coordinators see in Needs attention; they resolve it with setAttendance.
 *
 *   no dispute, within 30 days   Request review button, then the note form
 *   dispute open                 "Review requested" status line
 *   dispute resolved             "The organization reviewed this"
 *   window closed                nothing (the op would refuse it)
 *
 * Pending until the op returns; no optimistic UI. The row re-renders from
 * the signup listener once disputeOpen flips. Focus moves into the note when
 * the form opens and back to the button on Cancel (D20).
 */
import { useEffect, useRef, useState, type FormEvent, type ReactElement } from "react";
import { isDisputeWindowOpen, type UserError } from "@fbla/shared";
import { ErrorNotice } from "@/components/errors/ErrorNotice";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { TextAreaField } from "@/components/ui/TextAreaField";
import { toUserErrorOrNetwork } from "@/hooks/useOpRunner";
import { api } from "@/lib/api";
import type { Signup } from "@/lib/data/signups";

/** requestAttendanceReviewInput note bounds (shared/schemas/ops/hoursOps.ts). */
const NOTE_MIN = 10;
const NOTE_MAX = 500;

interface RequestReviewProps {
  readonly signup: Signup;
  readonly nowMs: number;
}

export const RequestReview = ({ signup, nowMs }: RequestReviewProps): ReactElement | null => {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | undefined>(undefined);
  const [pending, setPending] = useState(false);
  // Set once the op returns, so the confirmation shows before the listener catches up.
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<UserError | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const openButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) noteRef.current?.focus();
    else if (wasOpen.current) openButton.current?.focus();
    wasOpen.current = open;
  }, [open]);

  if (signup.status !== "no-show") return null;
  if (signup.disputeOpen || sent) {
    return (
      <p role="status" className="text-sm text-fg-muted">
        Review requested. The organization will look at it.
      </p>
    );
  }
  if (signup.dispute?.resolvedAt) return <p className="text-sm text-fg-muted">The organization reviewed this.</p>;
  if (!isDisputeWindowOpen(signup.instanceEnd.toMillis(), nowMs)) return null;

  if (!open) {
    return (
      <button ref={openButton} type="button" onClick={() => setOpen(true)} className={buttonClassName("secondary")}>
        Request review
      </button>
    );
  }

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const trimmed = note.trim();
    if (trimmed.length < NOTE_MIN) {
      setNoteError(`Write at least ${NOTE_MIN} characters so the organization knows what happened.`);
      noteRef.current?.focus();
      return;
    }
    setNoteError(undefined);
    setError(null);
    setPending(true);
    try {
      await api.volunteer.requestAttendanceReview({ signupId: signup.id, note: trimmed });
      setSent(true);
    } catch (callError) {
      setError(toUserErrorOrNetwork(callError));
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} aria-label="Request a review of this no-show" className="flex w-full max-w-md flex-col gap-3">
      <TextAreaField
        ref={noteRef}
        label="What happened?"
        hint="For example: I checked in on the paper list because the kiosk was down."
        value={note}
        maxLength={NOTE_MAX}
        error={noteError}
        onChange={(event) => setNote(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={buttonClassName("primary")}>
          {pending ? "Sending..." : "Send request"}
        </button>
        <button type="button" disabled={pending} onClick={() => setOpen(false)} className={buttonClassName("quiet")}>
          Cancel
        </button>
      </div>
      {error ? <ErrorNotice error={error} /> : null}
    </form>
  );
};

/**
 * SignupAction.tsx
 * The signup button for one shift (SPEC#signup-matrix D5) plus its
 * follow-ups: Cancel for a confirmed signup (with an explicit second
 * confirmation), "Check-in opens H:MM" once signed up (D24), and the D22
 * error notice when the server refuses. No optimistic UI: the button shows
 * pending until the Function returns, and the label then comes from the live
 * signup snapshot. Focus returns to the action button after each submit (D20).
 */
import { useEffect, useRef, useState, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle } from "@phosphor-icons/react";
import { DEFAULT_CONFIG, checkInWindow, formatClockTime, type UserError } from "@fbla/shared";
import { ErrorNotice } from "@/components/errors/ErrorNotice";
import { loginPathFor } from "@/components/guards/RouteGuards";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { ApiError, api } from "@/lib/api";
import type { Instance } from "@/lib/data/instances";
import type { Signup } from "@/lib/data/signups";
import { signupButtonState } from "@/lib/signupButtonState";

interface SignupActionProps {
  readonly instance: Instance;
  readonly signup: Signup | null;
  readonly birthDate: string | null;
  readonly signedIn: boolean;
  readonly nowMs: number;
  /** Where sign-in returns a signed-out visitor (D5 "opens sign-in, then returns"); Explore by default. */
  readonly returnPath?: string;
}

type Pending = "signup" | "cancel" | null;

const toUserError = (error: unknown): UserError | null => (error instanceof ApiError ? error.userError : null);

export const SignupAction = ({ instance, signup, birthDate, signedIn, nowMs, returnPath }: SignupActionProps): ReactElement => {
  const navigate = useNavigate();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [error, setError] = useState<UserError | null>(null);
  // Set after a submit; the effect below moves focus once the live snapshot re-renders the action.
  const restoreFocus = useRef(false);

  const state = signupButtonState({
    nowMs,
    instance: {
      status: instance.status,
      startMs: instance.start.toMillis(),
      minAge: instance.minAge,
      orgVerified: instance.orgVerified,
      capacity: instance.capacity,
      signupCount: instance.signupCount,
      timeZone: instance.timeZone
    },
    signup: signup ? { status: signup.status, waitlistPosition: null, waitlistSize: null } : null,
    birthDate,
    signedIn
  });

  const run = async (kind: Exclude<Pending, null>, action: () => Promise<unknown>): Promise<void> => {
    setPending(kind);
    setError(null);
    try {
      await action();
      setConfirmingCancel(false);
    } catch (actionError) {
      setError(toUserError(actionError));
    } finally {
      setPending(null);
      restoreFocus.current = true;
      buttonRef.current?.focus();
    }
  };

  // The button under focus can change (Sign up -> Cancel) when the snapshot arrives; keep focus on the action.
  useEffect(() => {
    if (!restoreFocus.current) return;
    restoreFocus.current = false;
    buttonRef.current?.focus();
  }, [state.kind, confirmingCancel]);

  const onPrimary = (): void => {
    if (state.kind === "signed-out") {
      navigate(loginPathFor(returnPath ?? `/?shift=${encodeURIComponent(instance.id)}`));
      return;
    }
    if (state.kind === "available") void run("signup", () => api.volunteer.signup({ instanceId: instance.id }));
  };

  const opensAt = formatClockTime(new Date(checkInWindow(instance.start.toMillis(), instance.end.toMillis(), DEFAULT_CONFIG).fromMs), instance.timeZone);
  const shiftLabel = instance.title;
  const primaryText = pending === "signup" ? "Signing up..." : state.label;

  return (
    <div className="flex flex-col items-start gap-2 md:items-end">
      {state.kind === "signed-up" ? (
        <p className="inline-flex min-h-touch items-center gap-2 font-semibold text-status-success">
          <CheckCircle aria-hidden="true" size={20} weight="bold" />
          Signed up
        </p>
      ) : (
        <button
          ref={buttonRef}
          type="button"
          onClick={onPrimary}
          disabled={!state.actionable || pending !== null}
          // Screen readers hear which shift the button is for ("Sign up: Sort and pack food boxes");
          // the name always starts with the visible text (WCAG label in name).
          aria-label={state.actionable ? `${primaryText}: ${shiftLabel}` : undefined}
          className={buttonClassName(state.actionable ? "primary" : "secondary", "min-w-32")}
        >
          {primaryText}
        </button>
      )}
      {state.reason ? <p className="max-w-[32ch] text-sm text-fg-muted md:text-right">{state.reason}</p> : null}
      {state.kind === "signed-up" ? <p className="text-sm text-fg-muted">Check-in opens {opensAt}</p> : null}
      {state.canCancel && signup ? (
        confirmingCancel ? (
          <div role="group" aria-label="Confirm cancel" className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => void run("cancel", () => api.volunteer.cancelSignup({ signupId: signup.id }))}
              className={buttonClassName("secondary")}
            >
              {pending === "cancel" ? "Cancelling..." : "Yes, cancel my spot"}
            </button>
            <button type="button" onClick={() => setConfirmingCancel(false)} className={buttonClassName("quiet")}>
              Keep my spot
            </button>
          </div>
        ) : (
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setConfirmingCancel(true)}
            aria-label={`Cancel: ${shiftLabel}`}
            className={buttonClassName("quiet")}
          >
            Cancel
          </button>
        )
      ) : null}
      {error ? <ErrorNotice error={error} className="w-full max-w-sm" /> : null}
    </div>
  );
};

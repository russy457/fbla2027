/**
 * GoogleSignInButton.tsx
 * "Continue with Google" for the Login page and onboarding step 2. Opens the
 * Google window (authClient.ts); closing it is silent, other failures show a
 * plain sentence with role="alert". onPendingChange lets the parent hold its
 * own redirects until it knows whether the account is new.
 */
import { useState, type ReactElement } from "react";
import { GoogleLogo, WarningCircle } from "@phosphor-icons/react";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { AuthFormError, signInWithGoogle } from "@/lib/authClient";

interface GoogleSignInButtonProps {
  readonly onSignedIn: (result: { isNewUser: boolean }) => void | Promise<void>;
  readonly onPendingChange?: (pending: boolean) => void;
  readonly label?: string;
}

export const GoogleSignInButton = ({ onSignedIn, onPendingChange, label = "Continue with Google" }: GoogleSignInButtonProps): ReactElement => {
  const [isPending, setIsPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const setPending = (pending: boolean): void => {
    setIsPending(pending);
    onPendingChange?.(pending);
  };

  const start = async (): Promise<void> => {
    setFormError(null);
    setPending(true);
    try {
      const result = await signInWithGoogle();
      // On success the parent navigates away, so pending stays set until this unmounts.
      if (result) {
        await onSignedIn(result);
        return;
      }
    } catch (error) {
      setFormError(error instanceof AuthFormError ? error.message : "We couldn't sign you in with Google. Try again.");
    }
    setPending(false);
  };

  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <button type="button" disabled={isPending} onClick={() => void start()} className={buttonClassName("secondary", "w-full")}>
        <GoogleLogo aria-hidden="true" size={18} weight="bold" />
        {isPending ? "Opening Google..." : label}
      </button>
      {formError ? (
        <p role="alert" className="flex items-start gap-2 rounded-md bg-status-danger-subtle p-3 text-sm font-medium text-fg">
          <WarningCircle aria-hidden="true" size={18} className="mt-px shrink-0 text-status-danger" />
          {formError}
        </p>
      ) : null}
    </div>
  );
};

/** The "or" rule between Google and the email form. */
export const AuthDivider = (): ReactElement => (
  <div className="flex w-full max-w-sm items-center gap-3 text-sm text-fg-muted" aria-hidden="true">
    <span className="h-px flex-1 bg-border" />
    or
    <span className="h-px flex-1 bg-border" />
  </div>
);

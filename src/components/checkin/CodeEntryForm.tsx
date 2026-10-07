/**
 * CodeEntryForm.tsx
 * Typed kiosk code entry for check-in and check-out (SPEC#screen-kiosk-states
 * "Typed entry"): one field, numeric keyboard (inputmode=numeric), one-time
 * code autofill, zod validation before sending, and the catalog message when
 * the server refuses (expired code, window not open, too many attempts). A
 * RATE_LIMITED answer disables Submit and counts down retryAfterSec. Focus
 * returns to the field after a failed submit so the next try is one keystroke
 * away (D20).
 */
import { useEffect, useRef, useState, type ReactElement } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { UserError } from "@fbla/shared";
import { ErrorNotice } from "@/components/errors/ErrorNotice";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { TextField } from "@/components/ui/TextField";
import { ApiError, NETWORK_USER_ERROR } from "@/lib/api";
import { kioskCodeFormSchema, type KioskCodeForm } from "@/lib/validation/formSchemas";

interface CodeEntryFormProps {
  /** "Check in" or "Check out": used for the button and the field label. */
  readonly actionLabel: string;
  /** Sends the 6-digit code; throws ApiError when the server refuses. */
  readonly onSubmitCode: (code: string) => Promise<void>;
  readonly onCancel?: () => void;
}

const retryAfterOf = (error: UserError | null): number => {
  const value = error?.code === "RATE_LIMITED" ? Number(error.params.retryAfterSec) : 0;
  return Number.isFinite(value) && value > 0 ? Math.ceil(value) : 0;
};

export const CodeEntryForm = ({ actionLabel, onSubmitCode, onCancel }: CodeEntryFormProps): ReactElement => {
  const [serverError, setServerError] = useState<UserError | null>(null);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const {
    register,
    handleSubmit,
    setFocus,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<KioskCodeForm>({ resolver: zodResolver(kioskCodeFormSchema), defaultValues: { code: "" } });

  // Count down the RATE_LIMITED wait, one second at a time.
  useEffect(() => {
    if (waitSeconds <= 0) return undefined;
    const timer = window.setTimeout(() => setWaitSeconds((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [waitSeconds]);

  useEffect(() => {
    setFocus("code");
  }, [setFocus]);

  const submit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await onSubmitCode(values.code.replace(/\s+/g, ""));
    } catch (error) {
      const userError = error instanceof ApiError ? error.userError : NETWORK_USER_ERROR;
      setServerError(userError);
      setWaitSeconds(retryAfterOf(userError));
      reset({ code: "" });
      inputRef.current?.focus();
    }
  });

  const { ref: registerRef, ...codeField } = register("code");
  const isWaiting = waitSeconds > 0;

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex w-full max-w-sm flex-col gap-4">
      <TextField
        label={`${actionLabel} code`}
        hint="Type the 6-digit code shown on the kiosk screen."
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={7}
        error={errors.code?.message}
        inputClassName="font-mono text-2xl tracking-[0.3em]"
        ref={(element) => {
          registerRef(element);
          inputRef.current = element;
        }}
        {...codeField}
      />
      {serverError ? <ErrorNotice error={serverError} /> : null}
      {isWaiting ? (
        <p aria-live="polite" className="text-sm font-medium text-fg-muted">
          You can try again in {waitSeconds} s.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={isSubmitting || isWaiting} className={buttonClassName("primary")}>
          {isSubmitting ? "Checking code..." : "Submit code"}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} className={buttonClassName("quiet")}>
            Not now
          </button>
        ) : null}
      </div>
    </form>
  );
};

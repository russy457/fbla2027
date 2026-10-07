/**
 * SignInForm.tsx
 * Email and password sign-in, validated with zod before any network call.
 * Used by the Login page and by the kiosk (coordinator sign-in to start or
 * exit kiosk mode). The parent decides what happens after success through
 * onSignedIn; `authenticate` replaces the plain sign-in when a caller must
 * check something first (the kiosk exit verifies coordinator membership before
 * replacing the kiosk session). Errors from Firebase Auth arrive as plain sentences
 * (authClient.ts) and are announced with role="alert".
 */
import { useState, type ReactElement } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { WarningCircle } from "@phosphor-icons/react";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { TextField } from "@/components/ui/TextField";
import { AuthFormError, signInWithEmail } from "@/lib/authClient";
import { signInFormSchema, type SignInForm as SignInValues } from "@/lib/validation/formSchemas";

interface SignInFormProps {
  readonly onSignedIn: () => void | Promise<void>;
  readonly submitLabel?: string;
  /** Prefills the email, for example the coordinator who started the kiosk. */
  readonly defaultEmail?: string;
  /** Signs in (or refuses with an AuthFormError); defaults to a plain email sign-in on this device. */
  readonly authenticate?: (email: string, password: string) => Promise<void>;
}

export const SignInForm = ({ onSignedIn, submitLabel = "Sign in", defaultEmail = "", authenticate = signInWithEmail }: SignInFormProps): ReactElement => {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<SignInValues>({ resolver: zodResolver(signInFormSchema), defaultValues: { email: defaultEmail, password: "" } });

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await authenticate(values.email, values.password);
      await onSignedIn();
    } catch (error) {
      setFormError(error instanceof AuthFormError ? error.message : "We couldn't sign you in. Try again.");
    }
  });

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex w-full max-w-sm flex-col gap-4">
      <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
      <TextField
        label="Password"
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register("password")}
      />
      {formError ? (
        <p role="alert" className="flex items-start gap-2 rounded-md bg-status-danger-subtle p-3 text-sm font-medium text-fg">
          <WarningCircle aria-hidden="true" size={18} className="mt-px shrink-0 text-status-danger" />
          {formError}
        </p>
      ) : null}
      <button type="submit" disabled={isSubmitting} className={buttonClassName("primary", "w-full")}>
        {isSubmitting ? "Signing in..." : submitLabel}
      </button>
    </form>
  );
};

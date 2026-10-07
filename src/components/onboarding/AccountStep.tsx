/**
 * AccountStep.tsx
 * Onboarding step 2 (D10): create the account with email and password. Only
 * shown to people who are signed out; it runs after the 13+ check, so no
 * account is ever created for someone under 13 (G18).
 */
import { useState, type ReactElement } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { TextField } from "@/components/ui/TextField";
import { AuthFormError, createAccount } from "@/lib/authClient";
import { createAccountFormSchema, type CreateAccountForm } from "@/lib/validation/formSchemas";
import { StepFrame } from "./StepFrame";

interface AccountStepProps {
  readonly stepNumber: number;
  readonly stepCount: number;
  readonly onBack: () => void;
  readonly onCreated: () => void;
  readonly loginPath: string;
}

export const AccountStep = ({ stepNumber, stepCount, onBack, onCreated, loginPath }: AccountStepProps): ReactElement => {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<CreateAccountForm>({ resolver: zodResolver(createAccountFormSchema), defaultValues: { email: "", password: "" } });

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await createAccount(values.email, values.password);
      onCreated();
    } catch (error) {
      setFormError(error instanceof AuthFormError ? error.message : "We couldn't create your account. Try again.");
    }
  });

  return (
    <StepFrame
      stepNumber={stepNumber}
      stepCount={stepCount}
      title="Create your account"
      description="Use an email you check. Your email stays private."
      onSubmit={(event) => void submit(event)}
      onBack={onBack}
      submitLabel="Create account"
      isSubmitting={isSubmitting}
    >
      <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
      <TextField
        label="Password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters."
        error={errors.password?.message}
        {...register("password")}
      />
      {formError ? (
        <p role="alert" className="rounded-md bg-status-danger-subtle p-3 text-sm font-medium text-fg">
          {formError}
        </p>
      ) : null}
      <p className="text-sm text-fg-muted">
        Already have an account?{" "}
        <Link to={loginPath} className="font-semibold text-accent underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </StepFrame>
  );
};

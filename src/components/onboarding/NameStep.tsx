/**
 * NameStep.tsx
 * Onboarding step 3 (D10): first and last name (required) and an optional
 * phone number. Others only ever see "first name + last initial"; the phone
 * is shared only with coordinators of shifts you join (SPEC 4.2). Phone input
 * accepts common US formats and is converted to E.164 on submit.
 */
import type { ReactElement } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { TextField } from "@/components/ui/TextField";
import { nameStepSchema, type NameStep as NameValues } from "@/lib/validation/formSchemas";
import { StepFrame } from "./StepFrame";

interface NameStepProps {
  readonly stepNumber: number;
  readonly stepCount: number;
  readonly defaults: NameValues;
  readonly onBack?: () => void;
  readonly onNext: (values: NameValues) => void;
}

export const NameStep = ({ stepNumber, stepCount, defaults, onBack, onNext }: NameStepProps): ReactElement => {
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<NameValues>({ resolver: zodResolver(nameStepSchema), defaultValues: defaults });

  return (
    <StepFrame
      stepNumber={stepNumber}
      stepCount={stepCount}
      title="What's your name?"
      description="Organizations see your first name and last initial. Your full name appears only on your own letters."
      onSubmit={(event) => void handleSubmit(onNext)(event)}
      onBack={onBack}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField label="First name" autoComplete="given-name" error={errors.firstName?.message} {...register("firstName")} />
        <TextField label="Last name" autoComplete="family-name" error={errors.lastName?.message} {...register("lastName")} />
      </div>
      <TextField
        label="Phone (optional)"
        type="tel"
        autoComplete="tel"
        hint="Only coordinators of shifts you join can see it."
        error={errors.phone?.message}
        {...register("phone")}
      />
    </StepFrame>
  );
};

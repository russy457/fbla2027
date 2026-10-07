/**
 * BirthDateStep.tsx
 * Onboarding step 1 (SPEC#screen-onboarding D10, SPEC#minors G18): birth date
 * comes FIRST, before any account exists. Format and meaning are checked
 * with zod (real date, not in the future, believable year). Someone under
 * 13 is not shown an error; the parent decides to show the kind stop screen.
 */
import type { ReactElement } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { clock } from "@fbla/shared";
import { TextField } from "@/components/ui/TextField";
import { birthDateSchema } from "@/lib/validation/formSchemas";
import { StepFrame } from "./StepFrame";

interface BirthDateStepProps {
  readonly stepNumber: number;
  readonly stepCount: number;
  readonly defaultValue: string;
  readonly onNext: (birthDate: string) => void;
}

export const BirthDateStep = ({ stepNumber, stepCount, defaultValue, onNext }: BirthDateStepProps): ReactElement => {
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<{ birthDate: string }>({
    resolver: zodResolver(z.object({ birthDate: birthDateSchema(clock.now()) })),
    defaultValues: { birthDate: defaultValue }
  });

  return (
    <StepFrame
      stepNumber={stepNumber}
      stepCount={stepCount}
      title="When were you born?"
      description="We ask first because some shifts have age limits, and you must be 13 or older to use this app."
      onSubmit={(event) => void handleSubmit((values) => onNext(values.birthDate))(event)}
    >
      <TextField label="Birth date" type="date" autoComplete="bday" error={errors.birthDate?.message} {...register("birthDate")} />
    </StepFrame>
  );
};

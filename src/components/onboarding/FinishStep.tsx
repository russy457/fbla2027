/**
 * FinishStep.tsx
 * Last onboarding step (D10 step 8): a quick human check (Turnstile, G13),
 * then volunteer.completeProfile. The Turnstile check sits here, right
 * before the one call that consumes its token, because tokens expire after
 * a few minutes and onboarding can take longer than that. Server errors use
 * the D22 notice (for example AGE_UNDER_13 or TURNSTILE_FAILED).
 */
import { useCallback, useState, type ReactElement } from "react";
import type { UserError } from "@fbla/shared";
import { ErrorNotice } from "@/components/errors/ErrorNotice";
import { ApiError, NETWORK_USER_ERROR, api } from "@/lib/api";
import { toCompleteProfileInput, type OnboardingDraft } from "@/lib/onboardingDraft";
import { StepFrame } from "./StepFrame";
import { TurnstileWidget, type TurnstileStatus } from "./TurnstileWidget";

interface FinishStepProps {
  readonly stepNumber: number;
  readonly stepCount: number;
  readonly draft: OnboardingDraft;
  readonly onBack: () => void;
  readonly onDone: () => void;
}

export const FinishStep = ({ stepNumber, stepCount, draft, onBack, onDone }: FinishStepProps): ReactElement => {
  const [token, setToken] = useState<string | null>(null);
  const [turnstileStatus, setTurnstileStatus] = useState<TurnstileStatus>("loading");
  const [error, setError] = useState<UserError | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const onToken = useCallback((value: string | null) => setToken(value), []);
  const onStatus = useCallback((status: TurnstileStatus) => setTurnstileStatus(status), []);

  const canFinish = token !== null || turnstileStatus === "skipped";

  const finish = async (): Promise<void> => {
    if (!canFinish) {
      setError({ ...NETWORK_USER_ERROR, title: "One more thing", message: "Finish the human check above first.", fix: "Wait for the check to load." });
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await api.volunteer.completeProfile(toCompleteProfileInput(draft, token));
      onDone();
    } catch (saveError) {
      setError(saveError instanceof ApiError ? saveError.userError : NETWORK_USER_ERROR);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <StepFrame
      stepNumber={stepNumber}
      stepCount={stepCount}
      title="Almost done"
      description="One quick check that you're a person, then you can start finding shifts."
      onSubmit={(event) => {
        event.preventDefault();
        void finish();
      }}
      onBack={onBack}
      submitLabel="Finish"
      isSubmitting={isSaving}
    >
      <TurnstileWidget onToken={onToken} onStatus={onStatus} />
      {error ? <ErrorNotice error={error} /> : null}
    </StepFrame>
  );
};

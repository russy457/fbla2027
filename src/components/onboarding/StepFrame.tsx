/**
 * StepFrame.tsx
 * Shared layout for one onboarding step: a progress indicator ("Step 2 of
 * 7", D10), the step heading (focused when the step appears so screen reader
 * and keyboard users start at the top, D20), the fields, and the Back / Skip /
 * Continue buttons. Each step owns its <form> and validation.
 */
import { useEffect, useRef, type FormEvent, type ReactElement, type ReactNode } from "react";
import { buttonClassName } from "@/components/ui/buttonStyles";

interface StepFrameProps {
  readonly stepNumber: number;
  readonly stepCount: number;
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly onBack?: () => void;
  readonly onSkip?: () => void;
  readonly submitLabel?: string;
  readonly isSubmitting?: boolean;
}

export const StepFrame = ({
  stepNumber,
  stepCount,
  title,
  description,
  children,
  onSubmit,
  onBack,
  onSkip,
  submitLabel = "Continue",
  isSubmitting = false
}: StepFrameProps): ReactElement => {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);

  return (
    <form noValidate onSubmit={onSubmit} className="flex max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-fg-muted">
          Step {stepNumber} of {stepCount}
        </p>
        <div aria-hidden="true" className="flex gap-1.5">
          {Array.from({ length: stepCount }, (_, index) => (
            <span key={`step-${index}`} className={`h-1.5 flex-1 rounded-full ${index < stepNumber ? "bg-accent" : "bg-surface-sunken"}`} />
          ))}
        </div>
        <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-semibold tracking-tight text-fg outline-none">
          {title}
        </h1>
        {description ? <p className="text-fg-muted">{description}</p> : null}
      </div>
      {children}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={isSubmitting} className={buttonClassName("primary")}>
          {isSubmitting ? "Saving..." : submitLabel}
        </button>
        {onSkip ? (
          <button type="button" onClick={onSkip} className={buttonClassName("secondary")}>
            Skip for now
          </button>
        ) : null}
        {onBack ? (
          <button type="button" onClick={onBack} className={buttonClassName("quiet")}>
            Back
          </button>
        ) : null}
      </div>
    </form>
  );
};

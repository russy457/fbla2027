/**
 * WriteFeedback.tsx
 * The result line under a collection or review form: a polite status on
 * success and an alert on failure (D20 aria-live; status never by color
 * alone, so the failure carries an icon and words).
 */
import type { ReactElement } from "react";
import { WarningCircle } from "@phosphor-icons/react";

interface WriteFeedbackProps {
  readonly message: string | null;
  readonly error: string | null;
}

export const WriteFeedback = ({ message, error }: WriteFeedbackProps): ReactElement => (
  <>
    <p role="status" className="text-sm font-medium text-fg empty:hidden">
      {message ?? ""}
    </p>
    {error ? (
      <p role="alert" className="flex items-start gap-1.5 text-sm font-medium text-status-danger">
        <WarningCircle aria-hidden="true" size={18} className="mt-px shrink-0" />
        {error}
      </p>
    ) : null}
  </>
);

/**
 * OpFeedback.tsx
 * The result line under a coordinator or admin action: a polite role=status
 * message after success, or the catalog ErrorNotice with Details expanded
 * (D22: coordinators and admins see the request reference by default).
 */
import type { ReactElement } from "react";
import type { UserError } from "@fbla/shared";
import { ErrorNotice } from "@/components/errors/ErrorNotice";

interface OpFeedbackProps {
  readonly message: string | null;
  readonly error: UserError | null;
}

export const OpFeedback = ({ message, error }: OpFeedbackProps): ReactElement => (
  <>
    <p role="status" className="text-sm font-medium text-fg empty:hidden">
      {message ?? ""}
    </p>
    {error ? <ErrorNotice error={error} expandDetails /> : null}
  </>
);

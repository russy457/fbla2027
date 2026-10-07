/**
 * FinalizeShiftButton.tsx
 * Coordinator "Finalize shift" (SPEC#fn-finalizeshift, SPEC 5.5). Enabled
 * once the shift has ended (the server refuses earlier with SHIFT_NOT_ENDED).
 * Finalizing marks remaining confirmed signups as no-shows (or excused for
 * late promotions) and completes anyone still checked in, with their hours
 * sent to review. The result is summarized in a status line.
 */
import { useState, type ReactElement } from "react";
import type { UserError } from "@fbla/shared";
import { ErrorNotice } from "@/components/errors/ErrorNotice";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { ApiError, NETWORK_USER_ERROR, api } from "@/lib/api";

interface FinalizeShiftButtonProps {
  readonly instanceId: string;
  readonly hasEnded: boolean;
  readonly isFinalized: boolean;
}

export const FinalizeShiftButton = ({ instanceId, hasEnded, isFinalized }: FinalizeShiftButtonProps): ReactElement => {
  const [isPending, setIsPending] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<UserError | null>(null);

  const finalize = async (): Promise<void> => {
    setIsPending(true);
    setError(null);
    try {
      const out = await api.coordinator.finalizeShift({ instanceId });
      setSummary(
        out.alreadyFinalized
          ? "This shift was already finalized."
          : `Shift finalized: ${out.noShows} no-shows, ${out.excused} excused, ${out.autoCompleted} checked out automatically (hours go to review).`
      );
    } catch (finalizeError) {
      setError(finalizeError instanceof ApiError ? finalizeError.userError : NETWORK_USER_ERROR);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button type="button" disabled={!hasEnded || isFinalized || isPending} onClick={() => void finalize()} className={buttonClassName("secondary")}>
        {isPending ? "Finalizing..." : isFinalized ? "Shift finalized" : "Finalize shift"}
      </button>
      {!hasEnded && !isFinalized ? <p className="text-sm text-fg-muted">Available after the shift ends.</p> : null}
      {summary ? (
        <p role="status" className="text-sm font-medium text-fg">
          {summary}
        </p>
      ) : null}
      {error ? <ErrorNotice error={error} expandDetails /> : null}
    </div>
  );
};

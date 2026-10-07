/**
 * CancelShiftControl.tsx
 * "Cancel shift" for a coordinator (SPEC#fn-cancelinstance): a two-step
 * confirm with a required reason (3-200 characters). Cancelling releases
 * every signup (waitlisted and confirmed become cancelled; anyone checked in
 * mid-shift is completed with hours sent to review). Refused after the shift
 * ends (SHIFT_ENDED), shown with the catalog copy.
 */
import { useEffect, useRef, useState, type ReactElement } from "react";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { TextField } from "@/components/ui/TextField";
import { useOpRunner } from "@/hooks/useOpRunner";
import { api } from "@/lib/api";
import { OpFeedback } from "./OpFeedback";

export const CancelShiftControl = ({ instanceId, isCancelled }: { instanceId: string; isCancelled: boolean }): ReactElement => {
  const [isConfirming, setIsConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | undefined>(undefined);
  const runner = useOpRunner();
  const openButton = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (isConfirming) heading.current?.focus();
  }, [isConfirming]);

  const close = (): void => {
    setIsConfirming(false);
    window.requestAnimationFrame(() => openButton.current?.focus());
  };

  const confirm = async (): Promise<void> => {
    if (reason.trim().length < 3 || reason.trim().length > 200) return setReasonError("Write a reason of 3 to 200 characters.");
    setReasonError(undefined);
    const result = await runner.run(
      "cancel",
      () => api.coordinator.cancelInstance({ instanceId, reason: reason.trim() }),
      (out) => `Shift cancelled: ${out.cancelledSignups} signups released, ${out.completedSignups} completed with hours sent to review.`
    );
    if (result) setIsConfirming(false);
  };

  if (isCancelled) return <p className="text-sm text-fg-muted">This shift was cancelled.</p>;

  return (
    <div className="flex flex-col gap-3">
      {isConfirming ? (
        <section aria-labelledby="cancel-shift-title" className="flex max-w-lg flex-col gap-3 rounded-lg border border-status-danger bg-status-danger-subtle p-4">
          <h3 id="cancel-shift-title" ref={heading} tabIndex={-1} className="font-semibold text-fg outline-none">
            Cancel this shift for everyone?
          </h3>
          <p className="text-sm text-fg">Signed-up volunteers lose their spot and are told it was cancelled. This can't be undone.</p>
          <TextField label="Reason" value={reason} maxLength={200} onChange={(event) => setReason(event.target.value)} error={reasonError} />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void confirm()} disabled={runner.pending !== null} className={buttonClassName("primary")}>
              {runner.pending ? "Cancelling..." : "Confirm cancel shift"}
            </button>
            <button type="button" onClick={close} disabled={runner.pending !== null} className={buttonClassName("quiet")}>
              Keep the shift
            </button>
          </div>
        </section>
      ) : (
        <button ref={openButton} type="button" onClick={() => setIsConfirming(true)} className={buttonClassName("secondary", "w-fit")}>
          Cancel shift
        </button>
      )}
      <OpFeedback message={runner.message} error={runner.error} />
    </div>
  );
};

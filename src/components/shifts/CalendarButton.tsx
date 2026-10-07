/**
 * CalendarButton.tsx
 * "Add to calendar" for a signed-up shift, or "Download cancellation" for a
 * cancelled one (SPEC#ics 8.7, E2; D5 Signed up and Cancelled rows). Loads
 * the opportunity for its address and description when clicked, then saves
 * the .ics. A cancellation also shows the best-effort note, because some
 * calendar apps ignore cancellation files.
 */
import { useState, type ReactElement } from "react";
import { CalendarPlus, CalendarX } from "@phosphor-icons/react";
import { buttonClassName } from "@/components/ui/buttonStyles";
import type { Instance } from "@/lib/data/instances";
import { getOpportunity } from "@/lib/data/opportunities";
import { CANCELLATION_NOTE, downloadSignupIcs } from "@/lib/icsDownload";

interface CalendarButtonProps {
  readonly instance: Instance;
  readonly signupId: string;
  readonly cancelled: boolean;
}

export const CalendarButton = ({ instance, signupId, cancelled }: CalendarButtonProps): ReactElement => {
  const [isPreparing, setIsPreparing] = useState(false);
  const label = cancelled ? "Download cancellation" : "Add to calendar";
  const Icon = cancelled ? CalendarX : CalendarPlus;

  const download = async (): Promise<void> => {
    setIsPreparing(true);
    try {
      // The address is optional: if the opportunity cannot load, the file still has the time and org.
      const opportunity = await getOpportunity(instance.opportunityId).catch(() => null);
      downloadSignupIcs({ signupId, instance, opportunity, cancelled });
    } finally {
      setIsPreparing(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1 md:items-end">
      <button
        type="button"
        onClick={() => void download()}
        disabled={isPreparing}
        aria-label={`${label}: ${instance.title}`}
        className={buttonClassName("quiet")}
      >
        <Icon aria-hidden="true" size={18} />
        {isPreparing ? "Preparing..." : label}
      </button>
      {cancelled ? <p className="max-w-[32ch] text-xs text-fg-muted md:text-right">{CANCELLATION_NOTE}</p> : null}
    </div>
  );
};

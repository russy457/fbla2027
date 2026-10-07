/**
 * DemoArc.tsx
 * What the phone shows right after check-out (SPEC#screen-demo-arc, D11):
 * "N hours logged at ORG", progress to the next milestone, and the primary
 * call to action "Get verified letter". Focus moves to the heading so screen
 * reader users hear the result first.
 *
 * A check-out that credits 0 minutes (SPEC#hours, for example in and out
 * before the shift began) comes back with needsReview: nothing was approved,
 * so the copy says a coordinator will review it and no letter button shows.
 */
import { useEffect, useRef, type ReactElement } from "react";
import { Link } from "react-router-dom";
import { Certificate } from "@phosphor-icons/react";
import { MilestoneProgress } from "@/components/impact/MilestoneProgress";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { formatMinutesAsHours } from "@/lib/formatHours";
import type { CheckOutResult } from "./CheckInPanel";

interface DemoArcProps {
  readonly result: CheckOutResult;
  readonly onDismiss: () => void;
}

const REVIEW_HEADING = "0 hours counted, your coordinator will review";
const REVIEW_BODY = "Checked out. Your check-in and check-out did not overlap the scheduled shift time, so no hours were added yet.";
const APPROVED_BODY = "Checked out. These hours came from the kiosk, so they are already approved.";

export const DemoArc = ({ result, onDismiss }: DemoArcProps): ReactElement => {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  const inReview = result.needsReview;
  const tone = inReview ? "border-status-warning bg-status-warning-subtle" : "border-status-success bg-status-success-subtle";

  return (
    <section aria-labelledby="demo-arc-title" className={`flex flex-col gap-5 rounded-lg border p-6 ${tone}`}>
      <h2 id="demo-arc-title" ref={headingRef} tabIndex={-1} className="text-2xl font-semibold text-fg outline-none">
        {inReview ? REVIEW_HEADING : `${formatMinutesAsHours(result.minutes)} logged at ${result.orgName}`}
      </h2>
      <p className="text-fg-muted">{inReview ? REVIEW_BODY : APPROVED_BODY}</p>
      <MilestoneProgress hours={result.totalApprovedHours} />
      <div className="flex flex-wrap gap-2">
        {inReview ? null : (
          <Link to="/impact#letter-builder" className={buttonClassName("primary")}>
            <Certificate aria-hidden="true" size={18} />
            Get verified letter
          </Link>
        )}
        <button type="button" onClick={onDismiss} className={buttonClassName(inReview ? "secondary" : "quiet")}>
          Done
        </button>
      </div>
    </section>
  );
};

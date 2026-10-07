/**
 * DemoArc.tsx
 * What the phone shows right after check-out (SPEC#screen-demo-arc, D11):
 * "N hours logged at ORG", progress to the next milestone, and the primary
 * call to action "Get verified letter". Focus moves to the heading so screen
 * reader users hear the result first.
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

export const DemoArc = ({ result, onDismiss }: DemoArcProps): ReactElement => {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);

  return (
    <section aria-labelledby="demo-arc-title" className="flex flex-col gap-5 rounded-lg border border-status-success bg-status-success-subtle p-6">
      <h2 id="demo-arc-title" ref={headingRef} tabIndex={-1} className="text-2xl font-semibold text-fg outline-none">
        {formatMinutesAsHours(result.minutes)} logged at {result.orgName}
      </h2>
      <p className="text-fg-muted">Checked out. These hours came from the kiosk, so they are already approved.</p>
      <MilestoneProgress hours={result.totalApprovedHours} />
      <div className="flex flex-wrap gap-2">
        <Link to="/impact#letter-builder" className={buttonClassName("primary")}>
          <Certificate aria-hidden="true" size={18} />
          Get verified letter
        </Link>
        <button type="button" onClick={onDismiss} className={buttonClassName("quiet")}>
          Done
        </button>
      </div>
    </section>
  );
};

/**
 * OrgLettersPanel.tsx
 * Letters that count this organization's hours (SPEC 3.4 letterRefs, Q21),
 * for the org owner on Org settings: volunteer display name, hours for this
 * org, issue date, and status (Valid / Superseded / Revoked with icon and
 * text). A valid or superseded letter can be revoked (SPEC 4.1: owners may
 * revoke letters that count their org).
 */
import { useState, type ReactElement } from "react";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useLetterRefs } from "@/hooks/useOrgAdmin";
import { useOpRunner } from "@/hooks/useOpRunner";
import { hoursLabel } from "@/lib/needsAttention";
import { LETTER_STATUS_LABELS } from "@/lib/statusLabels";
import { OpFeedback } from "./OpFeedback";
import { RevokeLetterForm } from "./RevokeLetterForm";

export const OrgLettersPanel = ({ orgId }: { orgId: string }): ReactElement => {
  const refs = useLetterRefs(orgId, true);
  const runner = useOpRunner();
  const [revoking, setRevoking] = useState<string | null>(null);

  if (refs.error) return <ErrorState title="We couldn't load letters" description="Check your connection, then reload." />;
  if (refs.isLoading) return <LoadingState label="Loading letters" lines={2} />;
  const letters = refs.data ?? [];

  return (
    <section aria-labelledby="letters-title" className="flex flex-col gap-3">
      <h2 id="letters-title" className="text-lg font-semibold text-fg">Letters that count your hours</h2>
      <OpFeedback message={runner.message} error={runner.error} />
      {letters.length === 0 ? <p className="text-fg-muted">No letters count this organization's hours yet.</p> : null}
      <ul className="divide-y divide-border">
        {letters.map((letter) => (
          <li key={letter.id} className="flex flex-col gap-2 py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-fg">
                <span className="font-semibold">{letter.displayName}</span>
                <span className="ml-2 text-sm text-fg-muted">
                  {hoursLabel(letter.minutesForOrg)}, issued {letter.issuedAt.toDate().toLocaleDateString("en-US", { dateStyle: "medium" })}
                </span>
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge {...LETTER_STATUS_LABELS[letter.status]} />
                {letter.status !== "revoked" && revoking !== letter.id ? (
                  <button type="button" onClick={() => setRevoking(letter.id)} className={buttonClassName("secondary")}>
                    {`Revoke letter for ${letter.displayName}`}
                  </button>
                ) : null}
              </div>
            </div>
            {revoking === letter.id ? <RevokeLetterForm letterId={letter.id} name={letter.displayName} runner={runner} onDone={() => setRevoking(null)} /> : null}
          </li>
        ))}
      </ul>
    </section>
  );
};

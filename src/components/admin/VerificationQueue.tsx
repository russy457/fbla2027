/**
 * VerificationQueue.tsx
 * Admin organization verification (SPEC 9.2 "Admin", admin.verifyOrganization):
 * organizations awaiting verification (Q26) with their EIN, contact, and
 * mission, each with an optional private note and "Verify NAME"; verified
 * organizations can be unverified. Verifying lets minors join the org's
 * shifts and counts its hours on letters (SPEC 4.2, 5.6).
 */
import { useState, type ReactElement } from "react";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { OpFeedback } from "@/components/org/OpFeedback";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { TextField } from "@/components/ui/TextField";
import { useAllOrganizations, useVerificationQueue } from "@/hooks/useAdminData";
import { useOpRunner, type OpRunner } from "@/hooks/useOpRunner";
import { api } from "@/lib/api";
import type { Organization } from "@/lib/data/orgs";

const PendingOrg = ({ org, runner }: { org: Organization; runner: OpRunner }): ReactElement => {
  const [note, setNote] = useState("");
  const verify = (): void => {
    void runner.run(`verify:${org.id}`, () => api.admin.verifyOrganization({ orgId: org.id, verified: true, ...(note.trim() ? { note: note.trim() } : {}) }), () => `${org.name} is verified.`);
  };
  return (
    <li className="flex flex-col gap-3 py-4">
      <div className="flex flex-col gap-1">
        <p className="font-semibold text-fg">{org.name}</p>
        <p className="text-sm text-fg-muted">
          EIN <span className="font-mono">{org.ein}</span>, {org.contactEmail}, {org.address.city}, {org.address.state}
        </p>
        {org.mission ? <p className="text-sm text-fg">{org.mission}</p> : null}
      </div>
      <TextField label={`Note for ${org.name} (optional, private)`} value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} className="max-w-md" />
      <button type="button" disabled={runner.pending !== null} onClick={verify} className={buttonClassName("primary", "w-fit")}>
        {runner.pending === `verify:${org.id}` ? "Verifying..." : `Verify ${org.name}`}
      </button>
    </li>
  );
};

export const VerificationQueue = (): ReactElement => {
  const queue = useVerificationQueue();
  const all = useAllOrganizations();
  const runner = useOpRunner();

  if (queue.error || all.error) return <ErrorState title="We couldn't load organizations" description="Check your connection, then reload." />;
  if (queue.isLoading || all.isLoading) return <LoadingState label="Loading organizations" lines={3} />;
  const verified = (all.data ?? []).filter((org) => org.verified && !org.archived).sort((a, b) => a.name.localeCompare(b.name));
  const unverify = (org: Organization): void => {
    void runner.run(`unverify:${org.id}`, () => api.admin.verifyOrganization({ orgId: org.id, verified: false }), () => `${org.name} is no longer verified.`);
  };

  return (
    <section aria-labelledby="verification-title" className="flex flex-col gap-4">
      <h2 id="verification-title" className="text-xl font-semibold text-fg">Organizations awaiting verification</h2>
      <OpFeedback message={runner.message} error={runner.error} />
      {(queue.data ?? []).length === 0 ? <p className="text-fg-muted">No organizations are waiting.</p> : null}
      <ul className="divide-y divide-border">
        {(queue.data ?? []).map((org) => (
          <PendingOrg key={org.id} org={org} runner={runner} />
        ))}
      </ul>
      <details className="flex flex-col gap-2">
        <summary className="inline-flex min-h-touch cursor-pointer items-center font-semibold text-fg">Verified organizations ({verified.length})</summary>
        <ul className="divide-y divide-border">
          {verified.map((org) => (
            <li key={org.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="text-fg">{org.name}</span>
              <button type="button" disabled={runner.pending !== null} onClick={() => unverify(org)} className={buttonClassName("secondary")}>
                {`Unverify ${org.name}`}
              </button>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
};

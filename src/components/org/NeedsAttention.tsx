/**
 * NeedsAttention.tsx
 * The coordinator's Needs attention queue on the dashboard
 * (SPEC#screen-needs-attention D9, Tier 1): needsReview hours logs (including
 * 0-minute ones), pending manual entries, and open attendance disputes,
 * grouped by shift. Inline Approve / Reject (reason required); disputes open
 * setAttendance with a required note; "Approve all" covers the
 * kiosk-verified (needsReview) rows of one shift.
 *   NeedsAttention      container: live Firestore reads, then the list
 *   NeedsAttentionList  presentational: groups + actions (tested directly)
 * Rows disappear on their own when the listener sees the new status.
 */
import { useState, type ReactElement } from "react";
import { formatShiftTime } from "@fbla/shared";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { useOpenDisputes, useOrgSignups, usePendingLogs } from "@/hooks/useOrgAdmin";
import { useOpRunner } from "@/hooks/useOpRunner";
import { useOrgInstances } from "@/hooks/useShiftData";
import { api } from "@/lib/api";
import { buildAttentionGroups, type AttentionGroup } from "@/lib/needsAttention";
import { DisputeRow, LogRow } from "./NeedsAttentionRows";
import { OpFeedback } from "./OpFeedback";

const GroupHeader = ({ group }: { group: AttentionGroup }): ReactElement => (
  <div className="flex flex-col gap-0.5">
    <h3 className="font-semibold text-fg">{group.title}</h3>
    {group.startMs !== null && group.timeZone !== null ? (
      <p className="font-mono text-sm text-fg-muted">{formatShiftTime(new Date(group.startMs), group.timeZone)}</p>
    ) : null}
  </div>
);

export const NeedsAttentionList = ({ groups }: { groups: readonly AttentionGroup[] }): ReactElement => {
  const runner = useOpRunner();
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const onDisputeSaved = (message: string): void => {
    runner.reset();
    setSavedMessage(message);
  };
  const approveAll = (group: AttentionGroup): void => {
    setSavedMessage(null);
    void runner.run(`all:${group.key}`, () => api.coordinator.approveHours({ logIds: group.approvableLogIds.slice(0, 50) }), (out) => `Approved ${out.approved} entries for ${group.title}.`);
  };

  return (
    <section aria-labelledby="needs-attention-title" className="flex flex-col gap-4">
      <h2 id="needs-attention-title" className="border-b border-border-strong pb-2 text-lg font-semibold text-fg">
        Needs attention
      </h2>
      <OpFeedback message={runner.message ?? savedMessage} error={runner.error} />
      {groups.length === 0 ? <p className="text-fg-muted">Nothing needs your review.</p> : null}
      {groups.map((group) => (
        <div key={group.key} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <GroupHeader group={group} />
            {group.approvableLogIds.length > 1 ? (
              <button type="button" disabled={runner.pending !== null} onClick={() => approveAll(group)} className={buttonClassName("secondary")}>
                {runner.pending === `all:${group.key}` ? "Approving..." : `Approve all reviewed hours for ${group.title}`}
              </button>
            ) : null}
          </div>
          <ul className="divide-y divide-border">
            {group.items.map((item) =>
              item.kind === "log" ? (
                <LogRow key={`log:${item.id}`} item={item} runner={runner} />
              ) : (
                <DisputeRow key={`dispute:${item.id}`} item={item} onSaved={onDisputeSaved} />
              )
            )}
          </ul>
        </div>
      ))}
    </section>
  );
};

export const NeedsAttention = ({ orgId }: { orgId: string }): ReactElement => {
  const logs = usePendingLogs(orgId);
  const disputes = useOpenDisputes(orgId);
  const signups = useOrgSignups(orgId);
  const shifts = useOrgInstances(orgId);

  if (logs.error || disputes.error || signups.error || shifts.error) {
    return <ErrorState title="We couldn't load items that need review" description="Check your connection, then reload." />;
  }
  if (logs.isLoading || disputes.isLoading || signups.isLoading || shifts.isLoading) {
    return <LoadingState label="Loading items that need review" lines={3} />;
  }
  const groups = buildAttentionGroups(logs.data ?? [], disputes.data ?? [], signups.data ?? [], shifts.data ?? []);
  return <NeedsAttentionList groups={groups} />;
};

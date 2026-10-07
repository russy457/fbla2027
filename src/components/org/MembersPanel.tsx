/**
 * MembersPanel.tsx
 * Organization members on Org settings (SPEC 9.2, coordinator.removeMember):
 * display name and role for everyone; the owner can remove a coordinator
 * after a confirm. The owner row never offers Remove (CANNOT_REMOVE_OWNER).
 */
import { useState, type ReactElement } from "react";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { useMembers } from "@/hooks/useOrgAdmin";
import { useOpRunner } from "@/hooks/useOpRunner";
import { api } from "@/lib/api";
import { OpFeedback } from "./OpFeedback";

export const MembersPanel = ({ orgId, isOwner }: { orgId: string; isOwner: boolean }): ReactElement => {
  const members = useMembers(orgId);
  const runner = useOpRunner();
  const [confirming, setConfirming] = useState<string | null>(null);

  if (members.error) return <ErrorState title="We couldn't load members" description="Check your connection, then reload." />;
  if (members.isLoading) return <LoadingState label="Loading members" lines={2} />;
  const sorted = [...(members.data ?? [])].sort((a, b) => (a.role === b.role ? a.displayName.localeCompare(b.displayName) : a.role === "owner" ? -1 : 1));

  const remove = (uid: string, name: string): void => {
    setConfirming(null);
    void runner.run(`remove:${uid}`, () => api.coordinator.removeMember({ orgId, uid }), () => `${name} was removed.`);
  };

  return (
    <section aria-labelledby="members-title" className="flex flex-col gap-3">
      <h2 id="members-title" className="text-lg font-semibold text-fg">Members</h2>
      <ul className="divide-y divide-border">
        {sorted.map((member) => (
          <li key={member.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-fg">
              <span className="font-semibold">{member.displayName}</span>
              <span className="ml-2 text-sm text-fg-muted">{member.role === "owner" ? "Owner" : "Coordinator"}</span>
            </p>
            {isOwner && member.role !== "owner" ? (
              confirming === member.id ? (
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={runner.pending !== null} onClick={() => remove(member.id, member.displayName)} className={buttonClassName("primary")}>
                    {`Confirm remove ${member.displayName}`}
                  </button>
                  <button type="button" onClick={() => setConfirming(null)} className={buttonClassName("quiet")}>Keep</button>
                </div>
              ) : (
                <button type="button" disabled={runner.pending !== null} onClick={() => setConfirming(member.id)} className={buttonClassName("secondary")}>
                  {`Remove ${member.displayName}`}
                </button>
              )
            ) : null}
          </li>
        ))}
      </ul>
      <OpFeedback message={runner.message} error={runner.error} />
    </section>
  );
};

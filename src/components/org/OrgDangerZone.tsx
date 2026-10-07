/**
 * OrgDangerZone.tsx
 * Archive and delete for the org owner (SPEC 5.8 updateOrganization):
 *   Archive  one-way; hides the org from Explore; refused while upcoming
 *            shifts have volunteers (ORG_HAS_UPCOMING_SHIFTS)
 *   Delete   offered only before any volunteer history (hasActivity false);
 *            the server refuses otherwise (ORG_HAS_ACTIVITY)
 * Each needs a second confirm. After delete, the owner returns to Explore.
 */
import { useState, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { useOpRunner } from "@/hooks/useOpRunner";
import { api } from "@/lib/api";
import { OpFeedback } from "./OpFeedback";

type Action = "archive" | "delete";

interface OrgDangerZoneProps {
  readonly orgId: string;
  readonly hasActivity: boolean;
  readonly isArchived: boolean;
}

const COPY: Readonly<Record<Action, { label: string; confirm: string; warning: string }>> = {
  archive: {
    label: "Archive organization",
    confirm: "Confirm archive",
    warning: "Archiving is permanent. The organization disappears from Explore, and its history stays for letters and reports."
  },
  delete: {
    label: "Delete organization",
    confirm: "Confirm delete",
    warning: "Deleting removes the organization, its shifts, and its invites. Only possible before anyone has volunteered."
  }
};

export const OrgDangerZone = ({ orgId, hasActivity, isArchived }: OrgDangerZoneProps): ReactElement => {
  const runner = useOpRunner();
  const [confirming, setConfirming] = useState<Action | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const run = async (action: Action): Promise<void> => {
    const result = await runner.run(action, () => api.coordinator.updateOrganization({ orgId, action }), () =>
      action === "archive" ? "The organization is archived." : "The organization was deleted."
    );
    setConfirming(null);
    if (result) await queryClient.invalidateQueries({ queryKey: ["organization", orgId] });
    if (result?.deleted) {
      await queryClient.invalidateQueries({ queryKey: ["myMemberships"] });
      navigate("/", { replace: true });
    }
  };

  const actions: Action[] = [...(isArchived ? [] : (["archive"] as const)), ...(hasActivity ? [] : (["delete"] as const))];

  return (
    <section aria-labelledby="danger-title" className="flex flex-col gap-3 rounded-lg border border-status-danger p-4">
      <h2 id="danger-title" className="text-lg font-semibold text-fg">Archive or delete</h2>
      {isArchived ? <p className="text-sm text-fg">This organization is archived.</p> : null}
      {hasActivity ? <p className="text-sm text-fg-muted">This organization has volunteer history, so it can be archived but not deleted.</p> : null}
      {actions.map((action) => (
        <div key={action} className="flex flex-col gap-2">
          {confirming === action ? (
            <>
              <p className="text-sm text-fg">{COPY[action].warning}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={runner.pending !== null} onClick={() => void run(action)} className={buttonClassName("primary")}>
                  {runner.pending === action ? "Working..." : COPY[action].confirm}
                </button>
                <button type="button" onClick={() => setConfirming(null)} className={buttonClassName("quiet")}>Cancel</button>
              </div>
            </>
          ) : (
            <button type="button" onClick={() => setConfirming(action)} className={buttonClassName("secondary", "w-fit")}>
              {COPY[action].label}
            </button>
          )}
        </div>
      ))}
      <OpFeedback message={runner.message} error={runner.error} />
    </section>
  );
};

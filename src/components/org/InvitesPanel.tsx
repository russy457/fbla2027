/**
 * InvitesPanel.tsx
 * Coordinator invites for the org owner (SPEC 3.5, coordinator.createInvite).
 * "Create invite" returns a code that is shown exactly once (only its hash
 * is stored), with a copy button, the join link, and the expiry (7 days).
 * The list shows each invite as Open, Redeemed, or Expired; codes are never
 * shown again.
 */
import { useState, type ReactElement } from "react";
import { formatInviteCode } from "@fbla/shared";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { StatusBadge, type StatusTone } from "@/components/ui/StatusBadge";
import { useInvites } from "@/hooks/useOrgAdmin";
import { useOpRunner } from "@/hooks/useOpRunner";
import { api } from "@/lib/api";
import type { Invite } from "@/lib/data/orgAdmin";
import { OpFeedback } from "./OpFeedback";

const dateLabel = (ms: number): string => new Date(ms).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

const inviteState = (invite: Invite, nowMs: number): { tone: StatusTone; label: string } => {
  if (invite.redeemedBy !== null) return { tone: "success", label: "Redeemed" };
  if (invite.expiresAt.toMillis() <= nowMs) return { tone: "neutral", label: "Expired" };
  return { tone: "warning", label: "Open" };
};

const NewCode = ({ code, expiresAt }: { code: string; expiresAt: string }): ReactElement => {
  const [copied, setCopied] = useState<string>("Copy code");
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(formatInviteCode(code));
      setCopied("Copied");
    } catch {
      setCopied("Copy failed, select the code instead");
    }
  };
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-accent bg-accent-subtle p-4">
      <p className="text-sm font-semibold text-fg">New invite code (shown only once)</p>
      <p data-testid="invite-code" className="font-mono text-2xl font-semibold tracking-wider text-fg">{formatInviteCode(code)}</p>
      <p className="text-sm text-fg">The new coordinator opens Join an organization and enters this code. It expires {dateLabel(Date.parse(expiresAt))}.</p>
      <button type="button" onClick={() => void copy()} className={buttonClassName("secondary", "w-fit")}>
        <span aria-live="polite">{copied}</span>
      </button>
    </div>
  );
};

export const InvitesPanel = ({ orgId, nowMs }: { orgId: string; nowMs: number }): ReactElement => {
  const invites = useInvites(orgId, true);
  const runner = useOpRunner();
  const [created, setCreated] = useState<{ code: string; expiresAt: string } | null>(null);

  const create = async (): Promise<void> => {
    const result = await runner.run("create", () => api.coordinator.createInvite({ orgId }), () => "Invite created.");
    if (result) setCreated(result);
  };

  return (
    <section aria-labelledby="invites-title" className="flex flex-col gap-3">
      <h2 id="invites-title" className="text-lg font-semibold text-fg">Invites</h2>
      <p className="text-sm text-fg-muted">Invite another adult or student leader to help run shifts as a coordinator.</p>
      <button type="button" disabled={runner.pending !== null} onClick={() => void create()} className={buttonClassName("primary", "w-fit")}>
        {runner.pending ? "Creating..." : "Create invite"}
      </button>
      <OpFeedback message={runner.message} error={runner.error} />
      {created ? <NewCode code={created.code} expiresAt={created.expiresAt} /> : null}
      {invites.error ? <ErrorState title="We couldn't load invites" description="Check your connection, then reload." /> : null}
      {invites.isLoading ? <LoadingState label="Loading invites" lines={2} /> : null}
      {(invites.data ?? []).length > 0 ? (
        <ul className="divide-y divide-border">
          {(invites.data ?? []).map((invite) => (
            <li key={invite.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm text-fg">
              <span>Expires {dateLabel(invite.expiresAt.toMillis())}</span>
              <StatusBadge {...inviteState(invite, nowMs)} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
};

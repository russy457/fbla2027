/**
 * RankedVolunteersPanel.tsx
 * "Find volunteers" on a shift page (Tier 2, SPEC 8.4, 9.14, H2): ranks the
 * org's past volunteers and people who opted in to being found
 * (coordinator.rankVolunteers), then sends in-app invites to the ones the
 * coordinator picks (coordinator.inviteVolunteers -> shift-invite alerts).
 *
 * Privacy by construction: the list holds display names, a match percent,
 * and "why" chips only. Each row carries an opaque ref, never a uid, contact,
 * age, or location; refs expire after an hour, and an old list answers with
 * "This list is out of date. Rank again." Selection is native checkboxes;
 * results are announced in a role=status line (OpFeedback).
 */
import { useId, useState, type ReactElement } from "react";
import type { RankedCandidateView } from "@fbla/shared";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { useOpRunner } from "@/hooks/useOpRunner";
import { api } from "@/lib/api";
import { rankReasonText } from "@/lib/seriesForm";
import { OpFeedback } from "./OpFeedback";

interface RankedVolunteersPanelProps {
  readonly instanceId: string;
}

const inviteMessage = (out: { sent: number; skipped: number }): string => {
  const sent = out.sent === 1 ? "Invited 1 volunteer." : `Invited ${out.sent} volunteers.`;
  return out.skipped > 0 ? `${sent} ${out.skipped} skipped: already invited, already signed up, or no longer available.` : sent;
};

const CandidateRow = ({ candidate, checked, onToggle }: { candidate: RankedCandidateView; checked: boolean; onToggle: (on: boolean) => void }): ReactElement => {
  const id = useId();
  const percent = Math.round(candidate.score * 100);
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:gap-4">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <input id={id} type="checkbox" checked={checked} onChange={(event) => onToggle(event.target.checked)} className="mt-1 size-5 shrink-0 accent-accent" />
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor={id} className="cursor-pointer font-semibold text-fg">
            {candidate.displayName}
          </label>
          <ul aria-label={`Why ${candidate.displayName}`} className="flex flex-wrap gap-1.5">
            {candidate.why.map((reason) => (
              <li key={rankReasonText(reason)} className="rounded-full bg-accent-subtle px-2.5 py-0.5 text-xs font-semibold text-fg">
                {rankReasonText(reason)}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <span className="font-mono text-sm text-fg-muted sm:pt-1">{percent}% match</span>
    </li>
  );
};

export const RankedVolunteersPanel = ({ instanceId }: RankedVolunteersPanelProps): ReactElement => {
  const runner = useOpRunner();
  const [candidates, setCandidates] = useState<readonly RankedCandidateView[] | null>(null);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());

  const rank = async (): Promise<void> => {
    const out = await runner.run("rank", () => api.coordinator.rankVolunteers({ instanceId }), (result) =>
      result.candidates.length === 0 ? "No one to suggest yet." : `Found ${result.candidates.length} volunteers to invite.`
    );
    if (!out) return;
    setCandidates(out.candidates);
    setPicked(new Set());
  };

  const invite = async (): Promise<void> => {
    const out = await runner.run("invite", () => api.coordinator.inviteVolunteers({ instanceId, refs: [...picked] }), inviteMessage);
    if (out) setPicked(new Set());
  };

  const toggle = (ref: string, on: boolean): void =>
    setPicked((current) => {
      const next = new Set(current);
      if (on) next.add(ref);
      else next.delete(ref);
      return next;
    });

  return (
    <section aria-labelledby="find-volunteers" className="flex flex-col gap-4 rounded-lg border border-border p-4">
      <div className="flex flex-col gap-1">
        <h2 id="find-volunteers" className="text-lg font-semibold text-fg">
          Find volunteers
        </h2>
        <p className="max-w-[65ch] text-sm text-fg-muted">
          People who volunteered with you before or chose to be found, ranked by how well this shift fits them and how reliably they show up. You see first names and last initials only; invites arrive in their in-app alerts.
        </p>
      </div>
      <button type="button" onClick={() => void rank()} disabled={runner.pending !== null} className={buttonClassName(candidates === null ? "primary" : "secondary", "w-fit")}>
        {runner.pending === "rank" ? "Ranking..." : candidates === null ? "Rank volunteers" : "Rank again"}
      </button>
      {candidates !== null && candidates.length === 0 ? (
        <p className="text-fg-muted">No one to suggest yet. Volunteers appear here after they serve with you, or when they turn on "Let new organizations invite me" in their profile.</p>
      ) : null}
      {candidates !== null && candidates.length > 0 ? (
        <>
          <ul aria-label="Ranked volunteers" className="divide-y divide-border">
            {candidates.map((candidate) => (
              <CandidateRow key={candidate.ref} candidate={candidate} checked={picked.has(candidate.ref)} onToggle={(on) => toggle(candidate.ref, on)} />
            ))}
          </ul>
          <button type="button" onClick={() => void invite()} disabled={picked.size === 0 || runner.pending !== null} className={buttonClassName("primary", "w-fit")}>
            {runner.pending === "invite" ? "Sending..." : `Invite selected (${picked.size})`}
          </button>
        </>
      ) : null}
      <OpFeedback message={runner.message} error={runner.error} />
    </section>
  );
};

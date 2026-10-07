/**
 * RevokeLetterForm.tsx
 * The revoke step for a letter (SPEC#fn-revokeletter, SPEC 5.6): a reason
 * from the fixed list (its label is what /verify shows) and an optional
 * private note that never leaves the letter record. Shared by the org
 * owner's letters list and the admin "revoke by code" tool.
 */
import { useId, useState, type ReactElement } from "react";
import { REVOKE_REASONS, REVOKE_REASON_LABELS, type RevokeReason } from "@fbla/shared";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { TextAreaField } from "@/components/ui/TextAreaField";
import { INPUT_CLASSES } from "@/components/ui/TextField";
import type { OpRunner } from "@/hooks/useOpRunner";
import { api } from "@/lib/api";

interface RevokeLetterFormProps {
  readonly letterId: string;
  readonly name: string;
  readonly runner: OpRunner;
  readonly onDone: () => void;
}

export const RevokeLetterForm = ({ letterId, name, runner, onDone }: RevokeLetterFormProps): ReactElement => {
  const [reason, setReason] = useState<RevokeReason>("issued-in-error");
  const [note, setNote] = useState("");
  const reasonId = useId();
  const revoke = async (): Promise<void> => {
    const input = { letterId, reason, ...(note.trim() ? { note: note.trim() } : {}) };
    const result = await runner.run(`revoke:${letterId}`, () => api.coordinator.revokeLetter(input), (out) =>
      out.alreadyRevoked ? `The letter for ${name} was already revoked.` : `The letter for ${name} is revoked.`
    );
    if (result) onDone();
  };
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-status-danger bg-status-danger-subtle p-4">
      <div className="flex flex-col gap-2">
        <label htmlFor={reasonId} className="text-sm font-semibold text-fg">Reason (shown on the verify page)</label>
        <select id={reasonId} value={reason} onChange={(event) => setReason(event.target.value as RevokeReason)} className={INPUT_CLASSES}>
          {REVOKE_REASONS.map((value) => (
            <option key={value} value={value}>{REVOKE_REASON_LABELS[value]}</option>
          ))}
        </select>
      </div>
      <TextAreaField label="Private note (optional)" hint="Never shown on the verify page." maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={runner.pending !== null} onClick={() => void revoke()} className={buttonClassName("primary")}>
          {runner.pending === `revoke:${letterId}` ? "Revoking..." : "Revoke letter"}
        </button>
        <button type="button" onClick={onDone} className={buttonClassName("quiet")}>Cancel</button>
      </div>
    </div>
  );
};

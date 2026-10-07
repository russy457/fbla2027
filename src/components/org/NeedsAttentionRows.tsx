/**
 * NeedsAttentionRows.tsx
 * One row of the Needs attention queue (SPEC#screen-needs-attention D9):
 *   hours row     name, hours, source, status; Approve, or Reject with a
 *                 required reason (approveHours / rejectHours)
 *   dispute row   the volunteer's review note; Review attendance opens the
 *                 setAttendance editor
 * The row reports results upward so the list's single status line announces
 * them; buttons stay pending until the op returns.
 */
import { useRef, useState, type ReactElement } from "react";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TextAreaField } from "@/components/ui/TextAreaField";
import type { OpRunner } from "@/hooks/useOpRunner";
import { api } from "@/lib/api";
import { SOURCE_LABELS, hoursLabel, type AttentionItem } from "@/lib/needsAttention";
import { AttendanceEditor } from "./AttendanceEditor";

type LogItem = Extract<AttentionItem, { kind: "log" }>;
type DisputeItem = Extract<AttentionItem, { kind: "dispute" }>;

const RejectForm = ({ item, runner, onDone }: { item: LogItem; runner: OpRunner; onDone: () => void }): ReactElement => {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const confirm = async (): Promise<void> => {
    if (reason.trim().length < 3) {
      setError("Write a reason (at least 3 characters).");
      return;
    }
    const result = await runner.run(`reject:${item.id}`, () => api.coordinator.rejectHours({ logId: item.id, reason: reason.trim() }), () => `Hours for ${item.name} were not approved.`);
    if (result) onDone();
  };
  return (
    <div className="flex flex-col gap-2">
      <TextAreaField label="Reason for rejecting" hint="The volunteer sees this reason." value={reason} maxLength={500} error={error} onChange={(event) => setReason(event.target.value)} />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void confirm()} disabled={runner.pending !== null} className={buttonClassName("primary")}>
          {runner.pending === `reject:${item.id}` ? "Rejecting..." : "Confirm reject"}
        </button>
        <button type="button" onClick={onDone} className={buttonClassName("quiet")}>
          Cancel
        </button>
      </div>
    </div>
  );
};

export const LogRow = ({ item, runner }: { item: LogItem; runner: OpRunner }): ReactElement => {
  const [isRejecting, setIsRejecting] = useState(false);
  const rejectButton = useRef<HTMLButtonElement>(null);
  const closeReject = (): void => {
    setIsRejecting(false);
    window.requestAnimationFrame(() => rejectButton.current?.focus());
  };
  return (
    <li className="flex flex-col gap-3 py-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="font-semibold text-fg">{item.name}</p>
          <p className="text-sm text-fg-muted">
            {hoursLabel(item.minutes)}, {SOURCE_LABELS[item.source]}
          </p>
          {item.description ? <p className="text-sm text-fg">{item.description}</p> : null}
          <StatusBadge tone="warning" label={item.needsReview ? "Needs review" : "Pending"} className="w-fit" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={runner.pending !== null}
            onClick={() => void runner.run(`approve:${item.id}`, () => api.coordinator.approveHours({ logIds: [item.id] }), () => `Approved for ${item.name}: ${hoursLabel(item.minutes)}.`)}
            className={buttonClassName("primary")}
          >
            {runner.pending === `approve:${item.id}` ? "Approving..." : `Approve hours for ${item.name}`}
          </button>
          <button ref={rejectButton} type="button" disabled={runner.pending !== null || isRejecting} onClick={() => setIsRejecting(true)} className={buttonClassName("secondary")}>
            {`Reject hours for ${item.name}`}
          </button>
        </div>
      </div>
      {isRejecting ? <RejectForm item={item} runner={runner} onDone={closeReject} /> : null}
    </li>
  );
};

export const DisputeRow = ({ item, onSaved }: { item: DisputeItem; onSaved: (message: string) => void }): ReactElement => {
  const [isEditing, setIsEditing] = useState(false);
  const openButton = useRef<HTMLButtonElement>(null);
  const close = (message?: string): void => {
    setIsEditing(false);
    if (message) onSaved(message);
    window.requestAnimationFrame(() => openButton.current?.focus());
  };
  return (
    <li className="flex flex-col gap-3 py-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="font-semibold text-fg">{item.name}</p>
          <p className="text-sm text-fg-muted">Asked for a review of a no-show:</p>
          <blockquote className="border-l-2 border-border-strong pl-3 text-sm text-fg">{item.note}</blockquote>
          <StatusBadge tone="danger" label="No-show, review requested" className="w-fit" />
        </div>
        <button ref={openButton} type="button" disabled={isEditing} onClick={() => setIsEditing(true)} className={buttonClassName("secondary")}>
          {`Review attendance for ${item.name}`}
        </button>
      </div>
      {isEditing ? (
        <AttendanceEditor signupId={item.id} name={item.name} status={item.status} disputeOpen scheduledMinutes={item.scheduledMinutes} onClose={close} />
      ) : null}
    </li>
  );
};

/**
 * ErrorNotice.tsx
 * How a failed action is shown (SPEC#screen-errors, D22): a friendly title
 * and message from the shared catalog, the next step, a Help Center link when
 * the catalog names one, and a "Details" disclosure with a copyable request
 * ID. Details start collapsed for volunteers and expanded for coordinators
 * and admins (`expandDetails`). role="alert" announces it when it appears.
 */
import { useState, type ReactElement } from "react";
import { Link } from "react-router-dom";
import { Copy, WarningCircle } from "@phosphor-icons/react";
import type { UserError } from "@fbla/shared";
import { articlePath } from "@/components/help/articleLinks";
import { cn } from "@/lib/cn";

interface ErrorNoticeProps {
  readonly error: UserError;
  /** Expanded by default for coordinators and admins (D22). */
  readonly expandDetails?: boolean;
  readonly className?: string;
}

type CopyState = "idle" | "copied" | "failed";

const COPY_LABELS: Readonly<Record<CopyState, string>> = {
  idle: "Copy reference",
  copied: "Copied",
  failed: "Copy failed, select the text instead"
};

export const ErrorNotice = ({ error, expandDetails = false, className }: ErrorNoticeProps): ReactElement => {
  const [copyState, setCopyState] = useState<CopyState>("idle");

  const copyRequestId = async (): Promise<void> => {
    if (!error.requestId) return;
    try {
      await navigator.clipboard.writeText(error.requestId);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };

  return (
    <div role="alert" className={cn("flex flex-col gap-2 rounded-md border border-status-danger bg-status-danger-subtle p-4", className)}>
      <p className="flex items-start gap-2 font-semibold text-fg">
        <WarningCircle aria-hidden="true" size={20} weight="bold" className="mt-0.5 shrink-0 text-status-danger" />
        <span>{error.title}</span>
      </p>
      <p className="text-fg">{error.message}</p>
      {error.fix ? <p className="text-sm text-fg-muted">Next step: {error.fix}</p> : null}
      {error.helpSlug ? (
        <Link to={articlePath(error.helpSlug)} className="w-fit text-sm font-semibold text-accent underline underline-offset-2">
          Read the help article
        </Link>
      ) : null}
      <details open={expandDetails} className="text-sm text-fg-muted">
        <summary className="inline-flex min-h-touch cursor-pointer items-center font-medium text-fg">Details</summary>
        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt>Code</dt>
          <dd className="font-mono break-all text-fg">{error.code ?? "UNKNOWN"}</dd>
          <dt>Reference</dt>
          <dd className="font-mono break-all text-fg">{error.requestId ?? "Not available"}</dd>
        </dl>
        {error.requestId ? (
          <button
            type="button"
            onClick={() => void copyRequestId()}
            className="mt-2 inline-flex min-h-touch items-center gap-2 rounded-md border border-border-strong bg-surface px-3 font-semibold text-fg hover:bg-surface-sunken"
          >
            <Copy aria-hidden="true" size={16} />
            <span aria-live="polite">{COPY_LABELS[copyState]}</span>
          </button>
        ) : null}
      </details>
    </div>
  );
};

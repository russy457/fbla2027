/**
 * ErrorState.tsx
 * Inline panel for a failed section or page: what went wrong, what to do, and
 * an optional retry action. Ported from the old app and restyled with tokens.
 * Uses role="alert" so screen readers announce it when it appears.
 */
import type { ReactElement } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { buttonClassName } from "./ui/buttonStyles";

interface ErrorStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const ErrorState = ({
  title = "Unable to load this section",
  description = "Please retry. If this continues, check your connection and refresh.",
  actionLabel = "Retry",
  onAction
}: ErrorStateProps): ReactElement => (
  <section role="alert" className="flex max-w-xl flex-col items-start gap-3 rounded-lg border border-border bg-surface p-6">
    <WarningCircle aria-hidden="true" size={28} weight="duotone" className="text-status-danger" />
    <h2 className="text-lg font-semibold text-fg">{title}</h2>
    <p className="text-fg-muted">{description}</p>
    {onAction ? (
      <button type="button" className={buttonClassName("primary")} onClick={onAction}>
        {actionLabel}
      </button>
    ) : null}
  </section>
);

/**
 * StatusBadge.tsx
 * The one way any status is shown (SPEC#screen-status-tokens, D14): an icon
 * plus a text label on a tinted background, using only the four status
 * tokens. Color is never the only signal, so the label always renders.
 *
 *   <StatusBadge tone="success" label="Valid" />
 */
import type { ReactElement } from "react";
import { CheckCircle, Clock, MinusCircle, XCircle, type Icon } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

export type StatusTone = "success" | "warning" | "danger" | "neutral";

const TONE_CLASSES: Readonly<Record<StatusTone, string>> = {
  success: "bg-status-success-subtle text-status-success",
  warning: "bg-status-warning-subtle text-status-warning",
  danger: "bg-status-danger-subtle text-status-danger",
  neutral: "bg-status-neutral-subtle text-status-neutral"
};

/** D14 icons: check, clock, x, dash. */
const TONE_ICONS: Readonly<Record<StatusTone, Icon>> = {
  success: CheckCircle,
  warning: Clock,
  danger: XCircle,
  neutral: MinusCircle
};

interface StatusBadgeProps {
  readonly tone: StatusTone;
  readonly label: string;
  readonly size?: "sm" | "md";
  readonly className?: string;
}

export const StatusBadge = ({ tone, label, size = "sm", className }: StatusBadgeProps): ReactElement => {
  const ToneIcon = TONE_ICONS[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap",
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
        TONE_CLASSES[tone],
        className
      )}
    >
      <ToneIcon aria-hidden="true" size={size === "sm" ? 14 : 18} weight="bold" />
      {label}
    </span>
  );
};

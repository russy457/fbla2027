/**
 * UnverifiedChip.tsx
 * The "Unverified" organization chip (D23) with its explanation as a
 * tooltip that opens on hover and on keyboard focus (role="tooltip",
 * referenced by aria-describedby), so touch, mouse, and screen reader users
 * all get the same sentence before they sign up.
 */
import { useId, type ReactElement } from "react";
import { Info } from "@phosphor-icons/react";

export const UNVERIFIED_EXPLANATION = "Hours here won't appear on verified letters until this organization is verified.";

export const UnverifiedChip = (): ReactElement => {
  const tooltipId = useId();
  return (
    <span className="group relative inline-flex">
      <span
        tabIndex={0}
        aria-describedby={tooltipId}
        className="inline-flex items-center gap-1 rounded-full bg-status-neutral-subtle px-2.5 py-1 text-xs font-semibold text-status-neutral"
      >
        <Info aria-hidden="true" size={14} weight="bold" />
        Unverified
      </span>
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute top-full left-0 z-(--z-overlay) mt-2 w-64 rounded-md border border-border bg-surface p-3 text-xs font-normal text-fg opacity-0 shadow-md transition-opacity duration-(--duration-fast) group-focus-within:opacity-100 group-hover:opacity-100"
      >
        {UNVERIFIED_EXPLANATION}
      </span>
    </span>
  );
};

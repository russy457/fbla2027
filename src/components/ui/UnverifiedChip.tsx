/**
 * UnverifiedChip.tsx
 * The "Unverified" organization chip (D23) with its explanation as a
 * tooltip that opens on hover and on keyboard focus (role="tooltip",
 * referenced by aria-describedby), so touch, mouse, and screen reader users
 * all get the same sentence before they sign up. Hidden (display: none)
 * until opened, so a chip near the right edge never widens the page at 150%
 * text on a phone (D21).
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
        className="pointer-events-none absolute top-full left-0 z-(--z-overlay) mt-2 hidden w-64 max-w-[calc(100vw-2rem)] rounded-md border border-border bg-surface p-3 text-xs font-normal text-fg shadow-md group-focus-within:block group-hover:block"
      >
        {UNVERIFIED_EXPLANATION}
      </span>
    </span>
  );
};

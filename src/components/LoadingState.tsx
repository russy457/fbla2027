/**
 * LoadingState.tsx
 * Skeleton placeholder shown while a lazy route or a query loads. Ported from
 * the old app and restyled with tokens. Announces politely (aria-busy) and the
 * shimmer stops under reduced motion through the global motion rules.
 */
import type { ReactElement } from "react";

interface LoadingStateProps {
  lines?: number;
  label?: string;
}

const LINE_WIDTHS = ["w-3/4", "w-full", "w-5/6", "w-2/3"] as const;

export const LoadingState = ({ lines = 4, label = "Loading content" }: LoadingStateProps): ReactElement => (
  <section aria-live="polite" aria-busy="true" className="flex max-w-xl flex-col gap-3 py-2">
    <h2 className="sr-only">{label}</h2>
    <div className="h-8 w-1/2 animate-pulse rounded-md bg-surface-sunken" />
    {Array.from({ length: lines }, (_, index) => (
      <div
        key={`skeleton-line-${index}`}
        role="presentation"
        className={`h-4 animate-pulse rounded-sm bg-surface-sunken ${LINE_WIDTHS[index % LINE_WIDTHS.length]}`}
      />
    ))}
  </section>
);

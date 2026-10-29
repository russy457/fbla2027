/**
 * LoadingState.tsx
 * Shared route and query loading state. The bike is the visual cue, while
 * structural placeholders preserve the shape of incoming content.
 */
import type { ReactElement } from "react";
import { BikeLoader } from "./brand/BikeLoader";

interface LoadingStateProps {
  lines?: number;
  label?: string;
}

const LINE_WIDTHS = ["w-3/4", "w-full", "w-5/6", "w-2/3"] as const;

export const LoadingState = ({ lines = 4, label = "Loading content" }: LoadingStateProps): ReactElement => (
  <section aria-live="polite" className="loading-state flex max-w-xl flex-col gap-3 py-2">
    <BikeLoader />
    <p className="loading-state__label">{label}</p>
    {lines > 0 ? (
      <>
        <div className="h-8 w-1/2 rounded-md bg-surface-sunken" aria-hidden="true" />
        {Array.from({ length: lines }, (_, index) => (
          <div key={`skeleton-line-${index}`} aria-hidden="true" className={`h-4 rounded-sm bg-surface-sunken ${LINE_WIDTHS[index % LINE_WIDTHS.length]}`} />
        ))}
      </>
    ) : null}
  </section>
);

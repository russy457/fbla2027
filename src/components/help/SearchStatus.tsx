/**
 * SearchStatus.tsx
 * A polite live region that announces how many articles match the current
 * search (SPEC 9.16 aria-live). It is always rendered, even when empty, so
 * screen readers register the region before the first announcement. With
 * zero results it is visually hidden (still announced) because the empty
 * state right below already says "No articles match." on screen.
 */
import type { ReactElement } from "react";

interface SearchStatusProps {
  readonly query: string;
  readonly resultCount: number;
}

/** Plain-language count line; empty when there is no query yet. */
export const describeResultCount = (query: string, resultCount: number): string => {
  if (query.trim() === "") return "";
  if (resultCount === 0) return "No articles match.";
  return resultCount === 1 ? "1 article matches." : `${resultCount} articles match.`;
};

export const SearchStatus = ({ query, resultCount }: SearchStatusProps): ReactElement => (
  <p
    role="status"
    aria-live="polite"
    className={query.trim() !== "" && resultCount === 0 ? "sr-only" : "min-h-5 text-sm text-fg-muted"}
  >
    {describeResultCount(query, resultCount)}
  </p>
);

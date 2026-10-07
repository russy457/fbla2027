/**
 * NoResults.tsx
 * Help search empty state (SPEC 9.5, D6): says plainly that nothing matched
 * and offers the next step, which is browsing topics (and, once the AI
 * assistant ships, asking it). The typed query is shown as text, never HTML.
 */
import type { ReactElement, ReactNode } from "react";
import { FileMagnifyingGlass } from "@phosphor-icons/react";

interface NoResultsProps {
  readonly query: string;
  /** The way forward, e.g. a "Browse all topics" control. */
  readonly action?: ReactNode;
}

export const NoResults = ({ query, action }: NoResultsProps): ReactElement => (
  <div className="flex items-start gap-4 border-y border-border py-6">
    <FileMagnifyingGlass aria-hidden="true" size={28} className="mt-0.5 shrink-0 text-fg-subtle" />
    <div className="flex flex-col gap-2">
      <p className="text-base font-semibold text-fg">No articles match.</p>
      <p className="max-w-[60ch] text-sm text-fg-muted">
        Nothing in the Help Center mentions <q className="font-medium text-fg">{query.trim()}</q>. Try fewer or
        different words, check the spelling, or browse the topics.
      </p>
      {action}
    </div>
  </div>
);

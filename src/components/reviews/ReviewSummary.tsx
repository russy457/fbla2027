/**
 * ReviewSummary.tsx
 * The aggregate at the top of an org's reviews (SPEC 9.2 "Organization:
 * Reviews (Tier 2)"): the average as a large number with "out of 5", the
 * count, one bar per star value with its count printed (never shape alone),
 * and the most chosen tags. Pure: takes the shared summarizeReviews result.
 */
import type { ReactElement } from "react";
import { Star } from "@phosphor-icons/react";
import { REVIEW_TAG_LABELS, reviewSummaryText, type ReviewSummary as Summary } from "@fbla/shared";

export const ReviewSummary = ({ summary }: { summary: Summary }): ReactElement => {
  if (summary.average === null) return <p className="text-fg-muted">No reviews yet. Volunteers who finish a shift here can leave one.</p>;
  const max = Math.max(1, ...summary.ratings.map((row) => row.count));
  return (
    <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-start">
      <div className="flex flex-col">
        <p className="flex items-baseline gap-1.5">
          <span className="font-mono text-5xl font-semibold tracking-tight text-fg">{summary.average.toFixed(1)}</span>
          <span className="text-fg-muted">out of 5</span>
        </p>
        <p className="text-sm text-fg-muted">
          {summary.count} {summary.count === 1 ? "review" : "reviews"}
        </p>
        <p className="sr-only">{reviewSummaryText(summary)}</p>
      </div>
      <div className="flex flex-col gap-3">
        <ul aria-label="Reviews by rating" className="flex flex-col gap-1">
          {summary.ratings.map((row) => (
            <li key={row.rating} className="grid grid-cols-[3.5rem_1fr_2rem] items-center gap-2 text-sm">
              <span className="flex items-center gap-1 text-fg-muted">
                {row.rating}
                <Star aria-hidden="true" size={14} weight="fill" />
                <span className="sr-only">{row.rating === 1 ? "star" : "stars"}</span>
              </span>
              <span aria-hidden="true" className="h-2 rounded-full bg-surface-sunken">
                <span className="block h-2 rounded-full bg-accent" style={{ width: `${(row.count / max) * 100}%` }} />
              </span>
              <span className="text-right font-mono text-fg">{row.count}</span>
            </li>
          ))}
        </ul>
        {summary.tags.length > 0 ? (
          <ul aria-label="What volunteers mention" className="flex flex-wrap gap-2">
            {summary.tags.map((row) => (
              <li key={row.tag} className="rounded-full bg-accent-subtle px-3 py-1 text-sm text-accent">
                {REVIEW_TAG_LABELS[row.tag]} · {row.count}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
};

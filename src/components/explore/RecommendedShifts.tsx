/**
 * RecommendedShifts.tsx
 * The "Recommended" row on Explore (SPEC 9.2) and the "3 shifts that match
 * you" step after onboarding (SPEC 9.9): up to three simple shift entries, each with the
 * shift, its time in the org zone, and a one-line why. The first entry's
 * link is the screen's primary action ("Open the top recommended shift").
 * Without interests it shows the D6 empty state instead.
 */
import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "@phosphor-icons/react";
import { formatShiftTime } from "@fbla/shared";
import { OrgLink } from "@/components/ui/OrgLink";
import { UnverifiedChip } from "@/components/ui/UnverifiedChip";
import type { Recommendation } from "@/lib/explore/recommendations";

interface RecommendedShiftsProps {
  readonly picks: readonly Recommendation[];
  readonly hasInterests: boolean;
  readonly title?: string;
  /** Heading level: h2 on Explore, h1 on the onboarding finish screen. */
  readonly headingLevel?: 1 | 2;
}

export const RecommendedShifts = ({ picks, hasInterests, title = "Recommended", headingLevel = 2 }: RecommendedShiftsProps): ReactElement | null => {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const headingClass = headingLevel === 1 ? "recommended-shifts__heading outline-none" : "recommended-shifts__heading";

  if (!hasInterests) {
    return (
      <section aria-labelledby="recommended-title" className="recommended-shifts">
        <Heading id="recommended-title" tabIndex={headingLevel === 1 ? -1 : undefined} className={headingClass}>
          {title}
        </Heading>
        <p className="text-fg-muted">
          <Link to="/me/profile#interests" className="font-semibold text-accent underline underline-offset-2">
            Add interests
          </Link>{" "}
          to see shifts picked for you.
        </p>
      </section>
    );
  }
  if (picks.length === 0) return null;

  return (
    <section aria-labelledby="recommended-title" className="recommended-shifts">
      <Heading id="recommended-title" tabIndex={headingLevel === 1 ? -1 : undefined} className={headingClass}>
        {title}
      </Heading>
      <ul className="recommended-shifts__list">
        {picks.map(({ row, why }) => (
          <li key={row.instance.id} className="recommended-shifts__item">
            <h3>
              <Link to={`/opportunity/${encodeURIComponent(row.instance.id)}`} className="recommended-shifts__link">
                <span>{row.instance.title}</span>
                <ArrowUpRight aria-hidden="true" size={20} />
              </Link>
            </h3>
            <p className="recommended-shifts__time">{formatShiftTime(row.instance.start.toDate(), row.instance.timeZone)}</p>
            <p className="recommended-shifts__reason">{why}</p>
            <p className="recommended-shifts__org">
              <OrgLink orgId={row.instance.orgId} name={row.instance.orgName} />
              {row.instance.orgVerified ? null : <UnverifiedChip />}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
};

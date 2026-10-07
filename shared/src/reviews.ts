/**
 * reviews.ts
 * Pure helpers for org experience reviews (SPEC 3.20, Tier 2):
 *
 *   summarizeReviews(reviews)       the aggregate shown on the public org page:
 *                                   count, average rating (one decimal), how
 *                                   many reviews gave each star value, and
 *                                   how often each tag was chosen
 *   reviewableSignups(signups, ...) which of a volunteer's signups at an org
 *                                   may still be reviewed (completed, and not
 *                                   reviewed yet; the review id is the signup id)
 *   reviewerName(publicName, anon)  the name stored on the review: the public
 *                                   first name + last initial, or "A volunteer"
 *
 * Who may write is enforced by firestore.rules (the signup must be the
 * author's and completed); these helpers only decide what the UI offers.
 */
import { ANONYMOUS_REVIEWER_NAME, REVIEW_RATING_MAX, REVIEW_RATING_MIN, REVIEW_TAGS, type ReviewTag } from "./schemas/curationDocs";
import type { SignupStatus } from "./schemas/common";

export interface ReviewForSummary {
  readonly rating: number;
  readonly tags: readonly ReviewTag[];
}

export interface RatingCount {
  readonly rating: number;
  readonly count: number;
}

export interface TagCount {
  readonly tag: ReviewTag;
  readonly count: number;
}

export interface ReviewSummary {
  readonly count: number;
  /** Mean rating rounded to one decimal, or null with no reviews. */
  readonly average: number | null;
  /** Five rows, 5 stars first; every star value appears even at zero. */
  readonly ratings: RatingCount[];
  /** Tags chosen at least once, most common first, then in REVIEW_TAGS order. */
  readonly tags: TagCount[];
}

const STAR_VALUES = Array.from({ length: REVIEW_RATING_MAX - REVIEW_RATING_MIN + 1 }, (_, index) => REVIEW_RATING_MAX - index);

export const summarizeReviews = (reviews: readonly ReviewForSummary[]): ReviewSummary => {
  const count = reviews.length;
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  const tagCounts = REVIEW_TAGS.map((tag) => ({ tag, count: reviews.filter((review) => review.tags.includes(tag)).length }));
  return {
    count,
    average: count === 0 ? null : Math.round((total / count) * 10) / 10,
    ratings: STAR_VALUES.map((rating) => ({ rating, count: reviews.filter((review) => review.rating === rating).length })),
    tags: tagCounts
      .filter((row) => row.count > 0)
      .sort((a, b) => b.count - a.count || REVIEW_TAGS.indexOf(a.tag) - REVIEW_TAGS.indexOf(b.tag))
  };
};

/** "4.5 out of 5 from 12 reviews" (plain text for screen readers and the page). */
export const reviewSummaryText = (summary: Pick<ReviewSummary, "count" | "average">): string => {
  if (summary.average === null) return "No reviews yet";
  const noun = summary.count === 1 ? "review" : "reviews";
  return `${summary.average.toFixed(1)} out of 5 from ${summary.count} ${noun}`;
};

export interface ReviewableSignup {
  readonly id: string;
  readonly orgId: string;
  readonly status: SignupStatus;
}

/** The signups at `orgId` the volunteer attended and has not reviewed yet. */
export const reviewableSignups = <S extends ReviewableSignup>(signups: readonly S[], orgId: string, reviewedIds: ReadonlySet<string>): S[] =>
  signups.filter((signup) => signup.orgId === orgId && signup.status === "completed" && !reviewedIds.has(signup.id));

/** The name a new review carries (SPEC 4.2: first name + last initial, or anonymous). */
export const reviewerName = (publicDisplayName: string, anonymous: boolean): string => (anonymous ? ANONYMOUS_REVIEWER_NAME : publicDisplayName);

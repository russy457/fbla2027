/**
 * reviews.test.ts
 * Org experience reviews and curated collections (SPEC 3.19, 3.20, Tier 2):
 * the public aggregate, which signups may be reviewed, the anonymous name,
 * and the client-side schemas (lengths, unique items and tags, strict keys).
 */
import { describe, expect, it } from "vitest";
import {
  ANONYMOUS_REVIEWER_NAME,
  COLLECTION_ITEMS_MAX,
  REVIEW_TEXT_MAX,
  collectionFieldsSchema,
  curatedCollectionDocSchema,
  reviewDocSchema,
  reviewFieldsSchema
} from "./schemas/curationDocs";
import { reviewSummaryText, reviewableSignups, reviewerName, summarizeReviews } from "./reviews";

const ts = { toMillis: () => 0, toDate: () => new Date(0) };

describe("summarizeReviews", () => {
  it("is empty with no reviews", () => {
    const summary = summarizeReviews([]);
    expect(summary).toMatchObject({ count: 0, average: null, tags: [] });
    expect(summary.ratings.map((row) => row.rating)).toEqual([5, 4, 3, 2, 1]);
    expect(reviewSummaryText(summary)).toBe("No reviews yet");
  });

  it("averages to one decimal, counts stars, and orders tags by use", () => {
    const summary = summarizeReviews([
      { rating: 5, tags: ["welcoming", "accessible"] },
      { rating: 4, tags: ["accessible"] },
      { rating: 4, tags: ["well-organized"] }
    ]);
    expect(summary.average).toBe(4.3);
    expect(summary.ratings).toEqual([
      { rating: 5, count: 1 },
      { rating: 4, count: 2 },
      { rating: 3, count: 0 },
      { rating: 2, count: 0 },
      { rating: 1, count: 0 }
    ]);
    // accessible (2) first; then the ties in REVIEW_TAGS order.
    expect(summary.tags).toEqual([
      { tag: "accessible", count: 2 },
      { tag: "well-organized", count: 1 },
      { tag: "welcoming", count: 1 }
    ]);
    expect(reviewSummaryText(summary)).toBe("4.3 out of 5 from 3 reviews");
    expect(reviewSummaryText(summarizeReviews([{ rating: 5, tags: [] }]))).toBe("5.0 out of 5 from 1 review");
  });
});

describe("reviewableSignups and reviewerName", () => {
  it("offers completed signups at this org that have no review yet", () => {
    const signups = [
      { id: "s1", orgId: "orgA", status: "completed" as const },
      { id: "s2", orgId: "orgA", status: "completed" as const },
      { id: "s3", orgId: "orgA", status: "no-show" as const },
      { id: "s4", orgId: "orgB", status: "completed" as const }
    ];
    expect(reviewableSignups(signups, "orgA", new Set(["s2"])).map((signup) => signup.id)).toEqual(["s1"]);
  });

  it("uses the public name unless the author posts anonymously", () => {
    expect(reviewerName("Jordan R.", false)).toBe("Jordan R.");
    expect(reviewerName("Jordan R.", true)).toBe(ANONYMOUS_REVIEWER_NAME);
  });
});

describe("review schemas", () => {
  it("accepts a valid review and rejects bad ratings, repeated tags, long text, extra keys", () => {
    expect(reviewFieldsSchema.safeParse({ rating: 5, tags: ["welcoming"], text: "Great morning." }).success).toBe(true);
    expect(reviewFieldsSchema.safeParse({ rating: 0, tags: [], text: "" }).success).toBe(false);
    expect(reviewFieldsSchema.safeParse({ rating: 4.5, tags: [], text: "" }).success).toBe(false);
    expect(reviewFieldsSchema.safeParse({ rating: 4, tags: ["welcoming", "welcoming"], text: "" }).success).toBe(false);
    expect(reviewFieldsSchema.safeParse({ rating: 4, tags: ["friendly"], text: "" }).success).toBe(false);
    expect(reviewFieldsSchema.safeParse({ rating: 4, tags: [], text: "x".repeat(REVIEW_TEXT_MAX + 1) }).success).toBe(false);
    expect(reviewFieldsSchema.safeParse({ rating: 4, tags: [], text: "", uid: "x" }).success).toBe(false);
  });

  it("parses a stored review with or without a response", () => {
    const stored = { orgId: "orgA", uid: "u1", displayName: "Jordan R.", rating: 4, tags: [], text: "", response: null, createdAt: ts, updatedAt: ts };
    expect(reviewDocSchema.safeParse(stored).success).toBe(true);
    expect(reviewDocSchema.safeParse({ ...stored, response: { text: "Thank you!", by: "owner", at: ts } }).success).toBe(true);
    expect(reviewDocSchema.safeParse({ ...stored, response: { text: "", by: "owner", at: ts } }).success).toBe(false);
  });
});

describe("collection schemas", () => {
  const fields = { title: "Weekend food drives", description: "Hands-on shifts.", items: [{ kind: "opportunity" as const, refId: "opp1" }], published: true };

  it("accepts valid fields and trims the title", () => {
    expect(collectionFieldsSchema.parse({ ...fields, title: "  Food drives  " }).title).toBe("Food drives");
  });

  it("rejects short titles, long descriptions, duplicate or too many items, bad ids, extra keys", () => {
    expect(collectionFieldsSchema.safeParse({ ...fields, title: "abc" }).success).toBe(false);
    expect(collectionFieldsSchema.safeParse({ ...fields, description: "x".repeat(501) }).success).toBe(false);
    expect(collectionFieldsSchema.safeParse({ ...fields, items: [fields.items[0], fields.items[0]] }).success).toBe(false);
    const tooMany = Array.from({ length: COLLECTION_ITEMS_MAX + 1 }, (_, index) => ({ kind: "org" as const, refId: `org${index}` }));
    expect(collectionFieldsSchema.safeParse({ ...fields, items: tooMany }).success).toBe(false);
    expect(collectionFieldsSchema.safeParse({ ...fields, items: [{ kind: "org", refId: "a/b" }] }).success).toBe(false);
    expect(collectionFieldsSchema.safeParse({ ...fields, orgId: "orgA" }).success).toBe(false);
  });

  it("parses a stored admin-authored collection", () => {
    expect(curatedCollectionDocSchema.safeParse({ ...fields, orgId: null, authorUid: "admin1", updatedAt: ts }).success).toBe(true);
  });
});

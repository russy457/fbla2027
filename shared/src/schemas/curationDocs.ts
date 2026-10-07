/**
 * curationDocs.ts
 * Tier 2 lane B client-written documents (SPEC 2.4: the rules let clients
 * write these two collections directly; firestore.rules repeats every check):
 *
 *   collections/{collectionId}  curated collections (SPEC 3.19). Authored only
 *                               by org coordinators (orgId set) or admins
 *                               (orgId null), never by volunteers (gate UC1).
 *   reviews/{signupId}          org experience reviews (SPEC 3.20). The doc id
 *                               is the completed signup, so one review per
 *                               signup and only from someone who attended.
 *
 * `*FieldsSchema` is what a form edits; the full `*DocSchema` adds the fields
 * the client stamps (author, server time) and is used to parse reads, so a
 * malformed document never reaches a screen.
 */
import { z } from "zod";
import { docIdSchema, timestampSchema } from "./common";

// ---------- curated collections (SPEC 3.19) ----------

export const COLLECTION_TITLE_MIN = 4;
export const COLLECTION_TITLE_MAX = 80;
export const COLLECTION_DESCRIPTION_MAX = 500;
export const COLLECTION_ITEMS_MAX = 30;

export const COLLECTION_ITEM_KINDS = ["org", "opportunity"] as const;
export type CollectionItemKind = (typeof COLLECTION_ITEM_KINDS)[number];

export const collectionItemSchema = z.object({ kind: z.enum(COLLECTION_ITEM_KINDS), refId: docIdSchema }).strict();
export type CollectionItem = z.infer<typeof collectionItemSchema>;

const itemKey = (item: CollectionItem): string => `${item.kind}_${item.refId}`;

/** The editable part of a collection. Items are unique; order is the curator's. */
export const collectionFieldsSchema = z
  .object({
    title: z.string().trim().min(COLLECTION_TITLE_MIN).max(COLLECTION_TITLE_MAX),
    description: z.string().trim().max(COLLECTION_DESCRIPTION_MAX),
    items: z
      .array(collectionItemSchema)
      .max(COLLECTION_ITEMS_MAX)
      .refine((items) => new Set(items.map(itemKey)).size === items.length, { message: "must not list an item twice" }),
    published: z.boolean()
  })
  .strict();
export type CollectionFields = z.infer<typeof collectionFieldsSchema>;

/** collections/{collectionId} as stored. updatedAt is request.time (rules). */
export const curatedCollectionDocSchema = z.object({
  title: z.string().min(COLLECTION_TITLE_MIN).max(COLLECTION_TITLE_MAX),
  description: z.string().max(COLLECTION_DESCRIPTION_MAX),
  items: z.array(collectionItemSchema).max(COLLECTION_ITEMS_MAX),
  /** null = admin-authored. */
  orgId: z.string().nullable(),
  authorUid: z.string(),
  published: z.boolean(),
  updatedAt: timestampSchema
});
export type CuratedCollectionDoc = z.infer<typeof curatedCollectionDocSchema>;

// ---------- org experience reviews (SPEC 3.20) ----------

export const REVIEW_TAGS = ["well-organized", "welcoming", "meaningful-impact", "good-communication", "accessible"] as const;
export const reviewTagSchema = z.enum(REVIEW_TAGS);
export type ReviewTag = z.infer<typeof reviewTagSchema>;

export const REVIEW_TAG_LABELS: Readonly<Record<ReviewTag, string>> = {
  "well-organized": "Well organized",
  welcoming: "Welcoming",
  "meaningful-impact": "Meaningful impact",
  "good-communication": "Good communication",
  accessible: "Accessible"
};

export const REVIEW_TEXT_MAX = 1000;
export const REVIEW_RESPONSE_MAX = 1000;
export const REVIEW_RATING_MIN = 1;
export const REVIEW_RATING_MAX = 5;
/**
 * Shown instead of the reviewer's name when they post without it. Every
 * other review shows the public displayName (first name + last initial,
 * SPEC 4.2), never a full name, for minors and adults alike.
 */
export const ANONYMOUS_REVIEWER_NAME = "A volunteer";
/** Seconds an author must wait between edits of one review (rules enforce it). */
export const REVIEW_EDIT_COOLDOWN_SEC = 30;

/** What the review form edits. Tags are a set (no repeats). */
export const reviewFieldsSchema = z
  .object({
    rating: z.number().int().min(REVIEW_RATING_MIN).max(REVIEW_RATING_MAX),
    tags: z
      .array(reviewTagSchema)
      .max(REVIEW_TAGS.length)
      .refine((tags) => new Set(tags).size === tags.length, { message: "must not repeat a tag" }),
    text: z.string().trim().max(REVIEW_TEXT_MAX)
  })
  .strict();
export type ReviewFields = z.infer<typeof reviewFieldsSchema>;

export const reviewResponseSchema = z.object({
  text: z.string().min(1).max(REVIEW_RESPONSE_MAX),
  by: z.string(),
  at: timestampSchema
});
export type ReviewResponse = z.infer<typeof reviewResponseSchema>;

/** reviews/{signupId} as stored. createdAt and updatedAt are request.time (rules). */
export const reviewDocSchema = z.object({
  orgId: z.string(),
  uid: z.string(),
  displayName: z.string().min(1).max(60),
  rating: z.number().int().min(REVIEW_RATING_MIN).max(REVIEW_RATING_MAX),
  tags: z.array(reviewTagSchema).max(REVIEW_TAGS.length),
  text: z.string().max(REVIEW_TEXT_MAX),
  response: reviewResponseSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
});
export type ReviewDoc = z.infer<typeof reviewDocSchema>;

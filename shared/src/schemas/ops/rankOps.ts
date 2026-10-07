/**
 * rankOps.ts
 * Schemas for volunteer ranking and invites (Tier 2, SPEC 5.2, 8.4):
 *   coordinator.rankVolunteers     instanceId, or orgId + a draft shift
 *   coordinator.inviteVolunteers   instanceId + refs from a ranking
 * A candidate carries a display name (first name + last initial), a score, the
 * "why" chips, and an opaque `ref`: the uid sealed with a server key and a
 * 1 hour expiry. Coordinators never receive a uid, contact, or location.
 */
import { z } from "zod";
import { causeAreaSchema, docIdSchema } from "../common";

const isoInstant = z.iso.datetime({ offset: true });

/** A sealed ref: base64url, bounded so a junk string is refused before any crypto. */
export const rankRefSchema = z.string().min(16).max(400).regex(/^[A-Za-z0-9_-]+$/, { message: "must be a ref from rankVolunteers" });

export const rankDraftSchema = z
  .object({
    causeArea: causeAreaSchema,
    skills: z.array(z.string().trim().min(1).max(40)).max(10),
    start: isoInstant,
    end: isoInstant,
    minAge: z.number().int().min(13).max(21).optional()
  })
  .strict();
export type RankDraft = z.infer<typeof rankDraftSchema>;

export const rankVolunteersInput = z.union([
  z.object({ instanceId: docIdSchema }).strict(),
  z.object({ orgId: docIdSchema, draft: rankDraftSchema }).strict()
]);
export type RankVolunteersInput = z.infer<typeof rankVolunteersInput>;

export const rankReasonSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("interest"), causeArea: causeAreaSchema }),
  z.object({ kind: z.literal("skills"), skills: z.array(z.string()) }),
  z.object({
    kind: z.literal("availability"),
    weekday: z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
    block: z.enum(["morning", "afternoon", "evening"])
  }),
  z.object({ kind: z.literal("nearby") }),
  z.object({ kind: z.literal("virtual") }),
  z.object({ kind: z.literal("past-volunteer") })
]);

export const rankedCandidateSchema = z.object({
  ref: z.string(),
  displayName: z.string(),
  score: z.number().min(0).max(1),
  why: z.array(rankReasonSchema)
});
export type RankedCandidateView = z.infer<typeof rankedCandidateSchema>;

export const rankVolunteersOutput = z.object({ candidates: z.array(rankedCandidateSchema).max(20), refExpiresAt: z.string() });

export const inviteVolunteersInput = z.object({ instanceId: docIdSchema, refs: z.array(rankRefSchema).min(1).max(20) }).strict();
export const inviteVolunteersOutput = z.object({
  /** New invite notifications written by this call. */
  sent: z.number().int(),
  /** Already invited, already signed up, or no longer eligible. */
  skipped: z.number().int()
});

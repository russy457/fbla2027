/**
 * inboxOps.ts
 * Input and output schemas for Tier 1 lane A volunteer ops:
 * markNotificationsRead (SPEC 5.2). The only client-facing write to
 * notifications; the items themselves are written by Functions.
 */
import { z } from "zod";
import { docIdSchema } from "../common";

/** At most this many ids per call (SPEC 5.2: itemIds <= 100). */
export const MARK_READ_MAX_IDS = 100;

/** Either specific items or every unread item, never both and never neither. */
export const markNotificationsReadInput = z
  .object({
    itemIds: z.array(docIdSchema).min(1).max(MARK_READ_MAX_IDS).optional(),
    all: z.literal(true).optional()
  })
  .strict()
  .refine((input) => (input.itemIds === undefined) !== (input.all === undefined), {
    message: "send itemIds or all: true",
    path: ["itemIds"]
  });
export const markNotificationsReadOutput = z.object({ updated: z.number().int().min(0) });

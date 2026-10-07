/**
 * demoOps.ts
 * Schemas for admin.resetDemoData (SPEC 5.2, SPEC#demo-accounts 10.7, E1):
 * wipe the demo data and run the same seed module server-side, so the
 * deployed competition site can be put back to a known state in one click.
 * Admin claim AND DEMO_MODE are both required (the handler refuses otherwise).
 */
import { z } from "zod";

/** Default minutes until the demo shift starts, matching `npm run seed:demo`. */
export const DEFAULT_DEMO_SHIFT_STARTS_IN_MIN = 10;
/** Furthest the demo shift may be placed in the future: 12 hours. */
export const MAX_DEMO_SHIFT_STARTS_IN_MIN = 720;

export const resetDemoDataInput = z
  .object({
    shiftStartsInMin: z.number().int().min(1).max(MAX_DEMO_SHIFT_STARTS_IN_MIN).optional()
  })
  .strict();

export const resetDemoDataOutput = z.object({
  /** Documents written by the seed. */
  documents: z.number().int().min(0),
  /** Top-level collections cleared before seeding. */
  collectionsCleared: z.number().int().min(0),
  /** Sign-in accounts created or refreshed. */
  accounts: z.number().int().min(0),
  /** ISO time the demo shift starts. */
  demoShiftStartsAt: z.string()
});
export type ResetDemoDataOutput = z.infer<typeof resetDemoDataOutput>;

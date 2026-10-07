/**
 * shiftOps.ts
 * Input and output schemas for the kiosk and coordinator shift ops in Tier 0
 * (SPEC#fn-issuekioskcode, SPEC#fn-checkin, SPEC#fn-checkout,
 * SPEC#fn-startkiosk, SPEC#fn-finalizeshift, SPEC#fn-revokeletter).
 */
import { z } from "zod";
import { KIOSK_CODE_PATTERN } from "../../kioskCode";
import { docIdSchema, revokeReasonSchema } from "../common";

const instanceOnlyInput = z.object({ instanceId: docIdSchema }).strict();
const kioskCodeSchema = z.string().regex(KIOSK_CODE_PATTERN, { message: "must be the 6-digit code" });

export const issueKioskCodeInput = instanceOnlyInput;
export const issueKioskCodeOutput = z.object({
  code: z.string(),
  windowEndsAt: z.string(),
  secondsRemaining: z.number().int(),
  /** `{APP_BASE_URL}/checkin?i={instanceId}&c={code}` for the Tier 1 QR. */
  qrPayload: z.string()
});

export const checkInInput = z.object({ instanceId: docIdSchema, code: kioskCodeSchema }).strict();
export const checkInOutput = z.object({
  status: z.literal("checked-in"),
  checkInAt: z.string(),
  checkOutOpensAt: z.string()
});

export const checkOutInput = checkInInput;
export const checkOutOutput = z.object({
  status: z.literal("completed"),
  minutes: z.number().int(),
  orgName: z.string(),
  totalApprovedHours: z.number(),
  /** True when the log was written pending for coordinator review (a 0-minute check-out); false when approved. */
  needsReview: z.boolean()
});

export const startKioskInput = instanceOnlyInput;
export const startKioskOutput = z.object({ customToken: z.string(), expiresAt: z.string() });

export const finalizeShiftInput = instanceOnlyInput;
export const finalizeShiftOutput = z.object({
  noShows: z.number().int(),
  excused: z.number().int(),
  autoCompleted: z.number().int(),
  alreadyFinalized: z.boolean()
});

export const revokeLetterInput = z
  .object({ letterId: docIdSchema, reason: revokeReasonSchema, note: z.string().trim().max(500).optional() })
  .strict();
export const revokeLetterOutput = z.object({ letterId: z.string(), alreadyRevoked: z.boolean() });

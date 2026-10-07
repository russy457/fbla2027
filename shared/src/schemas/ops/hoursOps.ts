/**
 * hoursOps.ts
 * Schemas for hours review and attendance (Tier 1, SPEC 5.2 and 5.7):
 *   coordinator.approveHours, rejectHours, setAttendance
 *   volunteer.submitManualHours, requestAttendanceReview
 * Minutes always move in 15-minute steps (SPEC#hours).
 */
import { z } from "zod";
import { docIdSchema, requestNonceSchema, ymdSchema } from "../common";

/** Most logs one bulk approval may touch (SPEC: 1-50, all from one org). */
export const MAX_BULK_APPROVE = 50;
/** Largest manual entry and largest setAttendance credit, in minutes (12 hours). */
export const MAX_LOG_MINUTES = 720;

const stepMinutes = (min: number) =>
  z
    .number()
    .int()
    .min(min)
    .max(MAX_LOG_MINUTES)
    .refine((value) => value % 15 === 0, { message: "must be in 15-minute steps" });

const noteSchema = z.string().trim().min(3).max(500);

export const approveHoursInput = z
  .object({ logIds: z.array(docIdSchema).min(1).max(MAX_BULK_APPROVE).refine((ids) => new Set(ids).size === ids.length, { message: "must not repeat" }) })
  .strict();
export const approveHoursOutput = z.object({ approved: z.number().int(), skipped: z.number().int() });

export const rejectHoursInput = z.object({ logId: docIdSchema, reason: noteSchema }).strict();
export const rejectHoursOutput = z.object({ logId: z.string(), alreadyRejected: z.boolean() });

export const ATTENDANCE_TARGETS = ["excused", "completed", "no-show", "keep"] as const;
export type AttendanceTarget = (typeof ATTENDANCE_TARGETS)[number];

/** coordinator.setAttendance (SPEC#fn-setattendance). minutes is required for `completed` (MINUTES_REQUIRED). */
export const setAttendanceInput = z
  .object({ signupId: docIdSchema, to: z.enum(ATTENDANCE_TARGETS), minutes: stepMinutes(0).optional(), note: noteSchema })
  .strict();
export const setAttendanceOutput = z.object({
  status: z.string(),
  logId: z.string().nullable(),
  changed: z.boolean()
});

/** volunteer.submitManualHours: off-platform service, reviewed by the org's coordinators. */
export const submitManualHoursInput = z
  .object({
    orgId: docIdSchema,
    date: ymdSchema,
    minutes: stepMinutes(15),
    description: z.string().trim().min(10).max(500),
    requestNonce: requestNonceSchema
  })
  .strict();
export const submitManualHoursOutput = z.object({ logId: z.string(), status: z.literal("pending") });

/** volunteer.requestAttendanceReview: a dispute on a no-show, within 30 days (T3). */
export const requestAttendanceReviewInput = z.object({ signupId: docIdSchema, note: z.string().trim().min(10).max(500) }).strict();
export const requestAttendanceReviewOutput = z.object({ disputeOpen: z.literal(true) });

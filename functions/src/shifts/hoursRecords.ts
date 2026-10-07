/**
 * hoursRecords.ts
 * Builds the hours log for a shift signup (SPEC#dm-hourslogs). Kiosk
 * check-outs are approved immediately; finalize auto-completions (no
 * check-out) are pending with needsReview so a coordinator confirms them.
 */
import type { HoursLogDoc, InstanceDoc, SignupDoc } from "@fbla/shared";
import { ts } from "../lib/firestore";

export interface ShiftHoursParams {
  readonly signupId: string;
  readonly signup: SignupDoc;
  readonly instance: InstanceDoc;
  readonly minutes: number;
  readonly source: "kiosk" | "finalize";
  readonly nowMs: number;
}

export const newShiftHoursLog = (params: ShiftHoursParams): HoursLogDoc => {
  const verifiedAtKiosk = params.source === "kiosk";
  return {
    uid: params.signup.uid,
    orgId: params.instance.orgId,
    instanceId: params.signup.instanceId,
    signupId: params.signupId,
    source: params.source,
    // Logs are dated by the shift start so letter ranges and reports group by shift day.
    date: params.instance.start,
    minutes: params.minutes,
    status: verifiedAtKiosk ? "approved" : "pending",
    needsReview: !verifiedAtKiosk,
    description: null,
    reviewedBy: null,
    reviewedAt: null,
    rejectReason: null,
    createdAt: ts(params.nowMs),
    updatedAt: ts(params.nowMs)
  };
};

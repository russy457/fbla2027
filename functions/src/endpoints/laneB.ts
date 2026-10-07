/**
 * laneB.ts
 * Tier 1 lane B ops, grouped per endpoint so each endpoint table adds them
 * with one spread (SPEC 2.3, G4): organization administration, opportunity
 * and instance management, hours review and attendance, manual hours,
 * disputes, reports, and admin verification. Every op derives its org from
 * the target resource (lib/orgAuth.ts), never from client input.
 */
import type { RegisteredOp } from "../lib/defineCallable";
import { approveHours } from "../ops/approveHours";
import { cancelInstance } from "../ops/cancelInstance";
import { createInstance } from "../ops/createInstance";
import { createInvite } from "../ops/createInvite";
import { generateOrgReport } from "../ops/generateOrgReport";
import { generateVolunteerReport } from "../ops/generateVolunteerReport";
import { redeemInvite } from "../ops/redeemInvite";
import { registerOrganization } from "../ops/registerOrganization";
import { rejectHours } from "../ops/rejectHours";
import { removeMember } from "../ops/removeMember";
import { requestAttendanceReview } from "../ops/requestAttendanceReview";
import { setAttendance } from "../ops/setAttendance";
import { submitManualHours } from "../ops/submitManualHours";
import { updateInstance } from "../ops/updateInstance";
import { updateOrganization } from "../ops/updateOrganization";
import { upsertOpportunity } from "../ops/upsertOpportunity";
import { verifyOrganization } from "../ops/verifyOrganization";

export const laneBVolunteerOps: readonly RegisteredOp[] = [submitManualHours, requestAttendanceReview, generateVolunteerReport];

export const laneBCoordinatorOps: readonly RegisteredOp[] = [
  registerOrganization,
  updateOrganization,
  createInvite,
  redeemInvite,
  removeMember,
  upsertOpportunity,
  createInstance,
  updateInstance,
  cancelInstance,
  approveHours,
  rejectHours,
  setAttendance,
  generateOrgReport
];

export const laneBAdminOps: readonly RegisteredOp[] = [verifyOrganization];

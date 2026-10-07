/**
 * signupRecords.ts
 * Builders for the documents a new signup writes (SPEC#dm-signups,
 * SPEC#dm-signupcontacts) and the audit history entry every status change
 * appends. Kept separate from the op so the seed shape and the op shape are
 * easy to compare and the op file stays about the rules, not the fields.
 */
import {
  NEW_VOLUNTEER_RELIABILITY,
  appendHistory,
  type HistoryEntry,
  type InstanceDoc,
  type PrivateProfileDoc,
  type SignupActor,
  type SignupContactDoc,
  type SignupDoc,
  type SignupStatus,
  type TimestampLike
} from "@fbla/shared";
import { ts } from "../lib/firestore";

/** Returns a new history array with one more audit entry (capped at 20). */
export const withHistory = (
  history: readonly HistoryEntry<TimestampLike>[],
  from: SignupStatus | null,
  to: SignupStatus,
  actor: string,
  op: SignupActor,
  nowMs: number
): HistoryEntry<TimestampLike>[] => appendHistory(history, { from, to, actor, op, at: ts(nowMs) });

export interface NewSignupParams {
  readonly instanceId: string;
  readonly instance: InstanceDoc;
  readonly uid: string;
  readonly displayName: string;
  readonly status: Extract<SignupStatus, "confirmed" | "waitlisted">;
  readonly walkUp: boolean;
  readonly waitlistSeq: number | null;
  readonly nowMs: number;
}

export const newSignupDoc = (params: NewSignupParams): SignupDoc => ({
  instanceId: params.instanceId,
  opportunityId: params.instance.opportunityId,
  orgId: params.instance.orgId,
  uid: params.uid,
  displayName: params.displayName,
  instanceStart: params.instance.start,
  instanceEnd: params.instance.end,
  status: params.status,
  waitlistSeq: params.waitlistSeq,
  walkUp: params.walkUp,
  promotedAt: null,
  lateCancel: false,
  cancelReason: null,
  cancelledAt: null,
  checkInAt: null,
  checkOutAt: null,
  autoCompleted: false,
  excuseReason: null,
  attendance: null,
  disputeOpen: false,
  dispute: null,
  history: withHistory([], null, params.status, params.uid, "signup", params.nowMs),
  createdAt: ts(params.nowMs),
  updatedAt: ts(params.nowMs)
});

/**
 * Contact snapshot for coordinators. A minor at an unverified org gets
 * `hidden: true` and no PII fields at all (T4), so a rules mistake still
 * could not leak them.
 */
export const newContactDoc = (
  instanceId: string,
  instance: InstanceDoc,
  uid: string,
  profile: PrivateProfileDoc,
  isMinor: boolean,
  nowMs: number
): SignupContactDoc => {
  const hidden = isMinor && !instance.orgVerified;
  const base = {
    orgId: instance.orgId,
    instanceId,
    uid,
    hidden,
    isMinor,
    reliability: NEW_VOLUNTEER_RELIABILITY,
    frozen: false,
    refreshedAt: ts(nowMs),
    createdAt: ts(nowMs),
    updatedAt: ts(nowMs)
  };
  return hidden ? base : { ...base, fullName: profile.fullName, email: profile.email, phone: profile.phone };
};

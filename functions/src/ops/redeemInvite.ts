/**
 * redeemInvite.ts
 * coordinator.redeemInvite (SPEC 3.5, 5.2). A signed-in person with a
 * finished profile types the code an owner shared. The code is normalized,
 * hashed, and looked up; a missing, expired, or someone-else's redeemed
 * invite is INVITE_INVALID. Redeeming your own invite again returns ok.
 * One transaction creates the coordinator membership and marks the invite
 * redeemed. A minor coordinator gets canViewContacts false (G14).
 * Rate limited (bucket "redeemInvite", 10 per 10 minutes per user) so codes
 * cannot be brute-forced; every attempt counts, wrong codes included.
 */
import {
  AppError,
  COLLECTIONS,
  DEFAULT_TIME_ZONE,
  INVITE_CODE_PATTERN,
  PATHS,
  ageOn,
  displayNameFor,
  normalizeInviteCode,
  type InviteDoc,
  type MemberDoc
} from "@fbla/shared";
import { profileComplete } from "../lib/auth";
import { defineCallable } from "../lib/defineCallable";
import { msOf, readDoc, runTx, ts } from "../lib/firestore";
import { REDEEM_INVITE_RATE_LIMIT } from "../lib/rateLimit";
import { sha256Hex } from "../lib/requestIds";

const ADULT_AGE = 18;

export const redeemInvite = defineCallable({
  endpoint: "coordinator",
  op: "redeemInvite",
  auth: profileComplete(),
  rateLimit: REDEEM_INVITE_RATE_LIMIT,
  handler: async ({ input, caller, clock, deps, profile }) => {
    if (profile === null) throw new AppError("PROFILE_INCOMPLETE");
    const { db } = deps;
    const code = normalizeInviteCode(input.code);
    if (!INVITE_CODE_PATTERN.test(code)) throw new AppError("INVITE_INVALID");
    const inviteRef = db.collection(COLLECTIONS.invites).doc(sha256Hex(code));
    const nowMs = clock.nowMs();
    const isAdult = ageOn(profile.birthDate, clock.now(), DEFAULT_TIME_ZONE) >= ADULT_AGE;

    return runTx(db, async (tx) => {
      const invite = readDoc<InviteDoc>(await tx.get(inviteRef));
      if (invite === null) throw new AppError("INVITE_INVALID");
      if (invite.redeemedBy === caller.uid) return { orgId: invite.orgId, role: "coordinator" as const };
      if (invite.redeemedBy !== null || msOf(invite.expiresAt) <= nowMs) throw new AppError("INVITE_INVALID");
      const memberRef = db.doc(PATHS.member(invite.orgId, caller.uid));
      if ((await tx.get(memberRef)).exists) throw new AppError("ALREADY_MEMBER");
      const at = ts(nowMs);
      const member: MemberDoc = {
        uid: caller.uid,
        orgId: invite.orgId,
        role: invite.role,
        displayName: displayNameFor(profile.firstName, profile.lastName),
        canViewContacts: isAdult,
        invitedBy: invite.createdBy,
        joinedAt: at,
        createdAt: at,
        updatedAt: at
      };
      tx.create(memberRef, member);
      tx.update(inviteRef, { redeemedBy: caller.uid, redeemedAt: at, updatedAt: at });
      return { orgId: invite.orgId, role: "coordinator" as const };
    });
  }
});

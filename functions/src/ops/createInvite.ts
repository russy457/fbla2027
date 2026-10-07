/**
 * createInvite.ts
 * coordinator.createInvite (SPEC 3.5, 5.2), owner only. Each call issues a
 * new 10-character base32 code (50 random bits), valid 7 days. Only the
 * SHA-256 of the code is stored (as the invite id); the code itself is
 * returned once and never logged. Rate limited (bucket "createInvite",
 * 20 per hour per user).
 */
import { randomBytes } from "node:crypto";
import { COLLECTIONS, DAY_MS, INVITE_CODE_LENGTH, INVITE_TTL_DAYS, base32Encode, type InviteDoc } from "@fbla/shared";
import { defineCallable } from "../lib/defineCallable";
import { ts } from "../lib/firestore";
import { orgResource, ownerOf } from "../lib/orgAuth";
import { CREATE_INVITE_RATE_LIMIT } from "../lib/rateLimit";
import { sha256Hex } from "../lib/requestIds";

/** 7 random bytes give 56 bits; the first 10 base32 characters keep 50 of them. */
const CODE_BYTES = 7;

export const newInviteCode = (): string => base32Encode(randomBytes(CODE_BYTES)).slice(0, INVITE_CODE_LENGTH);

export const createInvite = defineCallable({
  endpoint: "coordinator",
  op: "createInvite",
  auth: ownerOf(orgResource((input: { orgId: string }) => input.orgId)),
  rateLimit: CREATE_INVITE_RATE_LIMIT,
  handler: async ({ input, caller, clock, deps }) => {
    const nowMs = clock.nowMs();
    const code = newInviteCode();
    const expiresAtMs = nowMs + INVITE_TTL_DAYS * DAY_MS;
    const invite: InviteDoc = {
      orgId: input.orgId,
      role: "coordinator",
      createdBy: caller.uid,
      expiresAt: ts(expiresAtMs),
      redeemedBy: null,
      redeemedAt: null,
      createdAt: ts(nowMs),
      updatedAt: ts(nowMs)
    };
    await deps.db.collection(COLLECTIONS.invites).doc(sha256Hex(code)).create(invite);
    return { code, expiresAt: new Date(expiresAtMs).toISOString() };
  }
});

/**
 * revokeLetter.ts
 * coordinator.revokeLetter (SPEC#fn-revokeletter, SPEC 5.6). An admin, or
 * the owner of any organization the letter counts, can revoke it with a
 * reason. The letter, its letterRefs, and the public projection all become
 * "revoked"; /verify shows only the reason's label, never the private note.
 * The volunteer notification is Tier 1 (notifications).
 */
import {
  AppError,
  COLLECTIONS,
  PATHS,
  REVOKE_REASON_LABELS,
  type LetterDoc
} from "@fbla/shared";
import { letterRevoker } from "../lib/auth";
import { defineCallable } from "../lib/defineCallable";
import { readDoc, runTx, ts } from "../lib/firestore";

export const revokeLetter = defineCallable({
  endpoint: "coordinator",
  op: "revokeLetter",
  auth: letterRevoker((input: { letterId: string }) => input.letterId),
  handler: async ({ input, caller, clock, deps }) => {
    const { db } = deps;
    const at = ts(clock.nowMs());
    const letterRef = db.collection(COLLECTIONS.letters).doc(input.letterId);

    return runTx(db, async (tx) => {
      const letter = readDoc<LetterDoc>(await tx.get(letterRef));
      if (letter === null) throw new AppError("NOT_FOUND");
      if (letter.status === "revoked") return { letterId: input.letterId, alreadyRevoked: true };

      tx.update(letterRef, {
        status: "revoked",
        revokedAt: at,
        revokedBy: caller.uid,
        revokeReason: input.reason,
        revokeNote: input.note && input.note.length > 0 ? input.note : null,
        updatedAt: at
      });
      tx.update(db.collection(COLLECTIONS.letterVerifications).doc(letter.verifyCode), {
        status: "revoked",
        revokeReasonLabel: REVOKE_REASON_LABELS[input.reason]
      });
      letter.orgIds.forEach((orgId) => tx.update(db.doc(PATHS.letterRef(orgId, input.letterId)), { status: "revoked", updatedAt: at }));
      return { letterId: input.letterId, alreadyRevoked: false };
    });
  }
});

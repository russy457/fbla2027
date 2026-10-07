/**
 * issueLetter.ts
 * volunteer.issueLetter (SPEC#fn-issueletter, SPEC 5.6, G19).
 *   1. validate the scope (from <= to, at most 4 years, `to` not in the future),
 *   2. letterId = hash(uid, scopeKey, requestNonce): a retry returns the same
 *      letter, re-rendering only a failed PDF,
 *   3. snapshot the evidence (verified orgs only; NO_APPROVED_HOURS when empty),
 *   4. one transaction: the letter with its frozen evidence, the public
 *      letterVerifications projection, letterRefs for each counted org, and
 *      any older valid same-scope letter marked superseded,
 *   5. render the PDF to Storage.
 * Later changes to a counted log never edit this snapshot (Tier 1
 * supersedeLetters only changes status).
 */
import type { Firestore, Transaction } from "firebase-admin/firestore";
import {
  AppError,
  COLLECTIONS,
  DEFAULT_TIME_ZONE,
  PATHS,
  displayNameFor,
  localDateIn,
  scopeKeyFor,
  type EvidenceSummary,
  type LetterDoc,
  type LetterRefDoc,
  type LetterScope,
  type LetterVerificationDoc
} from "@fbla/shared";
import type { Timestamp } from "firebase-admin/firestore";
import { profileComplete } from "../lib/auth";
import { defineCallable } from "../lib/defineCallable";
import { readDoc, runTx, ts } from "../lib/firestore";
import { loadEvidence } from "../letters/evidence";
import { letterIdFor, newVerifyCode } from "../letters/letterIds";
import { LETTER_RENDERER_VERSION } from "../letters/renderLetterPdf";
import { storeLetterPdf } from "../letters/storeLetterPdf";

const MAX_RANGE_YEARS = 4;

/** SPEC 5.6 step 1. Dates are YYYY-MM-DD strings, so string comparison is date order. */
const assertValidScope = (scope: LetterScope, today: string): void => {
  const earliestFrom = `${Number(scope.to.slice(0, 4)) - MAX_RANGE_YEARS}${scope.to.slice(4)}`;
  if (scope.from > scope.to || scope.to > today || scope.from < earliestFrom) {
    throw new AppError("INVALID_INPUT", { fields: "scope" });
  }
};

/** Marks one older letter (and its projection and refs) superseded by the new one. */
const supersede = (tx: Transaction, db: Firestore, old: { id: string; data: LetterDoc }, newLetterId: string, issuedAt: Timestamp): void => {
  tx.update(db.collection(COLLECTIONS.letters).doc(old.id), {
    status: "superseded",
    supersededAt: issuedAt,
    supersededBy: newLetterId,
    supersededReason: "reissued",
    updatedAt: issuedAt
  });
  tx.update(db.collection(COLLECTIONS.letterVerifications).doc(old.data.verifyCode), { status: "superseded", supersededByIssuedAt: issuedAt });
  old.data.orgIds.forEach((orgId) => tx.update(db.doc(PATHS.letterRef(orgId, old.id)), { status: "superseded", updatedAt: issuedAt }));
};

interface NewLetterParams {
  readonly uid: string;
  readonly displayName: string;
  readonly scope: LetterScope;
  readonly evidence: EvidenceSummary;
  readonly verifyCode: string;
  readonly letterId: string;
  readonly issuedAt: Timestamp;
}

const newLetterDoc = (params: NewLetterParams): LetterDoc => ({
  uid: params.uid,
  displayName: params.displayName,
  scope: params.scope,
  scopeKey: scopeKeyFor(params.scope),
  orgIds: params.evidence.orgIds,
  verifyCode: params.verifyCode,
  status: "valid",
  evidence: {
    logIds: params.evidence.logIds,
    perOrg: params.evidence.perOrg,
    totalMinutes: params.evidence.totalMinutes,
    excludedUnverifiedMinutes: params.evidence.excludedUnverifiedMinutes,
    excludedUnverifiedCount: params.evidence.excludedUnverifiedCount,
    from: params.scope.from,
    to: params.scope.to
  },
  rendererVersion: LETTER_RENDERER_VERSION,
  pdfPath: PATHS.letterPdf(params.uid, params.letterId),
  pdfStatus: "generating",
  issuedAt: params.issuedAt,
  supersededAt: null,
  supersededBy: null,
  supersededReason: null,
  revokedAt: null,
  revokedBy: null,
  revokeReason: null,
  revokeNote: null,
  createdAt: params.issuedAt,
  updatedAt: params.issuedAt
});

const newVerification = (letter: LetterDoc): LetterVerificationDoc => ({
  displayName: letter.displayName,
  orgNames: letter.evidence.perOrg.filter((row) => row.verified).map((row) => row.orgName),
  totalMinutes: letter.evidence.totalMinutes,
  from: letter.evidence.from,
  to: letter.evidence.to,
  issuedAt: letter.issuedAt,
  status: "valid",
  supersededByIssuedAt: null,
  revokeReasonLabel: null
});

const outputOf = (letterId: string, letter: LetterDoc, pdfStatus = letter.pdfStatus) => ({
  letterId,
  verifyCode: letter.verifyCode,
  pdfStatus,
  totalMinutes: letter.evidence.totalMinutes,
  excludedUnverifiedMinutes: letter.evidence.excludedUnverifiedMinutes
});

export const issueLetter = defineCallable({
  endpoint: "volunteer",
  op: "issueLetter",
  auth: profileComplete(),
  handler: async ({ input, caller, clock, deps, profile }) => {
    if (profile === null) throw new AppError("PROFILE_INCOMPLETE");
    const { db, env } = deps;
    const nowMs = clock.nowMs();
    const scope: LetterScope = input.scope;
    assertValidScope(scope, localDateIn(clock.now(), DEFAULT_TIME_ZONE));

    const letterId = letterIdFor(caller.uid, scopeKeyFor(scope), input.requestNonce);
    const letterRef = db.collection(COLLECTIONS.letters).doc(letterId);
    const pdfParams = { db, storage: deps.storage, bucket: env.storageBucket, log: deps.log, appBaseUrl: env.appBaseUrl, letterId, fullName: profile.fullName, nowMs };

    const existing = readDoc<LetterDoc>(await letterRef.get());
    if (existing !== null) {
      const pdfStatus = existing.pdfStatus === "failed" ? await storeLetterPdf({ ...pdfParams, letter: existing }) : existing.pdfStatus;
      return outputOf(letterId, existing, pdfStatus);
    }

    const evidence = await loadEvidence(db, caller.uid, scope);
    if (evidence.totalMinutes === 0) throw new AppError("NO_APPROVED_HOURS");

    const issuedAt = ts(nowMs);
    const letter = newLetterDoc({
      uid: caller.uid,
      displayName: displayNameFor(profile.firstName, profile.lastName),
      scope,
      evidence,
      verifyCode: newVerifyCode(),
      letterId,
      issuedAt
    });

    const created = await runTx(db, async (tx) => {
      const raced = readDoc<LetterDoc>(await tx.get(letterRef));
      if (raced !== null) return raced; // a concurrent retry with the same nonce won
      const sameScope = await tx.get(
        db.collection(COLLECTIONS.letters).where("uid", "==", caller.uid).where("scopeKey", "==", letter.scopeKey).where("status", "==", "valid")
      );
      tx.create(letterRef, letter);
      tx.create(db.collection(COLLECTIONS.letterVerifications).doc(letter.verifyCode), newVerification(letter));
      evidence.perOrg
        .filter((row) => row.verified)
        .forEach((row) => {
          const ref: LetterRefDoc = { letterId, uid: caller.uid, displayName: letter.displayName, minutesForOrg: row.minutes, status: "valid", issuedAt, createdAt: issuedAt, updatedAt: issuedAt };
          tx.set(db.doc(PATHS.letterRef(row.orgId, letterId)), ref);
        });
      sameScope.docs.forEach((doc) => supersede(tx, db, { id: doc.id, data: doc.data() as LetterDoc }, letterId, issuedAt));
      return letter;
    });

    const pdfStatus = created.pdfStatus === "ready" ? "ready" : await storeLetterPdf({ ...pdfParams, letter: created });
    return outputOf(letterId, created, pdfStatus);
  }
});

/**
 * supersedeLetters.ts
 * Letter supersede trigger (SPEC#fn-supersede, G19). When a counted hours
 * log changes (its status or minutes, for example setAttendance turning an
 * approved log into a rejected one), every still-valid letter whose frozen
 * evidence lists that log becomes "superseded" with reason hours-changed:
 * on the letter, its letterRefs, and the public projection, so /verify shows
 * "The hours on this letter changed after it was issued." The volunteer gets
 * a "letter-superseded" notification in the same transaction (keyed by
 * letterId). The evidence snapshot itself is never edited.
 *
 * Bounded: one query (Q20, letters where evidence.logIds array-contains
 * logId and status == valid), one small transaction per letter, and it never
 * writes hoursLogs, so it cannot retrigger itself.
 */
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { COLLECTIONS, PATHS, letterSupersededNotification, type HoursLogDoc, type LetterDoc } from "@fbla/shared";
import { defaultDeps, type ServerDeps } from "../lib/deps";
import { readDoc, runTx, ts } from "../lib/firestore";
import { requestClock } from "../lib/requestClock";
import { queueNotification } from "../notifications/notify";

type LogFacts = Pick<HoursLogDoc, "status" | "minutes"> | null;

/** SPEC: fires only where status or minutes changed (a create or delete is a change too). */
export const countedLogChanged = (before: LogFacts, after: LogFacts): boolean =>
  before === null || after === null || before.status !== after.status || before.minutes !== after.minutes;

/** Marks one letter superseded if it is still valid; returns true when it changed. */
const supersedeOne = (deps: ServerDeps, letterId: string, nowMs: number): Promise<boolean> =>
  runTx(deps.db, async (tx) => {
    const ref = deps.db.collection(COLLECTIONS.letters).doc(letterId);
    const letter = readDoc<LetterDoc>(await tx.get(ref));
    if (letter === null || letter.status !== "valid") return false;
    const at = ts(nowMs);
    tx.update(ref, { status: "superseded", supersededAt: at, supersededBy: null, supersededReason: "hours-changed", updatedAt: at });
    // supersededByIssuedAt stays null: no newer letter exists, so /verify explains the hours changed.
    tx.update(deps.db.collection(COLLECTIONS.letterVerifications).doc(letter.verifyCode), { status: "superseded", supersededByIssuedAt: null });
    letter.orgIds.forEach((orgId) => tx.update(deps.db.doc(PATHS.letterRef(orgId, letterId)), { status: "superseded", updatedAt: at }));
    queueNotification(tx, deps.db, letter.uid, letterSupersededNotification(letterId), letterId, nowMs);
    return true;
  });

/** Supersedes every valid letter that counted `logId`. Exported for the emulator tests. */
export const supersedeLettersForLog = async (deps: ServerDeps, logId: string, before: LogFacts, after: LogFacts, nowMs: number): Promise<number> => {
  if (!countedLogChanged(before, after)) return 0;
  const letters = await deps.db
    .collection(COLLECTIONS.letters)
    .where("evidence.logIds", "array-contains", logId)
    .where("status", "==", "valid")
    .get();
  const results = await Promise.all(letters.docs.map((doc) => supersedeOne(deps, doc.id, nowMs)));
  return results.filter(Boolean).length;
};

/** Deployed as supersedeLetters (SPEC 2.3). */
export const supersedeLetters = onDocumentWritten(`${COLLECTIONS.hoursLogs}/{logId}`, async (event) => {
  const before = event.data?.before.exists ? (event.data.before.data() as HoursLogDoc) : null;
  const after = event.data?.after.exists ? (event.data.after.data() as HoursLogDoc) : null;
  const deps = defaultDeps();
  const clock = await requestClock(deps);
  await supersedeLettersForLog(deps, event.params.logId, before, after, clock.nowMs());
});

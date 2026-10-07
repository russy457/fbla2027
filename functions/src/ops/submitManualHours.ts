/**
 * submitManualHours.ts
 * volunteer.submitManualHours (SPEC 5.2, Appendix B item 14). A volunteer
 * records off-platform service for an organization; the log is pending until
 * a coordinator of that org approves it in Needs attention. The date must be
 * in the last 12 months and not in the future (DATE_OUT_OF_RANGE), judged in
 * the org's time zone. logId = manual_{sha256(uid|requestNonce)}, so a retry
 * returns the same log.
 */
import {
  AppError,
  COLLECTIONS,
  DEFAULT_TIME_ZONE,
  displayNameFor,
  localDateIn,
  startOfLocalDay,
  type HoursLogDoc,
  type OrganizationDoc
} from "@fbla/shared";
import { profileComplete } from "../lib/auth";
import { defineCallable } from "../lib/defineCallable";
import { readDoc, runTx, ts } from "../lib/firestore";
import { sha256Hex } from "../lib/requestIds";

/** The earliest allowed date: the same calendar day one year back. */
const oneYearBefore = (ymd: string): string => `${Number(ymd.slice(0, 4)) - 1}${ymd.slice(4)}`;

export const submitManualHours = defineCallable({
  endpoint: "volunteer",
  op: "submitManualHours",
  auth: profileComplete(),
  handler: async ({ input, caller, clock, deps, profile }) => {
    if (profile === null) throw new AppError("PROFILE_INCOMPLETE");
    const { db } = deps;
    const logId = `manual_${sha256Hex(`${caller.uid}|${input.requestNonce}`)}`;
    const ref = db.collection(COLLECTIONS.hoursLogs).doc(logId);
    const existing = readDoc<HoursLogDoc>(await ref.get());
    if (existing !== null) return { logId, status: "pending" as const };

    const org = readDoc<OrganizationDoc>(await db.collection(COLLECTIONS.organizations).doc(input.orgId).get());
    if (org === null || org.archived) throw new AppError("NOT_FOUND");
    const timeZone = org.timeZone || DEFAULT_TIME_ZONE;
    const today = localDateIn(clock.now(), timeZone);
    if (input.date > today || input.date < oneYearBefore(today)) throw new AppError("DATE_OUT_OF_RANGE");

    const at = ts(clock.nowMs());
    const log: HoursLogDoc = {
      uid: caller.uid,
      orgId: input.orgId,
      instanceId: null,
      signupId: null,
      source: "manual",
      date: ts(startOfLocalDay(input.date, timeZone)),
      minutes: input.minutes,
      status: "pending",
      needsReview: false,
      description: input.description,
      reviewedBy: null,
      reviewedAt: null,
      rejectReason: null,
      displayName: displayNameFor(profile.firstName, profile.lastName),
      createdAt: at,
      updatedAt: at
    };
    await runTx(db, async (tx) => {
      if ((await tx.get(ref)).exists) return;
      tx.create(ref, log);
    });
    return { logId, status: "pending" as const };
  }
});

/**
 * inviteVolunteers.ts
 * coordinator.inviteVolunteers (Tier 2, SPEC 5.2, 8.3 shift-invite),
 * coordinator of the shift's org, rate limited (20 calls per hour). Opens
 * each ref from rankVolunteers (expired or edited: REF_EXPIRED; another
 * org's: PERMISSION_DENIED) and writes one in-app alert per person:
 * notifications/{uid}/items/shift-invite_{instanceId}_{uid}.
 *
 * Re-checked at send time, because a ref can be up to an hour old: the
 * person still has a complete profile, is still past or discoverable, is old
 * enough on the shift date, is not a minor at an unverified org, and has no
 * signup on the shift. People already invited keep their existing alert (no
 * second ping, and a read alert stays read). Alerts are in-app only.
 */
import {
  AppError,
  COLLECTIONS,
  PATHS,
  isRankEligible,
  notificationIdFor,
  shiftInviteKey,
  shiftInviteNotification,
  signupIdFor,
  type PrivateProfileDoc
} from "@fbla/shared";
import { coordinatorOf, instanceResource } from "../lib/auth";
import { defineCallable } from "../lib/defineCallable";
import { msOf, readDoc } from "../lib/firestore";
import { notificationDoc } from "../notifications/notify";
import { hasVolunteeredWith, toRankCandidate } from "../ranking/candidates";
import { openRankRef } from "../ranking/rankRefs";
import { INVITE_RATE_LIMIT, instanceRankTarget } from "../ranking/rankTarget";

export const inviteVolunteers = defineCallable({
  endpoint: "coordinator",
  op: "inviteVolunteers",
  auth: coordinatorOf(instanceResource((input: { instanceId: string }) => input.instanceId)),
  rateLimit: INVITE_RATE_LIMIT,
  handler: async ({ input, clock, deps, resource }) => {
    const { db, env } = deps;
    const nowMs = clock.nowMs();
    const instance = resource.data;
    if (instance.status === "cancelled") throw new AppError("SHIFT_CANCELLED");
    if (instance.status === "finalized" || msOf(instance.start) <= nowMs) throw new AppError("SHIFT_STARTED");

    // Any bad ref fails the whole call before anything is sent.
    const uids = [...new Set(input.refs.map((ref) => openRankRef(env.kioskMasterSecret, ref, instance.orgId, nowMs)))];
    const target = await instanceRankTarget(db, resource);
    const content = shiftInviteNotification({
      instanceId: resource.id,
      title: instance.title,
      orgName: instance.orgName,
      startMs: msOf(instance.start),
      timeZone: instance.timeZone
    });

    const [profiles, alerts, signups] = await Promise.all([
      db.getAll(...uids.map((uid) => db.doc(PATHS.privateProfile(uid)))),
      db.getAll(...uids.map((uid) => db.doc(PATHS.notificationItem(uid, notificationIdFor("shift-invite", shiftInviteKey(resource.id, uid)))))),
      db.getAll(...uids.map((uid) => db.collection(COLLECTIONS.signups).doc(signupIdFor(resource.id, uid))))
    ]);

    const batch = db.batch();
    let sent = 0;
    for (const [index, uid] of uids.entries()) {
      const snapshot = profiles[index];
      const profile = snapshot === undefined ? null : readDoc<PrivateProfileDoc>(snapshot);
      const alreadyAsked = alerts[index]?.exists === true || signups[index]?.exists === true;
      if (profile === null || !profile.profileComplete || alreadyAsked) continue;
      const discoverable = profile.notificationPrefs?.discoverable === true;
      const pastVolunteer = !discoverable && (await hasVolunteeredWith(db, instance.orgId, uid));
      if (!isRankEligible(toRankCandidate(uid, profile, pastVolunteer), target)) continue;
      batch.set(db.doc(PATHS.notificationItem(uid, notificationIdFor("shift-invite", shiftInviteKey(resource.id, uid)))), notificationDoc(content, nowMs));
      sent += 1;
    }
    if (sent > 0) await batch.commit();
    return { sent, skipped: uids.length - sent };
  }
});

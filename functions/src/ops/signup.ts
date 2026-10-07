/**
 * signup.ts
 * volunteer.signup (SPEC#fn-signup, SPEC 5.3). One transaction over the
 * instance, the signup, and the org, so N people racing for the last seat
 * end with exactly `capacity` confirmed: Firestore retries the losers, who
 * then see the seat taken and get SHIFT_FULL.
 *
 * Tier 0 confirms only when a seat is free. The waitlist (SPEC step 5) is
 * Tier 1; the instance already carries waitlist/waitlistSeq so adding it
 * needs no data change. The doc id `{instanceId}_{uid}` makes retries return
 * the existing signup instead of creating a second one.
 */
import {
  ACTIVE_SIGNUP_STATUSES,
  AppError,
  COLLECTIONS,
  ageOn,
  assertTransition,
  displayNameFor,
  signupIdFor,
  type InstanceDoc,
  type OrganizationDoc,
  type SignupDoc
} from "@fbla/shared";
import { profileComplete } from "../lib/auth";
import { defineCallable } from "../lib/defineCallable";
import { msOf, readDoc, runTx, ts } from "../lib/firestore";
import { newContactDoc, newSignupDoc } from "../shifts/signupRecords";

const ADULT_AGE = 18;

const isActive = (signup: SignupDoc): boolean => (ACTIVE_SIGNUP_STATUSES as readonly string[]).includes(signup.status);

/** 1-based place in line: one more than the number of entries with a smaller seq (SPEC 5.3). */
const waitlistPlace = (instance: InstanceDoc, seq: number | null) =>
  seq === null
    ? { waitlistPosition: null, waitlistSize: null }
    : { waitlistPosition: 1 + instance.waitlist.filter((entry) => entry.seq < seq).length, waitlistSize: instance.waitlist.length };

export const signup = defineCallable({
  endpoint: "volunteer",
  op: "signup",
  auth: profileComplete(),
  handler: async ({ input, caller, clock, deps, profile }) => {
    if (profile === null) throw new AppError("PROFILE_INCOMPLETE");
    const { db } = deps;
    const signupId = signupIdFor(input.instanceId, caller.uid);
    const instanceRef = db.collection(COLLECTIONS.instances).doc(input.instanceId);
    const signupRef = db.collection(COLLECTIONS.signups).doc(signupId);
    const contactRef = db.collection(COLLECTIONS.signupContacts).doc(signupId);
    const nowMs = clock.nowMs();

    return runTx(db, async (tx) => {
      const instance = readDoc<InstanceDoc>(await tx.get(instanceRef));
      if (instance === null) throw new AppError("NOT_FOUND");
      const orgRef = db.collection(COLLECTIONS.organizations).doc(instance.orgId);
      const [existing, org] = [readDoc<SignupDoc>(await tx.get(signupRef)), readDoc<OrganizationDoc>(await tx.get(orgRef))];

      // Step 1: shift state.
      if (instance.status === "cancelled") throw new AppError("SHIFT_CANCELLED");
      if (nowMs >= msOf(instance.start)) throw new AppError("SHIFT_STARTED");

      // Step 2: idempotent retry, or a final cancellation (SPEC Appendix B item 27).
      if (existing !== null) {
        if (!isActive(existing)) throw new AppError("SIGNUP_CANCELLED_BEFORE");
        const status = existing.status as (typeof ACTIVE_SIGNUP_STATUSES)[number];
        return { signupId, status, ...waitlistPlace(instance, existing.waitlistSeq) };
      }

      // Step 3: age at the shift's start date in the org's zone (G11), and minor safety (G14).
      const age = ageOn(profile.birthDate, instance.start.toDate(), instance.timeZone);
      if (age < instance.minAge) throw new AppError("AGE_BELOW_MIN", { minAge: instance.minAge });
      const isMinor = age < ADULT_AGE;
      if (isMinor && !instance.orgVerified) throw new AppError("MINOR_UNVERIFIED_ORG");

      // Step 4 (Tier 0): a free seat confirms; otherwise the shift is full.
      if (instance.signupCount >= instance.capacity) {
        throw new AppError(nowMs >= msOf(instance.cutoffAt) ? "WAITLIST_CLOSED" : "SHIFT_FULL");
      }
      assertTransition(null, "confirmed", "signup");

      const displayName = displayNameFor(profile.firstName, profile.lastName);
      tx.update(instanceRef, { signupCount: instance.signupCount + 1, updatedAt: ts(nowMs) });
      tx.create(
        signupRef,
        newSignupDoc({
          instanceId: input.instanceId,
          instance,
          uid: caller.uid,
          displayName,
          status: "confirmed",
          walkUp: nowMs >= msOf(instance.cutoffAt),
          waitlistSeq: null,
          nowMs
        })
      );
      tx.set(contactRef, newContactDoc(input.instanceId, instance, caller.uid, profile, isMinor, nowMs));
      // Step 7: the org now has volunteer history, so it can be archived but not deleted.
      if (org !== null && !org.hasActivity) tx.update(orgRef, { hasActivity: true, updatedAt: ts(nowMs) });

      return { signupId, status: "confirmed" as const, waitlistPosition: null, waitlistSize: null };
    });
  }
});

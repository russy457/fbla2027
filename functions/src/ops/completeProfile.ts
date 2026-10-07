/**
 * completeProfile.ts
 * volunteer.completeProfile (SPEC#fn-completeprofile, SPEC 5.9, G11, G13, G18).
 * The one op exempt from the profile gate, because it is what completes the
 * profile. Steps:
 *   1. age from birthDate on today's Chicago date; under 13 deletes the Auth
 *      user and every doc under the uid, then fails with AGE_UNDER_13 (no PII
 *      is logged),
 *   2. Turnstile (skipped on the emulator).
 * Steps 1 and 2 are swapped from SPEC 5.9 on purpose: an already signed-in
 * person who enters an under-13 birth date in onboarding is stopped before
 * any Turnstile widget is shown, and their account must still be deleted
 * (G18). Deleting your own account needs no bot check, and the age check
 * reads nothing but the input, so running it first gives nothing away.
 *   3. validated profile fields (zod, in the shared op schema),
 *   4. writes users/{uid}/private/profile and the public users/{uid}
 *      projection (displayName = first name + last initial).
 * Idempotent: an already-complete profile returns its current values; a
 * different birth date is refused with BIRTHDATE_LOCKED (admins correct it).
 */
import type { Firestore } from "firebase-admin/firestore";
import {
  AppError,
  COLLECTIONS,
  DEFAULT_TIME_ZONE,
  NEW_VOLUNTEER_RELIABILITY,
  PATHS,
  ageOn,
  displayNameFor,
  fullNameFor,
  userPublicDocSchema,
  type PrivateProfileDoc,
  type UserPublicDoc
} from "@fbla/shared";
import { signedIn } from "../lib/auth";
import { defineCallable } from "../lib/defineCallable";
import type { ServerDeps } from "../lib/deps";
import { readDoc, ts } from "../lib/firestore";
import { verifyTurnstile } from "../turnstile/verifyTurnstile";

const MIN_ACCOUNT_AGE = 13;
const ADULT_AGE = 18;

/** Deletes the Auth user and the docs Tier 0 can create for a uid (SPEC 4.2). */
const deleteAccountData = async (deps: ServerDeps, uid: string): Promise<void> => {
  const db: Firestore = deps.db;
  await db.recursiveDelete(db.collection(COLLECTIONS.users).doc(uid));
  await deps.auth.deleteUser(uid).catch((error: unknown) => {
    const code = (error as { code?: string }).code;
    if (code !== "auth/user-not-found") throw error;
  });
};

export const completeProfile = defineCallable({
  endpoint: "volunteer",
  op: "completeProfile",
  auth: signedIn(),
  handler: async ({ input, caller, clock, deps }) => {
    const { db } = deps;
    const nowMs = clock.nowMs();
    const profileRef = db.doc(PATHS.privateProfile(caller.uid));
    const existing = readDoc<PrivateProfileDoc>(await profileRef.get());

    if (existing?.profileComplete === true) {
      if (existing.birthDate !== input.birthDate) throw new AppError("BIRTHDATE_LOCKED");
      return { displayName: displayNameFor(existing.firstName, existing.lastName), isMinor: existing.isMinor };
    }

    const age = ageOn(input.birthDate, clock.now(), DEFAULT_TIME_ZONE);
    if (age < MIN_ACCOUNT_AGE) {
      await deleteAccountData(deps, caller.uid);
      throw new AppError("AGE_UNDER_13");
    }

    const verifiedByTurnstile = await verifyTurnstile(db, deps.env, deps.log, input.turnstileToken, nowMs);

    const isMinor = age < ADULT_AGE;
    const displayName = displayNameFor(input.firstName, input.lastName);
    const profile: PrivateProfileDoc = {
      firstName: input.firstName,
      lastName: input.lastName,
      fullName: fullNameFor(input.firstName, input.lastName),
      email: caller.email ?? "",
      phone: input.phone ?? null,
      birthDate: input.birthDate,
      isMinor,
      interests: input.interests ?? [],
      skills: input.skills ?? [],
      availability: input.availability ?? null,
      zip: input.zip ?? null,
      // The ZIP-to-geohash table arrives with Tier 1 onboarding; until then no location is stored.
      homeGeohash: null,
      profileComplete: true,
      profileCompletedAt: ts(nowMs),
      turnstileVerifiedAt: verifiedByTurnstile ? ts(nowMs) : null,
      reliability: { ...NEW_VOLUNTEER_RELIABILITY, windowFrom: null },
      createdAt: existing?.createdAt ?? ts(nowMs),
      updatedAt: ts(nowMs)
    };
    const userRef = db.collection(COLLECTIONS.users).doc(caller.uid);
    const existingUser = readDoc<UserPublicDoc>(await userRef.get());
    // The public doc goes through the strict schema so no private field can slip in.
    const publicDoc = userPublicDocSchema.parse({
      displayName,
      avatarPath: existingUser?.avatarPath ?? null,
      badges: existingUser?.badges ?? [],
      totalApprovedHours: existingUser?.totalApprovedHours ?? 0,
      orgsHelpedCount: existingUser?.orgsHelpedCount ?? 0,
      streakWeeks: existingUser?.streakWeeks ?? 0,
      createdAt: existingUser?.createdAt ?? ts(nowMs),
      updatedAt: ts(nowMs)
    });

    const batch = db.batch();
    batch.set(profileRef, profile, { merge: true });
    batch.set(userRef, publicDoc);
    await batch.commit();
    return { displayName, isMinor };
  }
});

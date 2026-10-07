/**
 * updateProfile.ts
 * volunteer.updateProfile (SPEC 5.2, SPEC#dm-private). Set semantics: only
 * the fields sent change. Name changes refresh fullName and the public
 * displayName projection (first name + last initial); a ZIP is stored with
 * its coarse area, the precision-5 geohash of the bundled ZIP centroid (null
 * when unknown or cleared, SPEC 4.2), never an address. Birth date is not
 * editable here. avatarPath must sit in the caller's own avatars/{uid}/
 * folder. Profile-gated like every volunteer op except completeProfile.
 */
import {
  AppError,
  COLLECTIONS,
  PATHS,
  displayNameFor,
  fullNameFor,
  homeGeohashForZip,
  type PrivateProfileDoc
} from "@fbla/shared";
import { signedIn } from "../lib/auth";
import { defineCallable } from "../lib/defineCallable";
import { readDoc, runTx, ts } from "../lib/firestore";

export const updateProfile = defineCallable({
  endpoint: "volunteer",
  op: "updateProfile",
  auth: signedIn(),
  handler: async ({ input, caller, clock, deps }) => {
    const { db } = deps;
    const at = ts(clock.nowMs());
    if (input.avatarPath && !input.avatarPath.startsWith(`avatars/${caller.uid}/`)) throw new AppError("PERMISSION_DENIED");
    const profileRef = db.doc(PATHS.privateProfile(caller.uid));
    const userRef = db.collection(COLLECTIONS.users).doc(caller.uid);

    return runTx(db, async (tx) => {
      const profile = readDoc<PrivateProfileDoc>(await tx.get(profileRef));
      // The profile gate already required a complete profile; this guards a race with deletion.
      if (profile === null) throw new AppError("PROFILE_INCOMPLETE");
      const firstName = input.firstName ?? profile.firstName;
      const lastName = input.lastName ?? profile.lastName;
      const displayName = displayNameFor(firstName, lastName);
      const zip = input.zip === undefined ? profile.zip : input.zip;
      const homeGeohash = input.zip === undefined ? profile.homeGeohash : homeGeohashForZip(input.zip);

      const patch: Record<string, unknown> = { updatedAt: at };
      if (input.firstName !== undefined || input.lastName !== undefined) Object.assign(patch, { firstName, lastName, fullName: fullNameFor(firstName, lastName) });
      if (input.interests !== undefined) patch.interests = input.interests;
      if (input.skills !== undefined) patch.skills = input.skills;
      if (input.availability !== undefined) patch.availability = input.availability;
      if (input.phone !== undefined) patch.phone = input.phone;
      if (input.zip !== undefined) Object.assign(patch, { zip, homeGeohash });
      tx.update(profileRef, patch);

      const publicPatch: Record<string, unknown> = {};
      if (displayName !== displayNameFor(profile.firstName, profile.lastName)) publicPatch.displayName = displayName;
      if (input.avatarPath !== undefined) publicPatch.avatarPath = input.avatarPath;
      if (Object.keys(publicPatch).length > 0) tx.set(userRef, { ...publicPatch, updatedAt: at }, { merge: true });
      return { displayName, homeGeohash };
    });
  }
});

/**
 * registerOrganization.ts
 * coordinator.registerOrganization (SPEC#fn-registerorganization, SPEC 5.8, G14).
 * An adult (age computed now, G11) with a verified email registers a
 * nonprofit. One transaction writes the organization (verified false, no
 * activity, not archived) and the caller's owner membership. The org id is a
 * hash of (uid, requestNonce), so a retried click returns the same org.
 */
import {
  AppError,
  COLLECTIONS,
  DEFAULT_TIME_ZONE,
  EIN_PATTERN,
  PATHS,
  ageOn,
  displayNameFor,
  type MemberDoc,
  type OrganizationDoc
} from "@fbla/shared";
import { profileComplete } from "../lib/auth";
import { defineCallable } from "../lib/defineCallable";
import { readDoc, runTx, ts } from "../lib/firestore";
import { hashId } from "../lib/requestIds";

const ADULT_AGE = 18;

export const registerOrganization = defineCallable({
  endpoint: "coordinator",
  op: "registerOrganization",
  auth: profileComplete(),
  handler: async ({ input, caller, clock, deps, profile }) => {
    if (profile === null) throw new AppError("PROFILE_INCOMPLETE");
    const { db } = deps;
    const orgId = hashId(["org", caller.uid, input.requestNonce], 20);
    const orgRef = db.collection(COLLECTIONS.organizations).doc(orgId);

    const existing = readDoc<OrganizationDoc>(await orgRef.get());
    if (existing !== null) {
      if (existing.ownerUid !== caller.uid) throw new AppError("PERMISSION_DENIED");
      return { orgId };
    }
    if (ageOn(profile.birthDate, clock.now(), DEFAULT_TIME_ZONE) < ADULT_AGE) throw new AppError("ADULT_REQUIRED");
    if (!EIN_PATTERN.test(input.ein)) throw new AppError("EIN_INVALID");
    if (!caller.emailVerified) throw new AppError("EMAIL_NOT_VERIFIED");

    const at = ts(clock.nowMs());
    const org: OrganizationDoc = {
      name: input.name,
      mission: input.mission,
      causeAreas: input.causeAreas,
      ein: input.ein,
      address: input.address,
      geo: null,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone ?? null,
      website: input.website ?? null,
      timeZone: input.timeZone,
      photoPaths: [],
      ownerUid: caller.uid,
      verified: false,
      verifiedAt: null,
      verifiedBy: null,
      hasActivity: false,
      archived: false,
      archivedAt: null,
      createdAt: at,
      updatedAt: at
    };
    const member: MemberDoc = {
      uid: caller.uid,
      orgId,
      role: "owner",
      displayName: displayNameFor(profile.firstName, profile.lastName),
      // Owners are adults (checked above), so they may see contact snapshots (G14).
      canViewContacts: true,
      invitedBy: null,
      joinedAt: at,
      createdAt: at,
      updatedAt: at
    };
    await runTx(db, async (tx) => {
      if ((await tx.get(orgRef)).exists) return; // a concurrent retry with the same nonce won
      tx.create(orgRef, org);
      tx.set(db.doc(PATHS.member(orgId, caller.uid)), member);
    });
    return { orgId };
  }
});

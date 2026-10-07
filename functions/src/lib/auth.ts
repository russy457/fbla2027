/**
 * auth.ts
 * Authorization modes for callable ops (SPEC#auth-resolvers, G2, G15).
 *
 * An op picks one mode. defineCallable runs it after the input is parsed:
 *   signedIn()              any signed-in person (no kiosk token); profile not required
 *   profileComplete()       signed in and finished onboarding (G11 profile gate)
 *   admin()                 admin custom claim
 *   coordinatorOf(resolve)  loads the target resource, derives its orgId, and
 *                           requires an owner/coordinator members doc there.
 *                           orgId is never taken from client input when a
 *                           resource id exists, so a coordinator of org A
 *                           cannot act on org B by lying about orgId.
 *   volunteerOf(signupId)   the signup must belong to the caller
 *   letterRevoker(letterId) admin, or owner of any org the letter counts
 *   kioskOrCoordinatorOfInstance(instanceId)
 *                           a kiosk token scoped to that instance, or a coordinator
 *
 * Kiosk tokens (custom tokens from startKiosk) are rejected by every mode
 * except kioskOrCoordinatorOfInstance for the exact instance in the token.
 */
import type { Firestore } from "firebase-admin/firestore";
import {
  AppError,
  COLLECTIONS,
  PATHS,
  type InstanceDoc,
  type LetterDoc,
  type MemberDoc,
  type SignupDoc
} from "@fbla/shared";
import { readDoc } from "./firestore";

/** Claims a kiosk custom token carries (SPEC 4.1 role "kiosk"). */
export interface KioskClaims {
  readonly instanceId: string;
  readonly orgId: string;
  /** Expiry in epoch ms. */
  readonly expMs: number;
}

export interface Caller {
  readonly uid: string;
  readonly isAdmin: boolean;
  readonly email: string | null;
  readonly emailVerified: boolean;
  /** Present only for kiosk tokens. */
  readonly kiosk: KioskClaims | null;
}

export interface Loaded<T> {
  readonly id: string;
  readonly data: T;
}

export interface Authorized<R> {
  readonly orgId: string | null;
  readonly instanceId: string | null;
  readonly resource: R;
}

export interface AuthContext {
  readonly caller: Caller;
  readonly db: Firestore;
}

export interface AuthMode<I, R> {
  readonly name: string;
  /** Whether the G11 profile gate applies to this caller. */
  readonly requiresProfile: (caller: Caller) => boolean;
  /** The instance a kiosk token may act on for this input; omitted means kiosk tokens are refused. */
  readonly kioskInstanceId?: (input: I) => string;
  readonly authorize: (input: I, context: AuthContext) => Promise<Authorized<R>>;
}

/** Reads kiosk claims from a decoded ID token, or null for a normal user token. */
export const readKioskClaims = (token: Readonly<Record<string, unknown>>): KioskClaims | null => {
  const { kioskInstanceId, kioskOrgId, kioskExp } = token;
  if (typeof kioskInstanceId !== "string") return null;
  return {
    instanceId: kioskInstanceId,
    orgId: typeof kioskOrgId === "string" ? kioskOrgId : "",
    expMs: typeof kioskExp === "number" ? kioskExp : 0
  };
};

const NOTHING: Authorized<null> = { orgId: null, instanceId: null, resource: null };

export const signedIn = (): AuthMode<unknown, null> => ({
  name: "signedIn",
  requiresProfile: () => false,
  authorize: async () => NOTHING
});

export const profileComplete = (): AuthMode<unknown, null> => ({
  name: "profileComplete",
  requiresProfile: () => true,
  authorize: async () => NOTHING
});

export const admin = (): AuthMode<unknown, null> => ({
  name: "admin",
  requiresProfile: () => false,
  authorize: async (_input, { caller }) => {
    if (!caller.isAdmin) throw new AppError("PERMISSION_DENIED");
    return NOTHING;
  }
});

/** True when uid has an owner or coordinator members doc in orgId. */
export const isCoordinatorOf = async (db: Firestore, orgId: string, uid: string): Promise<boolean> => {
  const member = readDoc<MemberDoc>(await db.doc(PATHS.member(orgId, uid)).get());
  return member !== null && (member.role === "owner" || member.role === "coordinator");
};

export const isOwnerOf = async (db: Firestore, orgId: string, uid: string): Promise<boolean> => {
  const member = readDoc<MemberDoc>(await db.doc(PATHS.member(orgId, uid)).get());
  return member?.role === "owner";
};

/** Loads a document by id or throws NOT_FOUND. */
export const loadOrNotFound = async <T>(db: Firestore, collection: string, id: string): Promise<Loaded<T>> => {
  const data = readDoc<T>(await db.collection(collection).doc(id).get());
  if (data === null) throw new AppError("NOT_FOUND");
  return { id, data };
};

/** A resource loader that names the org the resource belongs to. */
export type ResourceResolver<I, R> = (input: I, db: Firestore) => Promise<Authorized<R>>;

/** Resolver for ops that name an instance (coordinatorOfInstance in the SPEC). */
export const instanceResource =
  <I>(instanceIdOf: (input: I) => string): ResourceResolver<I, Loaded<InstanceDoc>> =>
  async (input, db) => {
    const instance = await loadOrNotFound<InstanceDoc>(db, COLLECTIONS.instances, instanceIdOf(input));
    return { orgId: instance.data.orgId, instanceId: instance.id, resource: instance };
  };

export const coordinatorOf = <I, R>(resolve: ResourceResolver<I, R>): AuthMode<I, R> => ({
  name: "coordinatorOf",
  requiresProfile: () => true,
  authorize: async (input, { caller, db }) => {
    const resolved = await resolve(input, db);
    if (resolved.orgId === null || !(await isCoordinatorOf(db, resolved.orgId, caller.uid))) {
      throw new AppError("PERMISSION_DENIED");
    }
    return resolved;
  }
});

export const volunteerOf = <I>(signupIdOf: (input: I) => string): AuthMode<I, Loaded<SignupDoc>> => ({
  name: "volunteerOf",
  requiresProfile: () => true,
  authorize: async (input, { caller, db }) => {
    const signup = await loadOrNotFound<SignupDoc>(db, COLLECTIONS.signups, signupIdOf(input));
    if (signup.data.uid !== caller.uid) throw new AppError("PERMISSION_DENIED");
    return { orgId: signup.data.orgId, instanceId: signup.data.instanceId, resource: signup };
  }
});

export const letterRevoker = <I>(letterIdOf: (input: I) => string): AuthMode<I, Loaded<LetterDoc>> => ({
  name: "letterRevoker",
  // Admins can revoke without a volunteer profile; owners go through the gate.
  requiresProfile: (caller) => !caller.isAdmin,
  authorize: async (input, { caller, db }) => {
    const letter = await loadOrNotFound<LetterDoc>(db, COLLECTIONS.letters, letterIdOf(input));
    if (caller.isAdmin) return { orgId: null, instanceId: null, resource: letter };
    const ownerChecks = await Promise.all(letter.data.orgIds.map((orgId) => isOwnerOf(db, orgId, caller.uid)));
    const ownedOrg = letter.data.orgIds.find((_orgId, index) => ownerChecks[index]);
    if (ownedOrg === undefined) throw new AppError("PERMISSION_DENIED");
    return { orgId: ownedOrg, instanceId: null, resource: letter };
  }
});

export const kioskOrCoordinatorOfInstance = <I>(instanceIdOf: (input: I) => string): AuthMode<I, Loaded<InstanceDoc>> => {
  const loadInstance = instanceResource(instanceIdOf);
  const asCoordinator = coordinatorOf(loadInstance);
  return {
    name: "kioskOrCoordinatorOfInstance",
    // Kiosk tokens have no profile; coordinators do.
    requiresProfile: (caller) => caller.kiosk === null,
    kioskInstanceId: instanceIdOf,
    authorize: async (input, context) => {
      // defineCallable already matched the kiosk token's instance to this input.
      if (context.caller.kiosk !== null) return loadInstance(input, context.db);
      return asCoordinator.authorize(input, context);
    }
  };
};

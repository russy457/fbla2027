/**
 * laneBHelpers.ts
 * Setup helpers for the Tier 1 lane B end-to-end spec. Everything talks to
 * the local emulators only (project demo-fbla2027): the Admin SDK writes the
 * few extra records a scenario needs (pending hours for Needs attention), and
 * callOpAs calls an op over the callable protocol as a seeded demo account.
 */
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";
import { DEMO_PASSWORD, PROJECT_ID } from "./tier0Helpers";

const AUTH_EMULATOR = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099"}`;
const FUNCTIONS_EMULATOR = `http://127.0.0.1:${process.env.E2E_FUNCTIONS_PORT ?? "5001"}/${PROJECT_ID}/us-central1`;

/** Admin Firestore on the emulator (emulators:exec exports FIRESTORE_EMULATOR_HOST). */
export const adminDb = (): Firestore => getFirestore(getApps()[0] ?? initializeApp({ projectId: PROJECT_ID }));

const idTokenFor = async (email: string): Promise<string> => {
  const response = await fetch(`${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: DEMO_PASSWORD, returnSecureToken: true })
  });
  const { idToken } = (await response.json()) as { idToken?: string };
  if (!idToken) throw new Error(`Sign-in for ${email} on the Auth emulator failed. Was the demo seeded?`);
  return idToken;
};

/** Calls endpoint.op as a seeded account; returns `data` or throws with the server error. */
export const callOpAs = async (email: string, endpoint: string, op: string, input: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const response = await fetch(`${FUNCTIONS_EMULATOR}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await idTokenFor(email)}` },
    body: JSON.stringify({ data: { op, ...input } })
  });
  const body = (await response.json()) as { result?: { ok: boolean; data: Record<string, unknown> }; error?: unknown };
  if (!response.ok || !body.result?.ok) throw new Error(`${endpoint}.${op} failed: ${JSON.stringify(body.error ?? body)}`);
  return body.result.data;
};

export interface PendingHoursSetup {
  readonly reviewLogId: string;
  readonly manualLogId: string;
}

/**
 * Adds two items to the Needs attention queue of `orgId`: a finalize
 * auto-completion (needsReview) for a background volunteer on a past shift,
 * and a pending manual entry from the adult demo volunteer.
 */
export const seedPendingHours = async (orgId: string, volunteerUid: string): Promise<PendingHoursSetup> => {
  const db = adminDb();
  const now = Date.now();
  const startMs = now - 3 * 24 * 3_600_000;
  const at = Timestamp.fromMillis(now);
  const instanceId = "e2e-laneb-past";
  const reviewLogId = `${instanceId}_demo-bg-dev`;
  const manualLogId = "manual_e2e_laneb";
  const instance = (await db.collection("instances").where("orgId", "==", orgId).limit(1).get()).docs[0]?.data();
  if (!instance) throw new Error(`No instance found for ${orgId}; was the demo seeded?`);
  await db.collection("instances").doc(instanceId).set({
    ...instance,
    title: "Restock the pantry shelves",
    start: Timestamp.fromMillis(startMs),
    end: Timestamp.fromMillis(startMs + 3 * 3_600_000),
    status: "finalized",
    nextActionAt: null
  });
  await db.collection("signups").doc(reviewLogId).set({
    instanceId, opportunityId: instance.opportunityId, orgId, uid: "demo-bg-dev", displayName: "Dev P.",
    instanceStart: Timestamp.fromMillis(startMs), instanceEnd: Timestamp.fromMillis(startMs + 3 * 3_600_000), status: "completed",
    waitlistSeq: null, walkUp: false, promotedAt: null, lateCancel: false, cancelReason: null, cancelledAt: null,
    checkInAt: Timestamp.fromMillis(startMs), checkOutAt: null, autoCompleted: true, excuseReason: null, attendance: null,
    disputeOpen: false, dispute: null, history: [], createdAt: at, updatedAt: at
  });
  const log = { orgId, source: "finalize", date: Timestamp.fromMillis(startMs), status: "pending", description: null, reviewedBy: null, reviewedAt: null, rejectReason: null, createdAt: at, updatedAt: at };
  await db.collection("hoursLogs").doc(reviewLogId).set({ ...log, uid: "demo-bg-dev", instanceId, signupId: reviewLogId, minutes: 180, needsReview: true });
  await db.collection("hoursLogs").doc(manualLogId).set({
    ...log, uid: volunteerUid, instanceId: null, signupId: null, source: "manual", minutes: 60, needsReview: false,
    description: "Helped at the holiday food drive", displayName: "Jordan R."
  });
  return { reviewLogId, manualLogId };
};

export const logStatus = async (logId: string): Promise<string | undefined> =>
  (await adminDb().collection("hoursLogs").doc(logId).get()).get("status") as string | undefined;

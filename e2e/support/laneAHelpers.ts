/**
 * laneAHelpers.ts
 * Setup steps for the Tier 1 lane A end-to-end tests. Everything talks to
 * the local emulators only (project demo-fbla2027), never a real project:
 *   - callOpAs(email, endpoint, op, input): calls an op as a seeded demo
 *     account, the way the app does (callable protocol), for the "other
 *     person" in a scenario (for example the volunteer who cancels);
 *   - cloneShift(...): writes a fresh shift copied from the seeded demo shift
 *     with the Admin SDK (instances are Function-written, so a test fixture
 *     uses admin access exactly like the seed does);
 *   - emulatorNowMs(): wall time plus the demo clock offset, so shifts land
 *     where the app's clock expects them even after tier0 advanced it.
 */
import { getApps, initializeApp } from "firebase-admin/app";
import { Timestamp, getFirestore } from "firebase-admin/firestore";
import { DEMO_PASSWORD, PROJECT_ID } from "./tier0Helpers";

const AUTH_EMULATOR = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099"}`;
const FUNCTIONS_EMULATOR = `http://127.0.0.1:${process.env.E2E_FUNCTIONS_PORT ?? "5001"}/${PROJECT_ID}/us-central1`;
const MINUTE_MS = 60_000;

const db = () => getFirestore(getApps()[0] ?? initializeApp({ projectId: PROJECT_ID }));

const signIn = async (email: string): Promise<{ idToken: string; localId: string }> => {
  const response = await fetch(`${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: DEMO_PASSWORD, returnSecureToken: true })
  });
  const body = (await response.json()) as { idToken?: string; localId?: string };
  if (!body.idToken || !body.localId) throw new Error(`Sign-in for ${email} failed on the Auth emulator. Was the demo seeded?`);
  return { idToken: body.idToken, localId: body.localId };
};

export const uidOf = async (email: string): Promise<string> => (await signIn(email)).localId;

export const callOpAs = async (email: string, endpoint: string, op: string, input: Record<string, unknown> = {}): Promise<Record<string, unknown>> => {
  const { idToken } = await signIn(email);
  const response = await fetch(`${FUNCTIONS_EMULATOR}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ data: { op, ...input } })
  });
  const body = (await response.json()) as { result?: { ok: boolean; data: Record<string, unknown> }; error?: unknown };
  if (!response.ok || !body.result?.ok) throw new Error(`${endpoint}.${op} failed: ${JSON.stringify(body.error ?? body)}`);
  return body.result.data;
};

/** The app's "now": wall time plus the demo clock offset (SPEC#clock). */
export const emulatorNowMs = async (): Promise<number> => {
  const clock = await db().doc("demoClock/global").get();
  const offset = clock.exists ? Number(clock.data()?.offsetMs ?? 0) : 0;
  return Date.now() + offset;
};

export interface CloneOptions {
  readonly id: string;
  readonly title: string;
  readonly startsInMin: number;
  readonly lengthMin?: number;
  readonly capacity: number;
}

/** A fresh shift based on the seeded demo shift: same org and opportunity, new id, time, title, and seats. */
export const cloneShift = async (options: CloneOptions): Promise<void> => {
  const source = await db().doc("instances/demo-shift").get();
  if (!source.exists) throw new Error("The seeded demo shift is missing. Run the seed first.");
  const startMs = (await emulatorNowMs()) + options.startsInMin * MINUTE_MS;
  const endMs = startMs + (options.lengthMin ?? 120) * MINUTE_MS;
  const cutoffMs = startMs - 120 * MINUTE_MS;
  await db()
    .doc(`instances/${options.id}`)
    .set({
      ...source.data(),
      title: options.title,
      start: Timestamp.fromMillis(startMs),
      end: Timestamp.fromMillis(endMs),
      capacity: options.capacity,
      signupCount: 0,
      waitlist: [],
      waitlistSeq: 0,
      checkedInCount: 0,
      status: "scheduled",
      cutoffAt: Timestamp.fromMillis(cutoffMs),
      finalizeAt: Timestamp.fromMillis(endMs + 30 * MINUTE_MS),
      cutoffDoneAt: null,
      finalizedAt: null,
      nextActionAt: Timestamp.fromMillis(cutoffMs)
    });
  // The kiosk key material, so issueKioskCode works for the clone too.
  const secret = await db().doc("instanceSecrets/demo-shift").get();
  if (secret.exists) await db().doc(`instanceSecrets/${options.id}`).set(secret.data() ?? {});
};

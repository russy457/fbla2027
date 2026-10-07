/**
 * harness.ts
 * Shared setup for the Functions emulator tests (npm run test:functions).
 * Handlers run in-process with the Admin SDK pointed at the Auth, Firestore,
 * and Storage emulators (emulators:exec sets the *_EMULATOR_HOST variables),
 * and with an injected clock, so time-window tests never wait on the wall
 * clock (SPEC#tests 12.3: "Time-based tests use the injected clock").
 */
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError } from "firebase-functions/v2/https";
import { expect } from "vitest";
import type { Endpoint } from "@fbla/shared";
import { createEndpointHandler, type CallableRequestLike, type RegisteredOp } from "../src/lib/defineCallable";
import type { LogFields, Logger, ServerDeps } from "../src/lib/deps";
import { readFunctionsEnv } from "../src/lib/env";
import { adminOps } from "../src/endpoints/admin";
import { aiOps } from "../src/endpoints/ai";
import { coordinatorOps } from "../src/endpoints/coordinator";
import { kioskOps } from "../src/endpoints/kiosk";
import { volunteerOps } from "../src/endpoints/volunteer";

// No Google metadata server exists locally; skip the lookup so the first call is not delayed by its timeout.
process.env.METADATA_SERVER_DETECTION = "none";

export const PROJECT_ID = "demo-fbla2027";
export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
/** 2026-10-17 08:00 CDT. Every test starts the clock here. */
export const BASE_MS = Date.UTC(2026, 9, 17, 13, 0, 0);

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Run these tests with npm run test:functions (it starts the emulators).`);
  return value;
};

const app = getApps()[0] ?? initializeApp({ projectId: PROJECT_ID, storageBucket: `${PROJECT_ID}.appspot.com` });
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

/** A clock the test moves by hand. */
export const testClock = {
  nowMs: BASE_MS,
  set(ms: number) {
    this.nowMs = ms;
  },
  advance(ms: number) {
    this.nowMs += ms;
  }
};

export interface LogLine {
  readonly level: "info" | "warn" | "error";
  readonly message: string;
  readonly fields: LogFields | undefined;
}
export const logLines: LogLine[] = [];
const captureLogger: Logger = {
  info: (message, fields) => logLines.push({ level: "info", message, fields }),
  warn: (message, fields) => logLines.push({ level: "warn", message, fields }),
  error: (message, fields) => logLines.push({ level: "error", message, fields })
};

/** Deps for the handlers; extraEnv overrides the emulator defaults (for example JOB_PAGE_SIZE). */
export const makeDeps = (extraEnv: Record<string, string> = {}): ServerDeps => ({
  db,
  auth,
  storage,
  // Tier 2 lane B: pass the Storage emulator host through so signed links work on non-default ports.
  env: readFunctionsEnv({ FUNCTIONS_EMULATOR: "true", GCLOUD_PROJECT: PROJECT_ID, FIREBASE_STORAGE_EMULATOR_HOST: process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? "", ...extraEnv }),
  nowMs: () => testClock.nowMs,
  log: captureLogger
});

const TABLES: Record<Endpoint, readonly RegisteredOp[]> = {
  volunteer: volunteerOps,
  kiosk: kioskOps,
  coordinator: coordinatorOps,
  admin: adminOps,
  ai: aiOps
};

export type AuthLike = CallableRequestLike["auth"];

/** Calls `endpoint` with { op, ...input } and returns `data` (throws the HttpsError on failure). */
export const call = async <T = Record<string, unknown>>(
  endpoint: Endpoint,
  op: string,
  input: Record<string, unknown>,
  authLike: AuthLike,
  deps: ServerDeps = makeDeps()
): Promise<T> => {
  const handler = createEndpointHandler(endpoint, TABLES[endpoint], () => deps);
  const response = await handler({ data: { op, ...input }, auth: authLike });
  expect(response.ok).toBe(true);
  expect(typeof response.requestId).toBe("string");
  return response.data as T;
};

/** Asserts a promise rejects with an HttpsError carrying the catalog code. */
export const expectCode = async (promise: Promise<unknown>, code: string): Promise<HttpsError> => {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(HttpsError);
    const details = (error as HttpsError).details as { code?: string };
    expect(details.code).toBe(code);
    return error as HttpsError;
  }
  throw new Error(`expected ${code}, but the call succeeded`);
};

export const user = (uid: string, claims: Record<string, unknown> = {}): AuthLike => ({
  uid,
  token: { email: `${uid}@example.test`, email_verified: true, ...claims }
});
export const adminUser = (uid = "admin1"): AuthLike => user(uid, { admin: true });
export const kioskUser = (instanceId: string, expMs = testClock.nowMs + 12 * HOUR): AuthLike => ({
  uid: `kiosk_${instanceId}_test`,
  token: { kioskInstanceId: instanceId, kioskOrgId: "orgA", kioskExp: expMs }
});

/** Wipes the emulators between tests through their REST reset endpoints. */
export const resetEmulators = async (): Promise<void> => {
  const firestoreHost = requireEnv("FIRESTORE_EMULATOR_HOST");
  const authHost = requireEnv("FIREBASE_AUTH_EMULATOR_HOST");
  const responses = await Promise.all([
    fetch(`http://${firestoreHost}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: "DELETE" }),
    fetch(`http://${authHost}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: "DELETE" })
  ]);
  responses.forEach((response) => expect(response.ok).toBe(true));
  testClock.set(BASE_MS);
  logLines.length = 0;
};

export const tsAt = (ms: number): Timestamp => Timestamp.fromMillis(ms);

/**
 * runDemoSeed.ts
 * Writes the demo seed (demoSeed.ts) into the emulators through
 * applyDemoSeed.ts (accounts, documents, the seeded letter's PDF), the same
 * code admin.resetDemoData runs server-side. scripts/seed-demo.mjs bundles
 * and calls this; it is not exported by functions/src/index.ts, so it is
 * never deployed.
 *
 * Safety: refuses any project id that does not start with "demo-" and any run
 * where the Firestore or Auth emulator host is not set, so it cannot write to
 * a real Firebase project.
 */
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import type { Logger } from "../lib/deps";
import { applyDemoSeed } from "./applyDemoSeed";
import { formatSeedSummary } from "./seedSummary";

export interface SeedRunOptions {
  readonly projectId: string;
  /** Real wall-clock time, passed in by the CLI (functions/src never reads the clock itself). */
  readonly nowMs: number;
  readonly shiftStartsInMs: number;
  readonly password: string;
  readonly appUrl: string;
  readonly emulatorUiUrl: string;
}

const consoleLogger: Logger = {
  info: (message, fields) => console.log(`seed: ${message}`, fields ?? ""),
  warn: (message, fields) => console.warn(`seed: ${message}`, fields ?? ""),
  error: (message, fields) => console.error(`seed: ${message}`, fields ?? "")
};

const assertEmulatorOnly = (projectId: string): void => {
  if (!projectId.startsWith("demo-")) throw new Error(`refusing to seed project "${projectId}"; the seed only runs against demo- projects`);
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error("FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST must point at the emulators");
  }
};

/** Seeds the emulators and returns the printable summary. */
export const runDemoSeed = async (options: SeedRunOptions): Promise<string> => {
  assertEmulatorOnly(options.projectId);
  const bucket = `${options.projectId}.appspot.com`;
  const app = getApps()[0] ?? initializeApp({ projectId: options.projectId, storageBucket: bucket });
  const { seed, letterPdfStatus } = await applyDemoSeed({
    db: getFirestore(app),
    auth: getAuth(app),
    storage: getStorage(app),
    bucket,
    log: consoleLogger,
    nowMs: options.nowMs,
    shiftStartsInMs: options.shiftStartsInMs,
    password: options.password,
    appBaseUrl: options.appUrl
  });

  return formatSeedSummary({
    projectId: options.projectId,
    accounts: seed.accounts,
    password: options.password,
    appUrl: options.appUrl,
    emulatorUiUrl: options.emulatorUiUrl,
    demoShiftStartMs: seed.demoShiftStartMs,
    shiftStartsInMs: options.shiftStartsInMs,
    letterVerifyCode: seed.letter.letter.verifyCode,
    letterPdfStatus
  });
};

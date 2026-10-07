/**
 * runDemoSeed.ts
 * Writes the demo seed (demoSeed.ts) into the emulators: creates or updates
 * the four sign-in accounts (admin claim on Ada), commits every document,
 * then renders the seeded letter's PDF into Storage the same way issueLetter
 * does. scripts/seed-demo.mjs bundles and calls this; it is not exported by
 * functions/src/index.ts, so it is never deployed.
 *
 * Safety: refuses any project id that does not start with "demo-" and any run
 * where the Firestore or Auth emulator host is not set, so it cannot write to
 * a real Firebase project.
 */
import { randomBytes } from "node:crypto";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import type { Logger } from "../lib/deps";
import { newVerifyCode } from "../letters/letterIds";
import { storeLetterPdf } from "../letters/storeLetterPdf";
import { nameOf } from "./seedBuilders";
import type { DemoAccount } from "./demoCast";
import { buildDemoSeed } from "./demoSeed";
import type { SeedWrite } from "./demoHistory";
import { formatSeedSummary } from "./seedSummary";

/** Firestore batches allow 500 writes; stay well under. */
const BATCH_SIZE = 400;
const SALT_BYTES = 32;

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

const upsertAccount = async (auth: Auth, account: DemoAccount, password: string): Promise<void> => {
  const record = { email: account.email, password, displayName: nameOf(account), emailVerified: true };
  try {
    await auth.updateUser(account.uid, record);
  } catch (error) {
    if ((error as { code?: string }).code !== "auth/user-not-found") throw error;
    await auth.createUser({ uid: account.uid, ...record });
  }
  await auth.setCustomUserClaims(account.uid, account.admin ? { admin: true } : null);
};

const commitAll = async (db: Firestore, writes: readonly SeedWrite[]): Promise<void> => {
  for (let index = 0; index < writes.length; index += BATCH_SIZE) {
    const batch = db.batch();
    writes.slice(index, index + BATCH_SIZE).forEach((write) => batch.set(db.doc(write.path), write.data));
    await batch.commit();
  }
};

/** Seeds the emulators and returns the printable summary. */
export const runDemoSeed = async (options: SeedRunOptions): Promise<string> => {
  assertEmulatorOnly(options.projectId);
  const bucket = `${options.projectId}.appspot.com`;
  const app = getApps()[0] ?? initializeApp({ projectId: options.projectId, storageBucket: bucket });
  const db = getFirestore(app);
  const auth = getAuth(app);

  const seed = buildDemoSeed({
    nowMs: options.nowMs,
    shiftStartsInMs: options.shiftStartsInMs,
    saltFor: () => randomBytes(SALT_BYTES).toString("base64"),
    letterVerifyCode: newVerifyCode(),
    letterNonce: randomBytes(16).toString("hex")
  });
  for (const account of seed.accounts) await upsertAccount(auth, account, options.password);
  await commitAll(db, seed.writes);

  // A missing Storage emulator only marks the letter's PDF "failed"; the volunteer can retry from Impact.
  const letterPdfStatus = await storeLetterPdf({
    db,
    storage: getStorage(app),
    bucket,
    log: consoleLogger,
    appBaseUrl: options.appUrl,
    letterId: seed.letter.letterId,
    letter: seed.letter.letter,
    fullName: seed.letter.fullName,
    nowMs: options.nowMs
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

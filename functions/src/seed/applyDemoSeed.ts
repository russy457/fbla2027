/**
 * applyDemoSeed.ts
 * Writes the demo seed through whatever Admin SDK handles it is given:
 * creates or refreshes the four sign-in accounts (admin claim on Ada),
 * commits every document in batches, then renders the seeded letter's PDF.
 *
 * Two callers, one code path:
 *   runDemoSeed.ts          local CLI (npm run seed:demo), emulators only
 *   resetDemoData.ts        clearDemoData() then this, server-side, for the
 *                           admin "Reset demo data" button (DEMO_MODE only)
 */
import { randomBytes } from "node:crypto";
import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import type { Storage } from "firebase-admin/storage";
import type { Logger } from "../lib/deps";
import { newVerifyCode } from "../letters/letterIds";
import { storeLetterPdf } from "../letters/storeLetterPdf";
import type { DemoAccount } from "./demoCast";
import type { SeedWrite } from "./demoHistory";
import { buildDemoSeed, type DemoSeed } from "./demoSeed";
import { nameOf } from "./seedBuilders";

/** Firestore batches allow 500 writes; stay well under. */
const BATCH_SIZE = 400;
const SALT_BYTES = 32;

export interface ApplySeedParams {
  readonly db: Firestore;
  readonly auth: Auth;
  readonly storage: Storage;
  readonly bucket: string;
  readonly log: Logger;
  readonly nowMs: number;
  readonly shiftStartsInMs: number;
  readonly password: string;
  readonly appBaseUrl: string;
}

export interface AppliedSeed {
  readonly seed: DemoSeed;
  readonly letterPdfStatus: string;
}

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

export const applyDemoSeed = async (params: ApplySeedParams): Promise<AppliedSeed> => {
  const seed = buildDemoSeed({
    nowMs: params.nowMs,
    shiftStartsInMs: params.shiftStartsInMs,
    saltFor: () => randomBytes(SALT_BYTES).toString("base64"),
    letterVerifyCode: newVerifyCode(),
    letterNonce: randomBytes(16).toString("hex")
  });
  for (const account of seed.accounts) await upsertAccount(params.auth, account, params.password);
  await commitAll(params.db, seed.writes);

  // A Storage failure only marks the letter's PDF "failed"; the volunteer can retry from Impact.
  const letterPdfStatus = await storeLetterPdf({
    db: params.db,
    storage: params.storage,
    bucket: params.bucket,
    log: params.log,
    appBaseUrl: params.appBaseUrl,
    letterId: seed.letter.letterId,
    letter: seed.letter.letter,
    fullName: seed.letter.fullName,
    nowMs: params.nowMs
  });
  return { seed, letterPdfStatus };
};

/**
 * Deletes every top-level collection (and their subcollections). Only ever
 * called by admin.resetDemoData after its DEMO_MODE check; a demo project
 * holds nothing but demo data. Returns how many collections were cleared.
 */
export const clearDemoData = async (db: Firestore): Promise<number> => {
  const collections = await db.listCollections();
  for (const collection of collections) await db.recursiveDelete(collection);
  return collections.length;
};

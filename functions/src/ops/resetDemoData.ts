/**
 * resetDemoData.ts
 * admin.resetDemoData (SPEC 5.2, SPEC#demo-accounts 10.7, E1): the admin
 * "Reset demo data" button. Clears every Firestore collection (Tier 1
 * notifications, saved items, invites, reports, the verification log, and
 * AI usage included) and the generated report and letter PDFs in Storage,
 * then runs the same seed module as `npm run seed:demo` (applyDemoSeed.ts),
 * so the deployed competition site returns to the known demo state, with the demo
 * shift starting in `shiftStartsInMin` (default 10) minutes and the demo
 * clock back at zero.
 *
 * Safety (PORT_PLAN E1 reset safety): requires the admin claim AND
 * DEMO_MODE; anything else is refused before a single document is touched.
 * Demo account passwords: the fixed local password on the emulator, the
 * DEMO_ACCOUNT_PASSWORD secret when deployed (refused if it is missing).
 * The seed time is real time (deps.nowMs), not the demo clock, because the
 * reset also zeroes the demo clock.
 */
import { AppError, DEFAULT_DEMO_SHIFT_STARTS_IN_MIN, MINUTE_MS } from "@fbla/shared";
import { admin } from "../lib/auth";
import { defineCallable } from "../lib/defineCallable";
import type { FunctionsEnv } from "../lib/env";
import { applyDemoSeed, clearDemoData, clearDemoFiles } from "../seed/applyDemoSeed";

/** Emulator-only demo password; matches scripts/seed-demo.mjs and the e2e helpers. */
export const LOCAL_DEMO_PASSWORD = "fbla2027-demo-2027";

const demoPassword = (env: FunctionsEnv, secret: string | undefined): string => {
  if (env.isEmulator) return LOCAL_DEMO_PASSWORD;
  if (!secret || secret.trim().length < 8) throw new AppError("INTERNAL");
  return secret.trim();
};

export const resetDemoData = defineCallable({
  endpoint: "admin",
  op: "resetDemoData",
  auth: admin(),
  handler: async ({ input, deps, caller, fn }) => {
    // A local Functions emulator can be aimed at live Firestore. Its reset
    // must never recursively delete collections in a real project.
    if (!deps.env.demoMode || (deps.env.isEmulator && !deps.env.projectId.startsWith("demo-"))) {
      throw new AppError("DEMO_MODE_REQUIRED");
    }
    const password = demoPassword(deps.env, process.env.DEMO_ACCOUNT_PASSWORD);
    const minutes = input.shiftStartsInMin ?? DEFAULT_DEMO_SHIFT_STARTS_IN_MIN;
    const nowMs = deps.nowMs();

    const collectionsCleared = await clearDemoData(deps.db);
    const filesCleared = await clearDemoFiles(deps.storage, deps.env.storageBucket);
    const { seed, letterPdfStatus } = await applyDemoSeed({
      db: deps.db,
      auth: deps.auth,
      storage: deps.storage,
      bucket: deps.env.storageBucket,
      log: deps.log,
      nowMs,
      shiftStartsInMs: minutes * MINUTE_MS,
      password,
      appBaseUrl: deps.env.appBaseUrl
    });
    deps.log.info(`${fn} reseeded`, { fn, uid: caller.uid, documents: seed.writes.length, collectionsCleared, filesCleared, letterPdfStatus });
    return {
      documents: seed.writes.length,
      collectionsCleared,
      accounts: seed.accounts.length,
      demoShiftStartsAt: new Date(seed.demoShiftStartMs).toISOString()
    };
  }
});

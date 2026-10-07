/**
 * kiosk.ts
 * The "kiosk" callable endpoint (SPEC 2.3, G4): rotating code, check-in,
 * check-out. KIOSK_MIN_INSTANCES=1 keeps one instance warm on competition
 * day only, so the first check-in is not a cold start.
 */
import { defineEndpoint, type RegisteredOp } from "../lib/defineCallable";
import { deploySecrets } from "../lib/secrets";
import { checkIn } from "../ops/checkIn";
import { checkOut } from "../ops/checkOut";
import { issueKioskCode } from "../ops/issueKioskCode";
import { pingOp } from "../ops/ping";

export const kioskOps: readonly RegisteredOp[] = [pingOp("kiosk"), issueKioskCode, checkIn, checkOut];

const minInstances = Number(process.env.KIOSK_MIN_INSTANCES ?? "0");

export const kiosk = defineEndpoint("kiosk", kioskOps, {
  minInstances: Number.isInteger(minInstances) && minInstances > 0 ? minInstances : 0,
  secrets: deploySecrets("KIOSK_MASTER_SECRET")
});

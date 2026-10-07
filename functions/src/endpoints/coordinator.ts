/**
 * coordinator.ts
 * The "coordinator" callable endpoint (SPEC 2.3, G4): kiosk start, finalize,
 * and letter revocation. Every op derives the org from the target resource
 * (lib/auth.ts), never from client input. 512 MB for Tier 1 org reports.
 */
import { defineEndpoint, type RegisteredOp } from "../lib/defineCallable";
import { finalizeShift } from "../ops/finalizeShift";
import { pingOp } from "../ops/ping";
import { revokeLetter } from "../ops/revokeLetter";
import { startKiosk } from "../ops/startKiosk";

export const coordinatorOps: readonly RegisteredOp[] = [pingOp("coordinator"), startKiosk, finalizeShift, revokeLetter];

export const coordinator = defineEndpoint("coordinator", coordinatorOps, { memory: "512MiB" });

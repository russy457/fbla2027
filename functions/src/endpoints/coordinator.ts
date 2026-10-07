/**
 * coordinator.ts
 * The "coordinator" callable endpoint (SPEC 2.3, G4): kiosk start, finalize,
 * letter revocation, and org report links. Every op derives the org from the target resource
 * (lib/auth.ts), never from client input. 512 MB for Tier 1 org reports.
 */
import { defineEndpoint, type RegisteredOp } from "../lib/defineCallable";
import { finalizeShift } from "../ops/finalizeShift";
import { getOrgReportUrl } from "../ops/getOrgReportUrl";
import { pingOp } from "../ops/ping";
import { revokeLetter } from "../ops/revokeLetter";
import { startKiosk } from "../ops/startKiosk";
// Tier 1 lane B
import { laneBCoordinatorOps } from "./laneB";

export const coordinatorOps: readonly RegisteredOp[] = [pingOp("coordinator"), startKiosk, finalizeShift, revokeLetter, ...laneBCoordinatorOps, getOrgReportUrl];

export const coordinator = defineEndpoint("coordinator", coordinatorOps, { memory: "512MiB" });

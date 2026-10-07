/**
 * index.ts
 * Cloud Functions entry point. Exports exactly the deployed functions:
 * the health check plus the five domain-grouped callable endpoints (G4).
 * Triggers (supersedeLetters, recomputeVolunteerStats) and the runDueJobs
 * scheduler are added as separate exports in later tiers.
 *
 * Built by scripts/build-functions.mjs into functions-dist/lib/index.js.
 */
export { health } from "./health";
export { volunteer } from "./endpoints/volunteer";
export { coordinator } from "./endpoints/coordinator";
export { kiosk } from "./endpoints/kiosk";
export { admin } from "./endpoints/admin";
export { ai } from "./endpoints/ai";

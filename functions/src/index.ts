/**
 * index.ts
 * Cloud Functions entry point (SPEC 2.3). Exports only deployed functions:
 *   volunteer, coordinator, kiosk, admin, ai   callable endpoints (G4)
 *   recomputeVolunteerStats                    Firestore trigger group (G1)
 *   runDueJobs                                 the only scheduler (G8)
 *   health                                     HTTP GET
 * supersedeLetters (Tier 1) joins this list with letter supersede.
 * Built by scripts/build-functions.mjs into functions-dist/lib/index.js.
 */
export { health } from "./health";
export { volunteer } from "./endpoints/volunteer";
export { coordinator } from "./endpoints/coordinator";
export { kiosk } from "./endpoints/kiosk";
export { admin } from "./endpoints/admin";
export { ai } from "./endpoints/ai";
export { recomputeVolunteerStats } from "./triggers/recomputeVolunteerStats";
export { scheduledRunDueJobs as runDueJobs } from "./jobs/runDueJobs";
// Tier 1 lane B
export { supersedeLetters } from "./triggers/supersedeLetters";
// End Tier 1 lane B

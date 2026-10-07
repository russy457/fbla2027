/**
 * demoMode.ts
 * One question the UI asks in many places: "may demo-only controls render?"
 * (SPEC#clock X12, X5 "Sign in as...", D11 "Demo control"). Reads the
 * validated client env once; a broken env counts as "not demo" so demo
 * controls can never appear by accident.
 */
import { isDemoModeEnv, readClientEnv } from "./env";

let cached: boolean | null = null;

export const isDemoMode = (): boolean => {
  if (cached === null) {
    const result = readClientEnv();
    cached = result.ok && isDemoModeEnv(result.env);
  }
  return cached;
};

/** Emulator-only demo accounts (SPEC#demo-accounts). The password works nowhere but the local emulators. */
export const DEMO_ACCOUNTS = Object.freeze([
  { role: "Volunteer (19)", email: "volunteer@demo.fbla2027.test" },
  { role: "Volunteer (15)", email: "minor@demo.fbla2027.test" },
  { role: "Coordinator", email: "coordinator@demo.fbla2027.test" },
  { role: "Admin", email: "admin@demo.fbla2027.test" }
] as const);

export const DEMO_PASSWORD = "pitchin-demo-2027";

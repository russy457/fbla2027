/**
 * env.ts
 * Reads the Functions environment once into a typed object (SPEC#env).
 * Every flag has a safe local default so the emulators work with zero setup:
 * on the emulator, DEMO_MODE defaults to true, Turnstile is bypassed, and the
 * kiosk master secret falls back to a fixed emulator-only value. Deployed
 * functions get none of those fallbacks.
 */
import { resolveConfig, type AppConfig, type EnvSource } from "@fbla/shared";

/** Used only when running on the emulator; deployed functions require KIOSK_MASTER_SECRET. */
export const EMULATOR_KIOSK_MASTER_SECRET = "emulator-only-kiosk-master-secret-not-for-production";

export const DEFAULT_PROJECT_ID = "demo-fbla2027";

export interface FunctionsEnv {
  readonly projectId: string;
  /** True under the Firebase emulators (functions or Firestore emulator detected). */
  readonly isEmulator: boolean;
  readonly demoMode: boolean;
  /** Demo clock offset is honored only in demo mode on a demo- project or with ALLOW_DEMO_CLOCK (SPEC#clock). */
  readonly demoClockAllowed: boolean;
  /** Real Turnstile verification; never on the emulator (SPEC 5.9, X11). */
  readonly turnstileEnabled: boolean;
  readonly turnstileSecret: string | null;
  readonly kioskMasterSecret: string | null;
  readonly appBaseUrl: string;
  readonly storageBucket: string;
  readonly version: string;
  readonly config: AppConfig;
}

const flag = (value: string | undefined, fallback: boolean): boolean =>
  value === undefined || value.trim() === "" ? fallback : value.trim() === "true";

const readFirebaseConfig = (raw: string | undefined): { projectId?: string; storageBucket?: string } => {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as { projectId?: string; storageBucket?: string };
  } catch {
    return {};
  }
};

const nonEmpty = (value: string | undefined): string | null => (value && value.trim() !== "" ? value.trim() : null);

export const readFunctionsEnv = (env: EnvSource): FunctionsEnv => {
  const firebaseConfig = readFirebaseConfig(env.FIREBASE_CONFIG);
  const projectId = nonEmpty(env.GCLOUD_PROJECT) ?? nonEmpty(env.GCP_PROJECT) ?? firebaseConfig.projectId ?? DEFAULT_PROJECT_ID;
  const isEmulator = env.FUNCTIONS_EMULATOR === "true" || nonEmpty(env.FIRESTORE_EMULATOR_HOST) !== null;
  const demoMode = flag(env.DEMO_MODE, isEmulator);
  return {
    projectId,
    isEmulator,
    demoMode,
    demoClockAllowed: demoMode && (projectId.startsWith("demo-") || flag(env.ALLOW_DEMO_CLOCK, false)),
    turnstileEnabled: !isEmulator && flag(env.TURNSTILE_ENABLED, false),
    turnstileSecret: nonEmpty(env.TURNSTILE_SECRET),
    kioskMasterSecret: nonEmpty(env.KIOSK_MASTER_SECRET) ?? (isEmulator ? EMULATOR_KIOSK_MASTER_SECRET : null),
    appBaseUrl: (nonEmpty(env.APP_BASE_URL) ?? "http://localhost:5173").replace(/\/+$/, ""),
    storageBucket: nonEmpty(env.STORAGE_BUCKET) ?? firebaseConfig.storageBucket ?? `${projectId}.appspot.com`,
    version: nonEmpty(env.K_REVISION) ?? "dev",
    config: resolveConfig(env)
  };
};

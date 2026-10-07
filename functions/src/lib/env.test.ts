/**
 * env.test.ts
 * Functions environment defaults (SPEC#env): safe emulator fallbacks, no
 * fallbacks when deployed, and the demo clock guard (SPEC#clock).
 */
import { describe, expect, it } from "vitest";
import { EMULATOR_KIOSK_MASTER_SECRET, readFunctionsEnv } from "./env";

describe("readFunctionsEnv", () => {
  it("defaults to demo mode, no Turnstile, and an emulator kiosk secret on the emulator", () => {
    const env = readFunctionsEnv({ FUNCTIONS_EMULATOR: "true", GCLOUD_PROJECT: "demo-fbla2027" });
    expect(env).toMatchObject({
      projectId: "demo-fbla2027",
      isEmulator: true,
      demoMode: true,
      demoClockAllowed: true,
      turnstileEnabled: false,
      kioskMasterSecret: EMULATOR_KIOSK_MASTER_SECRET,
      appBaseUrl: "http://localhost:5173",
      storageBucket: "demo-fbla2027.appspot.com",
      storageEmulatorHost: "127.0.0.1:9199",
      version: "dev"
    });
  });

  it("deployed: no secret fallback, Turnstile on when enabled, demo clock only with ALLOW_DEMO_CLOCK", () => {
    const env = readFunctionsEnv({
      GCLOUD_PROJECT: "fbla-prod",
      DEMO_MODE: "true",
      TURNSTILE_ENABLED: "true",
      TURNSTILE_SECRET: " s3cret ",
      APP_BASE_URL: "https://pitch.example/",
      FIREBASE_CONFIG: JSON.stringify({ storageBucket: "fbla-prod.firebasestorage.app" }),
      K_REVISION: "rev-7",
      CHECKIN_RATE_MAX: "5"
    });
    expect(env).toMatchObject({
      isEmulator: false,
      demoMode: true,
      demoClockAllowed: false,
      turnstileEnabled: true,
      turnstileSecret: "s3cret",
      kioskMasterSecret: null,
      appBaseUrl: "https://pitch.example",
      storageBucket: "fbla-prod.firebasestorage.app",
      storageEmulatorHost: null,
      version: "rev-7"
    });
    expect(env.config.checkinRateMax).toBe(5);
    expect(readFunctionsEnv({ GCLOUD_PROJECT: "fbla-prod", DEMO_MODE: "true", ALLOW_DEMO_CLOCK: "true" }).demoClockAllowed).toBe(true);
  });

  it("falls back through project id sources and ignores malformed FIREBASE_CONFIG", () => {
    expect(readFunctionsEnv({ GCP_PROJECT: "p2" }).projectId).toBe("p2");
    expect(readFunctionsEnv({ FIREBASE_CONFIG: JSON.stringify({ projectId: "p3" }) }).projectId).toBe("p3");
    expect(readFunctionsEnv({ FIREBASE_CONFIG: "{not json" }).projectId).toBe("demo-fbla2027");
    expect(readFunctionsEnv({ FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080" }).isEmulator).toBe(true);
    expect(readFunctionsEnv({ FUNCTIONS_EMULATOR: "true", DEMO_MODE: "false" }).demoMode).toBe(false);
    expect(readFunctionsEnv({ FUNCTIONS_EMULATOR: "true", STORAGE_EMULATOR_HOST: "http://localhost:9300/" }).storageEmulatorHost).toBe("localhost:9300");
    expect(readFunctionsEnv({ STORAGE_EMULATOR_HOST: "http://localhost:9300" }).storageEmulatorHost).toBeNull();
  });
});

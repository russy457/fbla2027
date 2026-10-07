import { describe, expect, it } from "vitest";
import { parseClientEnv, readClientEnv } from "./env";

const EXAMPLE_DEFAULTS = {
  VITE_FIREBASE_API_KEY: "demo-key",
  VITE_FIREBASE_AUTH_DOMAIN: "demo-fbla2027.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "demo-fbla2027",
  VITE_FIREBASE_STORAGE_BUCKET: "demo-fbla2027.appspot.com",
  VITE_FIREBASE_APP_ID: "demo-app",
  VITE_USE_EMULATORS: "true",
  VITE_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
  VITE_MAPBOX_TOKEN: "",
  VITE_APPCHECK_SITE_KEY: ""
};

describe("client env", () => {
  it("accepts the .env.example defaults with zero edits", () => {
    const env = parseClientEnv(EXAMPLE_DEFAULTS);
    expect(env.VITE_USE_EMULATORS).toBe(true);
    expect(env.VITE_MAPBOX_TOKEN).toBeUndefined();
    expect(env.VITE_APPCHECK_SITE_KEY).toBeUndefined();
  });

  it("names the missing variable and points to .env.example", () => {
    const { VITE_FIREBASE_PROJECT_ID: _omitted, ...rest } = EXAMPLE_DEFAULTS;
    expect(() => parseClientEnv(rest)).toThrow(/VITE_FIREBASE_PROJECT_ID: missing[\s\S]*\.env\.example/);
  });

  it("readClientEnv reports failure without throwing", () => {
    const result = readClientEnv({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("VITE_FIREBASE_API_KEY");
  });

  it("readClientEnv returns the parsed env on success", () => {
    const result = readClientEnv(EXAMPLE_DEFAULTS);
    expect(result.ok && result.env.VITE_FIREBASE_PROJECT_ID).toBe("demo-fbla2027");
  });
});

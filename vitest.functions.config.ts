/**
 * vitest.functions.config.ts
 * Cloud Functions op, job, and trigger tests against the Auth, Firestore, and
 * Storage emulators (SPEC#tests 12.1). Handlers are called directly with the
 * Admin SDK pointed at the emulators and an injected clock, so no Functions
 * emulator or wall-clock waiting is needed. Run with `npm run test:functions`.
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "functions-emulator",
    environment: "node",
    include: ["functions/test/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000
  }
});

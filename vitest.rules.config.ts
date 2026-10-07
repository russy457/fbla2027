/**
 * vitest.rules.config.ts
 * Security rules tests (SPEC#tests 12.1). They need the Firestore and Storage
 * emulators, so they run only through `npm run test:rules`, which wraps
 * vitest in `firebase emulators:exec --project demo-fbla2027`. Files run one
 * at a time because they share one emulator.
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "rules",
    environment: "node",
    include: ["tests/rules/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000
  }
});

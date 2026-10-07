/**
 * vitest.config.ts
 * One `npm test` runs three projects:
 *   web        src/**        jsdom (React components and browser helpers)
 *   shared     shared/src/** node
 *   functions  functions/src/** node
 * Coverage is collected for all three; shared/src must stay at 100% (plan G27).
 * Playwright specs in e2e/ are excluded (they run with `npm run test:e2e`).
 */
import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      projects: [
        {
          extends: true,
          test: {
            name: "web",
            environment: "jsdom",
            globals: true,
            setupFiles: ["./vitest.setup.ts"],
            include: ["src/**/*.test.{ts,tsx}"],
            // jsdom component tests with userEvent run slowly when the whole suite
            // competes for CPU (coverage on, CI runners); 5 s caused load-only flakes.
            testTimeout: 20_000
          }
        },
        {
          extends: true,
          test: {
            name: "shared",
            environment: "node",
            include: ["shared/src/**/*.test.ts"]
          }
        },
        {
          extends: true,
          test: {
            name: "functions",
            environment: "node",
            include: ["functions/src/**/*.test.ts"]
          }
        }
      ],
      coverage: {
        provider: "v8",
        reporter: ["text-summary", "html"],
        include: ["src/**/*.{ts,tsx}", "shared/src/**/*.ts", "functions/src/**/*.ts"],
        exclude: ["**/*.test.{ts,tsx}", "**/*.d.ts", "src/main.tsx"],
        thresholds: {
          "shared/src/**": { lines: 100, branches: 100, functions: 100, statements: 100 }
        }
      }
    }
  })
);

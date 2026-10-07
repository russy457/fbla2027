import { describe, expect, it } from "vitest";
import { z } from "zod";
import { EnvValidationError, envFlag, optionalEnvString, parseEnv } from "./env";

const schema = z.object({
  PROJECT_ID: z.string().min(1),
  PORT: z.string().regex(/^\d+$/, "must be a number"),
  USE_EMULATORS: envFlag(),
  OPTIONAL_TOKEN: optionalEnvString()
});

describe("parseEnv", () => {
  it("returns typed values when the env is valid", () => {
    const env = parseEnv(schema, { PROJECT_ID: "demo-x", PORT: "8080", USE_EMULATORS: "true", OPTIONAL_TOKEN: " abc " });
    expect(env).toEqual({ PROJECT_ID: "demo-x", PORT: "8080", USE_EMULATORS: true, OPTIONAL_TOKEN: "abc" });
  });

  it("treats a missing flag as false and a blank optional string as unset", () => {
    const env = parseEnv(schema, { PROJECT_ID: "demo-x", PORT: "1", OPTIONAL_TOKEN: "  " });
    expect(env.USE_EMULATORS).toBe(false);
    expect(env.OPTIONAL_TOKEN).toBeUndefined();
  });

  it("names each missing variable and points to the example file", () => {
    try {
      parseEnv(schema, { PORT: "abc" }, { exampleFile: ".env.example" });
      expect.unreachable("parseEnv should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      const envError = error as EnvValidationError;
      expect(envError.issues).toEqual([
        { variable: "PROJECT_ID", problem: "missing" },
        { variable: "PORT", problem: "must be a number" }
      ]);
      expect(envError.message).toContain("PROJECT_ID: missing");
      expect(envError.message).toContain("copy .env.example to .env.local");
    }
  });

  it("reports an empty string as missing", () => {
    expect(() => parseEnv(schema, { PROJECT_ID: "", PORT: "1" })).toThrow(/PROJECT_ID: missing/);
  });

  it("rejects a flag that is not true or false", () => {
    expect(() => parseEnv(schema, { PROJECT_ID: "x", PORT: "1", USE_EMULATORS: "yes" })).toThrow(/USE_EMULATORS/);
  });

  it("labels root-level failures", () => {
    expect(() => parseEnv(z.string(), {})).toThrow(/\(root\)/);
  });
});

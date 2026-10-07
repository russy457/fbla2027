/**
 * env.ts
 * Helper for validating environment variables with zod (plan X4). Used by
 * src/lib/env.ts for the web app's VITE_* values and available to Functions.
 * On failure it throws one readable error that names every missing or invalid
 * variable and says where the safe defaults live, instead of a stack trace
 * from deep inside the Firebase SDK.
 */
import { z } from "zod";

export type EnvRecord = Readonly<Record<string, unknown>>;

export interface EnvIssue {
  readonly variable: string;
  readonly problem: string;
}

export class EnvValidationError extends Error {
  readonly issues: readonly EnvIssue[];

  constructor(issues: readonly EnvIssue[], exampleFile: string) {
    const lines = issues.map((issue) => `  - ${issue.variable}: ${issue.problem}`);
    super(
      [
        "Environment configuration is incomplete:",
        ...lines,
        `Fix: copy ${exampleFile} to .env.local (it has working local defaults), then restart the dev server.`
      ].join("\n")
    );
    this.name = "EnvValidationError";
    this.issues = issues;
  }
}

export interface ParseEnvOptions {
  /** File that documents every variable. Mentioned in the error message. */
  readonly exampleFile?: string;
}

const describeIssue = (issue: z.core.$ZodIssue, source: EnvRecord): EnvIssue => {
  const variable = issue.path.map(String).join(".") || "(root)";
  const missing = source[variable] === undefined || source[variable] === "";
  return { variable, problem: missing ? "missing" : issue.message };
};

/** Validates `source` against `schema` and returns the typed result, or throws EnvValidationError. */
export const parseEnv = <Schema extends z.ZodType>(
  schema: Schema,
  source: EnvRecord,
  options: ParseEnvOptions = {}
): z.output<Schema> => {
  const result = schema.safeParse(source);
  if (result.success) return result.data;
  const issues = result.error.issues.map((issue) => describeIssue(issue, source));
  throw new EnvValidationError(issues, options.exampleFile ?? ".env.example");
};

/** "true"/"false" string flag (env vars are always strings). Missing means false. */
export const envFlag = () =>
  z
    .enum(["true", "false"], { message: 'must be "true" or "false"' })
    .optional()
    .transform((value) => value === "true");

/** Optional string where an empty value counts as "not set". */
export const optionalEnvString = () =>
  z
    .string()
    .optional()
    .transform((value) => (value === undefined || value.trim() === "" ? undefined : value.trim()));

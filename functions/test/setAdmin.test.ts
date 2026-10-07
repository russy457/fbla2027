/**
 * setAdmin.test.ts
 * scripts/set-admin.mjs, the first-admin bootstrap (docs/DEMO.md 1.4), run as
 * a child process against the Auth emulator that `npm run test:functions`
 * starts (FIREBASE_AUTH_EMULATOR_HOST is inherited). Never runs against a
 * real project: every case either uses the emulator or exits before the
 * Admin SDK is created.
 */
import { execFile } from "node:child_process";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { PROJECT_ID, auth, resetEmulators } from "./harness";

// Vitest runs from the repo root (npm run test:functions).
const SCRIPT = join(process.cwd(), "scripts", "set-admin.mjs");
const EMAIL = "ada@example.test";

interface RunResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

const run = (args: readonly string[], env: NodeJS.ProcessEnv = process.env): Promise<RunResult> =>
  new Promise((resolve) => {
    execFile(process.execPath, [SCRIPT, ...args], { env, timeout: 30_000 }, (error, stdout, stderr) => {
      const code = error === null ? 0 : typeof error.code === "number" ? error.code : 1;
      resolve({ code, stdout, stderr });
    });
  });

const claimsOf = async (uid: string) => (await auth.getUser(uid)).customClaims ?? {};

beforeEach(async () => {
  await resetEmulators();
});

describe("scripts/set-admin.mjs", () => {
  it("refuses to run without --project, and with a malformed project or email", async () => {
    const noProject = await run(["--email", EMAIL, "--yes"]);
    expect(noProject.code).toBe(1);
    expect(noProject.stderr).toContain("--project <id> is required");
    expect((await run(["--project", "Bad Project!", "--email", EMAIL, "--yes"])).code).toBe(1);
    expect((await run(["--project", PROJECT_ID, "--email", "not-an-email", "--yes"])).code).toBe(1);
    expect((await run(["--project", PROJECT_ID, "--email", EMAIL, "--force"])).stderr).toContain("unknown option --force");
  });

  it("prints the plan and changes nothing without --yes", async () => {
    const account = await auth.createUser({ email: EMAIL, password: "pitchin-demo-2027" });
    const result = await run(["--project", PROJECT_ID, "--email", EMAIL]);
    expect(result.code).toBe(2);
    expect(result.stdout).toContain(`{ admin: true } on ${EMAIL}`);
    expect(result.stdout).toContain("Auth emulator");
    expect(result.stderr).toContain("re-run with --yes");
    expect(await claimsOf(account.uid)).toEqual({});
  });

  it("sets admin with --yes and keeps the account's other claims", async () => {
    const account = await auth.createUser({ email: EMAIL, password: "pitchin-demo-2027" });
    await auth.setCustomUserClaims(account.uid, { team: "blue" });
    const result = await run([`--project=${PROJECT_ID}`, "--email", EMAIL.toUpperCase(), "--yes"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain(`uid ${account.uid}`);
    expect(await claimsOf(account.uid)).toEqual({ team: "blue", admin: true });
  });

  it("fails clearly when no account uses the email", async () => {
    const result = await run(["--project", PROJECT_ID, "--email", EMAIL, "--yes"]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain(`no account uses ${EMAIL}`);
  });

  it("refuses a demo- project when no Auth emulator is set, before touching anything", async () => {
    const env = { ...process.env };
    delete env.FIREBASE_AUTH_EMULATOR_HOST;
    const result = await run(["--project", PROJECT_ID, "--email", EMAIL, "--yes"], env);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("exists only in the emulators");
  });
});

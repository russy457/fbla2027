#!/usr/bin/env node
/**
 * set-admin.mjs
 * First-admin bootstrap (docs/DEMO.md 1.4): sets the `admin: true` custom
 * claim on one Firebase Auth account with the Admin SDK. Other custom claims
 * on the account are kept.
 *
 * Safety rails:
 *   - `--project <id>` is required; there is no default project.
 *   - Nothing is read or written until `--yes` is passed: without it the
 *     script only prints what it would do and exits with code 2.
 *   - With FIREBASE_AUTH_EMULATOR_HOST set, the Admin SDK talks to that Auth
 *     emulator only (any project id, usually demo-fbla2027).
 *   - Without it, the real project is reached with Application Default
 *     Credentials (`gcloud auth application-default login`), and `demo-`
 *     project ids are refused (they exist only in the emulators).
 *
 * Usage:
 *   node scripts/set-admin.mjs --project <projectId> --email <email> [--yes]
 *
 * The person must sign out and back in (or wait up to an hour) before the new
 * claim is on their ID token.
 */
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const EXIT_USAGE = 1;
const EXIT_NOT_CONFIRMED = 2;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PROJECT_ID_PATTERN = /^[a-z][a-z0-9-]{4,29}$/;

const USAGE = "Usage: node scripts/set-admin.mjs --project <projectId> --email <email> [--yes]";

const fail = (problem, fix, code = EXIT_USAGE) => {
  console.error(`set-admin: ${problem}\nFix: ${fix}`);
  process.exit(code);
};

/** Reads `--name value` or `--name=value`; null when absent. */
const readOption = (argv, name) => {
  const index = argv.findIndex((arg) => arg === `--${name}` || arg.startsWith(`--${name}=`));
  if (index === -1) return null;
  const arg = argv[index];
  const value = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : argv[index + 1];
  return typeof value === "string" && !value.startsWith("--") ? value.trim() : "";
};

const KNOWN_FLAGS = new Set(["--project", "--email", "--yes"]);

const parseArgs = (argv) => {
  const unknown = argv.filter((arg) => arg.startsWith("--") && !KNOWN_FLAGS.has(arg.split("=")[0]));
  if (unknown.length > 0) fail(`unknown option ${unknown.join(", ")}`, USAGE);
  const projectId = readOption(argv, "project");
  const email = readOption(argv, "email");
  if (!projectId) fail("--project <id> is required (there is no default project)", USAGE);
  if (!PROJECT_ID_PATTERN.test(projectId)) fail(`"${projectId}" is not a Firebase project id`, "pass the id shown in the Firebase console, for example fbla2027-demo");
  if (!email) fail("--email <email> is required", USAGE);
  if (!EMAIL_PATTERN.test(email)) fail(`"${email}" is not an email address`, USAGE);
  return { projectId, email: email.toLowerCase(), confirmed: argv.includes("--yes") };
};

const main = async () => {
  const { projectId, email, confirmed } = parseArgs(process.argv.slice(2));
  const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST?.trim() || null;
  if (emulatorHost === null && projectId.startsWith("demo-")) {
    fail(`"${projectId}" is a demo project, which exists only in the emulators`, "start the Auth emulator and set FIREBASE_AUTH_EMULATOR_HOST, or pass a real project id");
  }

  const target = emulatorHost === null ? `the LIVE project "${projectId}" (Application Default Credentials)` : `the Auth emulator at ${emulatorHost} (project "${projectId}")`;
  console.log(`set-admin will set the custom claim { admin: true } on ${email} in ${target}. Other claims on the account are kept.`);
  if (!confirmed) fail("not confirmed, nothing was changed", "re-run with --yes to apply it", EXIT_NOT_CONFIRMED);

  // With FIREBASE_AUTH_EMULATOR_HOST set, the Admin SDK sends every Auth call to the emulator and needs no credentials.
  const app = initializeApp(emulatorHost === null ? { projectId, credential: applicationDefault() } : { projectId }, "set-admin");
  const auth = getAuth(app);
  let account;
  try {
    account = await auth.getUserByEmail(email);
  } catch (error) {
    if (error?.code === "auth/user-not-found") fail(`no account uses ${email} in ${target}`, "create it in Authentication first (docs/DEMO.md 1.4 step 1)");
    throw error;
  }
  const claims = { ...(account.customClaims ?? {}), admin: true };
  await auth.setCustomUserClaims(account.uid, claims);
  console.log(`Done: ${email} (uid ${account.uid}) now has { admin: true }. They must sign out and back in before /admin works.`);
};

main().catch((error) => {
  console.error(`set-admin: failed: ${error?.message ?? error}`);
  process.exit(EXIT_USAGE);
});

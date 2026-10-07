#!/usr/bin/env node
/**
 * doctor.mjs
 * Checks a laptop is ready to run the app locally (plan X3). Every failed
 * check prints the problem, the likely cause, and the fix. Hard failures
 * (wrong Node, no Java, busy ports, incomplete .env.local, missing deps) exit
 * with code 1; warnings (old Java, OneDrive folder, no .env.local yet) do not.
 *
 * Usage: npm run doctor            (add --fix-env to copy .env.example to .env.local)
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REQUIRED_NODE_MAJOR = 22;
const RECOMMENDED_JAVA_MAJOR = 21;
const PORTS = [
  { port: 9099, name: "Auth emulator" },
  { port: 8080, name: "Firestore emulator" },
  { port: 5001, name: "Functions emulator" },
  { port: 9199, name: "Storage emulator" },
  { port: 4000, name: "Emulator UI" },
  { port: 5173, name: "Vite dev server" }
];

/** Must stay in sync with clientEnvSchema in src/lib/env.ts (required keys only). */
const REQUIRED_ENV_KEYS = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_APP_ID"
];

const results = [];
const pass = (label) => results.push({ level: "ok", label });
const warn = (label, problem, cause, fix) => results.push({ level: "warn", label, problem, cause, fix });
const failCheck = (label, problem, cause, fix) => results.push({ level: "fail", label, problem, cause, fix });

const checkNode = () => {
  const major = Number(process.versions.node.split(".")[0]);
  if (major === REQUIRED_NODE_MAJOR) return pass(`Node ${process.versions.node}`);
  failCheck(
    "Node version",
    `Node ${process.versions.node} is installed; this repo needs Node ${REQUIRED_NODE_MAJOR}.`,
    "Cloud Functions run on Node 22, so local builds and tests must match it.",
    `Install Node ${REQUIRED_NODE_MAJOR} (nvm use, or nvm-windows: nvm install 22 && nvm use 22). .nvmrc pins the version.`
  );
};

const checkJava = () => {
  const result = spawnSync("java -version", { encoding: "utf8", shell: true });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const match = /version "(\d+)(?:\.(\d+))?/.exec(output);
  if (result.status !== 0 || !match) {
    return failCheck(
      "Java",
      "Java was not found.",
      "The Firestore, Auth, and Storage emulators run on the Java runtime.",
      `Install a JDK ${RECOMMENDED_JAVA_MAJOR}+ (for example Microsoft OpenJDK or Temurin), then open a new terminal.`
    );
  }
  const major = Number(match[1] === "1" ? match[2] : match[1]);
  if (major >= RECOMMENDED_JAVA_MAJOR) return pass(`Java ${major}`);
  warn(
    "Java version",
    `Java ${major} is installed.`,
    "Recent firebase-tools versions expect JDK 21 or newer.",
    `Install JDK ${RECOMMENDED_JAVA_MAJOR}+ if the emulators refuse to start.`
  );
};

const isPortFree = (port) =>
  new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "127.0.0.1");
  });

const checkPorts = async () => {
  for (const { port, name } of PORTS) {
    if (await isPortFree(port)) continue;
    failCheck(
      `Port ${port}`,
      `Port ${port} (${name}) is already in use.`,
      "Another emulator, dev server, or app is still running.",
      process.platform === "win32"
        ? `Find it with: netstat -ano | findstr :${port}  then stop it in Task Manager (or close the old terminal).`
        : `Find it with: lsof -i :${port}  then stop that process.`
    );
  }
  if (!results.some((result) => result.label.startsWith("Port "))) pass(`Ports ${PORTS.map((p) => p.port).join(", ")} free`);
};

const readEnvFile = (path) =>
  Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1).trim()])
  );

const checkEnvValues = (path) => {
  const values = readEnvFile(path);
  const missing = REQUIRED_ENV_KEYS.filter((key) => !values[key]);
  if (missing.length === 0) return pass(".env.local present and complete");
  failCheck(
    ".env.local",
    `.env.local is missing: ${missing.join(", ")}.`,
    "The web app cannot configure Firebase without these values.",
    "Copy the lines from .env.example (its values work locally with zero edits)."
  );
};

const checkEnvFile = () => {
  const envLocal = join(ROOT, ".env.local");
  if (existsSync(envLocal)) return checkEnvValues(envLocal);
  if (process.argv.includes("--fix-env")) {
    copyFileSync(join(ROOT, ".env.example"), envLocal);
    return pass(".env.local created from .env.example");
  }
  warn(
    ".env.local",
    ".env.local is missing.",
    "The web app reads Firebase settings from it; .env.example has safe local defaults.",
    "Run: npm run doctor -- --fix-env   (or PowerShell: copy .env.example .env.local)"
  );
};

const checkWorkspaces = () => {
  const missing = ["vite", "firebase-tools", "firebase-functions", "zod", "esbuild"].filter(
    (name) => !existsSync(join(ROOT, "node_modules", name, "package.json"))
  );
  if (missing.length === 0) return pass("Workspace dependencies installed");
  failCheck(
    "Dependencies",
    `Missing packages: ${missing.join(", ")}.`,
    "npm ci has not been run (or was interrupted).",
    "Run: npm ci   (from the repo root; it installs shared/ and functions/ too)"
  );
};

const checkOneDrive = () => {
  if (!/onedrive/i.test(ROOT)) return pass("Repo is outside OneDrive");
  warn(
    "Folder location",
    `The repo is inside a OneDrive folder (${ROOT}).`,
    "OneDrive syncing node_modules and emulator files causes slow installs and locked-file errors.",
    "Move the repo to a non-synced folder such as C:\\dev\\fbla2027, then run npm ci again."
  );
};

const print = () => {
  const icon = { ok: "PASS", warn: "WARN", fail: "FAIL" };
  for (const result of results) {
    console.log(`[${icon[result.level]}] ${result.label}`);
    if (result.level !== "ok") {
      console.log(`       Problem: ${result.problem}`);
      console.log(`       Cause:   ${result.cause}`);
      console.log(`       Fix:     ${result.fix}`);
    }
  }
  const failures = results.filter((result) => result.level === "fail").length;
  const warnings = results.filter((result) => result.level === "warn").length;
  console.log(`\ndoctor: ${failures} failure(s), ${warnings} warning(s).`);
  return failures;
};

checkNode();
checkJava();
await checkPorts();
checkEnvFile();
checkWorkspaces();
checkOneDrive();
process.exit(print() > 0 ? 1 : 0);

#!/usr/bin/env node
/** Restart only this repository's local listeners, then run the full demo stack in one terminal. */
import { spawn, spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = realpathSync(join(dirname(fileURLToPath(import.meta.url)), ".."));
const PORTS = [5173, 9099, 8080, 5001, 9199, 4000];
const dryRun = process.argv.includes("--dry-run");
const skipVerify = process.argv.includes("--skip-verify");

const lsof = (args) => spawnSync("lsof", args, { encoding: "utf8" });
const listeners = () => {
  const found = new Map();
  for (const port of PORTS) {
    const result = lsof(["-nP", "-t", `-iTCP:${port}`, "-sTCP:LISTEN"]);
    if (result.error) throw result.error;
    for (const line of (result.stdout ?? "").split(/\r?\n/)) {
      const pid = Number(line.trim());
      if (Number.isInteger(pid) && pid > 0) found.set(pid, [...(found.get(pid) ?? []), port]);
    }
  }
  return found;
};

const cwdFor = (pid) => {
  const result = lsof(["-a", "-p", String(pid), "-d", "cwd", "-Fn"]);
  const path = (result.stdout ?? "").split(/\r?\n/).find((line) => line.startsWith("n"))?.slice(1);
  if (!path) return null;
  try { return realpathSync(path); } catch { return null; }
};

const belongsToProject = (path) => path === ROOT || path?.startsWith(`${ROOT}${sep}`);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const verifySignup = () => new Promise((resolve, reject) => {
  const child = spawn("npm", ["run", "verify:signup"], { cwd: ROOT, stdio: "inherit" });
  child.on("error", reject);
  child.on("exit", (code) => code === 0 ? resolve() : reject(new Error("Signup verification failed. See the error above.")));
});

try {
  const found = listeners();
  const foreign = [...found].filter(([pid]) => !belongsToProject(cwdFor(pid)));
  if (foreign.length > 0) {
    for (const [pid, ports] of foreign) console.error(`demo:restart: port ${ports.join(", ")} belongs to PID ${pid} outside this project.`);
    console.error("Close that app first; this command only stops processes from the fbla 2027 directory.");
    process.exit(1);
  }

  if (found.size === 0) console.log("demo:restart: no old project servers found.");
  for (const [pid, ports] of found) console.log(`demo:restart: ${dryRun ? "would stop" : "stopping"} PID ${pid} on ${ports.join(", ")}`);
  if (dryRun) process.exit(0);

  for (const pid of found.keys()) process.kill(pid, "SIGTERM");
  for (let attempt = 0; attempt < 40 && listeners().size > 0; attempt += 1) await pause(250);
  const stillListening = listeners();
  if (stillListening.size > 0) {
    for (const [pid] of stillListening) {
      if (found.has(pid) && belongsToProject(cwdFor(pid))) process.kill(pid, "SIGKILL");
    }
    await pause(250);
  }
  if (listeners().size > 0) throw new Error("A project server is still using a demo port. Close its terminal and try again.");

  if (!skipVerify) {
    console.log("demo:restart: checking Auth -> Functions -> Firestore in isolated emulators.");
    await verifySignup();
  }
  console.log("demo:restart: starting Auth, Firestore, Functions, Storage, seed data, and Vite together.");
  const child = spawn("npm", ["run", "demo"], { cwd: ROOT, stdio: "inherit" });
  child.on("error", (error) => { console.error(`demo:restart: ${error.message}`); process.exitCode = 1; });
  child.on("exit", (code) => { process.exitCode = code ?? 1; });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`demo:restart: ${message}`);
  if (error instanceof Error && "code" in error && error.code === "EPERM") {
    console.error("This tool is blocked from stopping your local processes. Run npm run demo:restart in your own Terminal window.");
  }
  process.exitCode = 1;
}

/**
 * deps.ts
 * Everything an op, trigger, or job touches outside its own code: Firestore,
 * Auth, Storage, the environment, the time source, and the logger. Production
 * code gets the real Admin SDK objects from defaultDeps(); emulator tests pass
 * their own deps with a controllable time source, which is how check-in
 * windows and finalize timing are tested without waiting (SPEC#tests 12.3).
 */
import { getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";
import * as logger from "firebase-functions/logger";
import { createClock } from "@fbla/shared";
import { readFunctionsEnv, type FunctionsEnv } from "./env";

export type LogFields = Readonly<Record<string, unknown>>;

export interface Logger {
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
}

export interface ServerDeps {
  readonly db: Firestore;
  readonly auth: Auth;
  readonly storage: Storage;
  readonly env: FunctionsEnv;
  /** Real time in epoch ms, before any demo offset. Tests replace it. */
  readonly nowMs: () => number;
  readonly log: Logger;
}

const functionsLogger: Logger = {
  info: (message, fields) => logger.info(message, fields),
  warn: (message, fields) => logger.warn(message, fields),
  error: (message, fields) => logger.error(message, fields)
};

/** Initializes the default Admin app once; reuses it on warm starts. */
export const adminApp = (projectId?: string): App =>
  getApps()[0] ?? initializeApp(projectId ? { projectId } : undefined);

let cachedDeps: ServerDeps | undefined;

/** The production deps, created lazily so importing a module never touches the network. */
export const defaultDeps = (): ServerDeps => {
  if (cachedDeps) return cachedDeps;
  const env = readFunctionsEnv(process.env);
  const app = adminApp(env.projectId);
  const wallClock = createClock();
  cachedDeps = {
    db: getFirestore(app),
    auth: getAuth(app),
    storage: getStorage(app),
    env,
    nowMs: wallClock.nowMs,
    log: functionsLogger
  };
  return cachedDeps;
};

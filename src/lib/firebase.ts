/**
 * firebase.ts
 * Creates the Firebase web SDK services (Auth, Firestore, Functions, Storage)
 * from validated VITE_* env values. Nothing here names a real project: local
 * development uses the "demo-fbla2027" project id with the Emulator Suite.
 *
 * - Services are created lazily on first use, so a missing .env.local shows a
 *   friendly message (DevEnvironmentBanner) instead of crashing the shell.
 * - VITE_USE_EMULATORS=true connects every service to the local emulators.
 * - App Check starts only when VITE_APPCHECK_SITE_KEY is set; in dev the
 *   debug provider is enabled (X11) with VITE_APPCHECK_DEBUG_TOKEN if given.
 * - Emulator ports and the dev reachability probe live in emulatorProbe.ts,
 *   which does not import the SDK, so the app shell stays small.
 */
import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { connectAuthEmulator, getAuth, inMemoryPersistence, initializeAuth, signOut, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, type Functions } from "firebase/functions";
import { connectStorageEmulator, getStorage, type FirebaseStorage } from "firebase/storage";
import { EMULATOR_PORTS, getEmulatorHost } from "./emulatorProbe";
import { parseClientEnv, type ClientEnv } from "./env";

export { EMULATOR_PORTS, probeEmulators, type EmulatorProbeResult } from "./emulatorProbe";

export interface FirebaseServices {
  readonly app: FirebaseApp;
  readonly auth: Auth;
  readonly db: Firestore;
  readonly functions: Functions;
  readonly storage: FirebaseStorage;
  readonly usingEmulators: boolean;
}

type AppCheckDebugGlobal = typeof globalThis & { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean };

const startAppCheck = (app: FirebaseApp, env: ClientEnv): void => {
  if (!env.VITE_APPCHECK_SITE_KEY) return;
  if (import.meta.env.DEV) {
    // Debug provider: prints a token to register in the console, or uses the given one.
    (globalThis as AppCheckDebugGlobal).FIREBASE_APPCHECK_DEBUG_TOKEN = env.VITE_APPCHECK_DEBUG_TOKEN ?? true;
  }
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(env.VITE_APPCHECK_SITE_KEY),
    isTokenAutoRefreshEnabled: true
  });
};

const createServices = (env: ClientEnv): FirebaseServices => {
  const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    appId: env.VITE_FIREBASE_APP_ID
  });
  startAppCheck(app, env);

  const auth = getAuth(app);
  const db = getFirestore(app);
  const functions = getFunctions(app);
  const storage = getStorage(app);

  if (env.VITE_USE_EMULATORS) {
    const host = getEmulatorHost();
    connectAuthEmulator(auth, `http://${host}:${EMULATOR_PORTS.auth}`, { disableWarnings: true });
    connectFirestoreEmulator(db, host, EMULATOR_PORTS.firestore);
    connectFunctionsEmulator(functions, host, EMULATOR_PORTS.functions);
    connectStorageEmulator(storage, host, EMULATOR_PORTS.storage);
  } else {
    const host = getEmulatorHost();
    if (env.VITE_FUNCTIONS_EMULATOR) connectFunctionsEmulator(functions, host, EMULATOR_PORTS.functions);
    if (env.VITE_STORAGE_EMULATOR) connectStorageEmulator(storage, host, EMULATOR_PORTS.storage);
  }

  return Object.freeze({ app, auth, db, functions, storage, usingEmulators: env.VITE_USE_EMULATORS });
};

let services: FirebaseServices | null = null;

/** Returns the shared Firebase services, creating them on first call. Throws EnvValidationError if env is incomplete. */
export const getFirebase = (): FirebaseServices => {
  services ??= createServices(parseClientEnv(import.meta.env));
  return services;
};

export interface IsolatedServices {
  readonly auth: Auth;
  readonly db: Firestore;
  /** Signs out and deletes the throwaway app. */
  readonly dispose: () => Promise<void>;
}

let isolatedCount = 0;

/**
 * A short-lived second Firebase app with in-memory Auth, for checking a
 * person's credentials without touching this device's current session (the
 * kiosk exit check, G15). Same config, App Check, and emulator wiring as the
 * main app; nothing it signs in is persisted.
 */
export const createIsolatedServices = (): IsolatedServices => {
  const main = getFirebase();
  const env = parseClientEnv(import.meta.env);
  isolatedCount += 1;
  const app = initializeApp(main.app.options, `isolated-${isolatedCount}`);
  startAppCheck(app, env);
  const auth = initializeAuth(app, { persistence: inMemoryPersistence });
  const db = getFirestore(app);
  if (main.usingEmulators) {
    const host = getEmulatorHost();
    connectAuthEmulator(auth, `http://${host}:${EMULATOR_PORTS.auth}`, { disableWarnings: true });
    connectFirestoreEmulator(db, host, EMULATOR_PORTS.firestore);
  }
  return Object.freeze({
    auth,
    db,
    dispose: async () => {
      await signOut(auth).catch(() => undefined);
      await deleteApp(app);
    }
  });
};

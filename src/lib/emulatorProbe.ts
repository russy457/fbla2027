/**
 * emulatorProbe.ts
 * Emulator ports and a reachability check used by the development banner
 * (plan X10: "Emulators not reachable on :8080, run npm run demo"). Kept
 * separate from firebase.ts so the banner does not pull the Firebase SDK
 * into the app shell bundle. firebase.ts re-exports probeEmulators.
 */

/** Reads an optional VITE_EMULATOR_*_PORT override; anything that is not a valid port is ignored. */
const portOverride = (name: string, fallback: number): number => {
  const raw = (import.meta.env as Record<string, unknown>)[name];
  const port = typeof raw === "string" ? Number(raw) : Number.NaN;
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : fallback;
};

/**
 * Must match the "emulators" block in firebase.json. The Tier 0 e2e runs its
 * own emulators on other ports (firebase.e2e.json) and passes them in with
 * VITE_EMULATOR_AUTH_PORT, _FIRESTORE_PORT, _FUNCTIONS_PORT, _STORAGE_PORT.
 */
export const EMULATOR_PORTS = Object.freeze({
  auth: portOverride("VITE_EMULATOR_AUTH_PORT", 9099),
  firestore: portOverride("VITE_EMULATOR_FIRESTORE_PORT", 8080),
  functions: portOverride("VITE_EMULATOR_FUNCTIONS_PORT", 5001),
  storage: portOverride("VITE_EMULATOR_STORAGE_PORT", 9199)
});

export type EmulatorService = keyof typeof EMULATOR_PORTS;

/** Host the emulators listen on. Uses the page's host so a phone on the same network also works. */
export const getEmulatorHost = (): string =>
  typeof window !== "undefined" && window.location.hostname ? window.location.hostname : "127.0.0.1";

export interface EmulatorProbeResult {
  readonly reachable: boolean;
  readonly unreachable: ReadonlyArray<{ readonly service: EmulatorService; readonly port: number }>;
}

export interface ProbeOptions {
  readonly host?: string;
  readonly timeoutMs?: number;
  readonly fetchImpl?: typeof fetch;
}

const DEFAULT_PROBE_TIMEOUT_MS = 1500;

const isPortAnswering = async (url: string, fetchImpl: typeof fetch, timeoutMs: number): Promise<boolean> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // no-cors: any HTTP answer (even opaque) proves the emulator is listening.
    await fetchImpl(url, { mode: "no-cors", signal: controller.signal, cache: "no-store" });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
};

/** Checks every emulator port in parallel. Used only in development. */
export const probeEmulators = async (options: ProbeOptions = {}): Promise<EmulatorProbeResult> => {
  const host = options.host ?? getEmulatorHost();
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
  const entries = Object.entries(EMULATOR_PORTS) as Array<[EmulatorService, number]>;
  const results = await Promise.all(
    entries.map(async ([service, port]) => ({
      service,
      port,
      ok: await isPortAnswering(`http://${host}:${port}/`, fetchImpl, timeoutMs)
    }))
  );
  const unreachable = results.filter((result) => !result.ok).map(({ service, port }) => ({ service, port }));
  return { reachable: unreachable.length === 0, unreachable };
};

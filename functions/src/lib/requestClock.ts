/**
 * requestClock.ts
 * Builds the clock one invocation uses (SPEC#clock, G6). In demo mode the
 * offset from demoClock/global is added so "Advance clock 15 min" moves every
 * window check, kiosk code, and stored timestamp together. The offset is
 * cached for 5 seconds per Firestore instance to avoid a read on every call.
 * Outside demo mode the document is never read, so a stray doc in a real
 * project cannot shift time.
 */
import type { Firestore } from "firebase-admin/firestore";
import { PATHS, createClock, type Clock } from "@fbla/shared";
import type { ServerDeps } from "./deps";

const CACHE_MS = 5_000;

interface CachedOffset {
  readonly offsetMs: number;
  readonly fetchedAtMs: number;
}

const offsetCache = new WeakMap<Firestore, CachedOffset>();

/** Drops the cached offset (setDemoClock calls this so its own next call sees the change). */
export const forgetDemoOffset = (db: Firestore): void => {
  offsetCache.delete(db);
};

export const readDemoOffsetMs = async (deps: ServerDeps): Promise<number> => {
  if (!deps.env.demoClockAllowed) return 0;
  const realNow = deps.nowMs();
  const cached = offsetCache.get(deps.db);
  if (cached && realNow - cached.fetchedAtMs < CACHE_MS) return cached.offsetMs;
  const snapshot = await deps.db.doc(PATHS.demoClock()).get();
  const raw: unknown = snapshot.get("offsetMs");
  const offsetMs = typeof raw === "number" && Number.isFinite(raw) ? Math.trunc(raw) : 0;
  offsetCache.set(deps.db, { offsetMs, fetchedAtMs: realNow });
  return offsetMs;
};

/** The clock for one request, job run, or trigger execution. */
export const requestClock = async (deps: ServerDeps): Promise<Clock> =>
  createClock({ baseNowMs: deps.nowMs, offsetMs: await readDemoOffsetMs(deps) });

/**
 * requestClock.ts
 * Builds the clock one invocation uses (SPEC#clock, G6). In demo mode the
 * offset from demoClock/global is added so "Advance clock 15 min" moves every
 * window check, kiosk code, and stored timestamp together.
 *
 * The offset is read fresh on every request while the demo clock is allowed.
 * An earlier per-instance cache let two Functions instances disagree for a few
 * seconds after setDemoClock (one at +15 min, another at +30), which credited
 * the wrong minutes at check-out. One small read per call is cheap next to
 * that. Outside demo mode the document is never read and the offset is always
 * 0, so a stray doc in a real project cannot shift time.
 */
import type { DocumentSnapshot } from "firebase-admin/firestore";
import { PATHS, createClock, type Clock } from "@fbla/shared";
import type { ServerDeps } from "./deps";

/** Parses the stored offset; anything missing or malformed means no offset. */
export const offsetFromSnapshot = (snapshot: DocumentSnapshot): number => {
  const raw: unknown = snapshot.get("offsetMs");
  return typeof raw === "number" && Number.isFinite(raw) ? Math.trunc(raw) : 0;
};

/** The authoritative demo offset for this request (always 0 when the demo clock is not allowed). */
export const readDemoOffsetMs = async (deps: ServerDeps): Promise<number> => {
  if (!deps.env.demoClockAllowed) return 0;
  return offsetFromSnapshot(await deps.db.doc(PATHS.demoClock()).get());
};

/** The clock for one request, job run, or trigger execution. */
export const requestClock = async (deps: ServerDeps): Promise<Clock> =>
  createClock({ baseNowMs: deps.nowMs, offsetMs: await readDemoOffsetMs(deps) });

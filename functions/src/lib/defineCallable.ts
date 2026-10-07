/**
 * defineCallable.ts
 * The one wrapper every callable op goes through (SPEC#definecallable, X8, G2).
 *
 *   defineCallable({ endpoint, op, auth, rateLimit?, handler })  declares one op;
 *     its input/output schemas come from the shared op map, so the server and
 *     the client can never disagree about a field.
 *   createEndpointHandler(endpoint, ops)  dispatches { op, ...input } to the op.
 *   defineEndpoint(endpoint, ops)          wraps that in a deployable onCall.
 *
 * For every call, in order (SPEC 4.4):
 *   1. App Check (onCall option, only when APPCHECK_ENFORCE=true),
 *   2. envelope + op lookup, then auth present (AUTH_REQUIRED),
 *   3. kiosk tokens: expired -> KIOSK_SESSION_EXPIRED,
 *   4. input schema (INVALID_INPUT naming the fields); parsed before the
 *      resource checks because resolvers need the ids it contains,
 *   5. kiosk scoping: a kiosk token works only on an op that accepts kiosk
 *      tokens and only for the instance in its claims,
 *   6. profile gate (PROFILE_INCOMPLETE, G11),
 *   7. resource resolution and role check (auth mode),
 *   8. rate limit,
 *   9. handler, then output schema check (a mismatch is a server bug -> INTERNAL),
 *  10. one structured log line {fn, uid, orgId, instanceId, outcome, code, ms, requestId}.
 * Errors leave as HttpsError with details {code, params, requestId, fix, helpSlug};
 * anything that is not an AppError becomes INTERNAL so no stack trace or
 * internal message reaches the browser.
 */
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import type { z } from "zod";
import { HttpsError, onCall, type CallableOptions } from "firebase-functions/v2/https";
import {
  AppError,
  OPS,
  OP_NAMES,
  PATHS,
  describeError,
  isAppError,
  type Clock,
  type Endpoint,
  type ErrorCode,
  type ErrorParams,
  type OpName,
  type OpOutput,
  type OpParsedInput,
  type OpSuccess,
  type PrivateProfileDoc
} from "@fbla/shared";
import { readKioskClaims, type AuthMode, type Caller } from "./auth";
import { defaultDeps, type ServerDeps } from "./deps";
import { readDoc } from "./firestore";
import { consumeRateLimit, type RateLimitRule } from "./rateLimit";
import { requestClock } from "./requestClock";

export interface OpContext<I, R> {
  /** "endpoint.op", used in logs. */
  readonly fn: string;
  readonly input: I;
  readonly caller: Caller;
  /** The request clock (demo offset applied); the only source of "now" in handlers. */
  readonly clock: Clock;
  readonly deps: ServerDeps;
  readonly requestId: string;
  /** What the auth mode loaded (for example the instance), typed per mode. */
  readonly resource: R;
  readonly orgId: string | null;
  readonly instanceId: string | null;
  /** The caller's private profile when the profile gate ran, else null. */
  readonly profile: PrivateProfileDoc | null;
}

export interface CallableDefinition<E extends Endpoint, O extends OpName<E>, R> {
  readonly endpoint: E;
  readonly op: O;
  readonly auth: AuthMode<OpParsedInput<E, O>, R>;
  readonly rateLimit?: RateLimitRule;
  readonly handler: (context: OpContext<OpParsedInput<E, O>, R>) => Promise<OpOutput<E, O>>;
}

/** Type-erased op as stored in an endpoint dispatch table. */
export interface RegisteredOp {
  readonly endpoint: Endpoint;
  readonly op: string;
  readonly input: z.ZodType;
  readonly output: z.ZodType;
  readonly auth: AuthMode<unknown, unknown>;
  readonly rateLimit: RateLimitRule | undefined;
  readonly handler: (context: OpContext<unknown, unknown>) => Promise<unknown>;
}

type SchemaPair = { readonly input: z.ZodType; readonly output: z.ZodType };

/** Declares one op. Its schemas are looked up in the shared op map. */
export const defineCallable = <E extends Endpoint, O extends OpName<E>, R>(
  definition: CallableDefinition<E, O, R>
): RegisteredOp => {
  const schemas = (OPS[definition.endpoint] as Readonly<Record<string, SchemaPair>>)[definition.op];
  if (!schemas) throw new Error(`${definition.endpoint}.${definition.op} is not in the shared op map (shared/src/ops.ts)`);
  return {
    endpoint: definition.endpoint,
    op: definition.op,
    input: schemas.input,
    output: schemas.output,
    // The generic types are enforced at the definition site; the table stores them erased.
    auth: definition.auth as unknown as AuthMode<unknown, unknown>,
    rateLimit: definition.rateLimit,
    handler: definition.handler as unknown as RegisteredOp["handler"]
  };
};

/** Minimal slice of CallableRequest the wrapper needs, so tests can pass plain objects. */
export interface CallableRequestLike {
  readonly data: unknown;
  readonly auth?: { readonly uid: string; readonly token: Readonly<Record<string, unknown>> } | undefined;
  readonly rawRequest?: { readonly headers?: Readonly<Record<string, string | string[] | undefined>> } | undefined;
}

type Outcome = "ok" | "rejected" | "error";

interface CallTrace {
  op: string | null;
  uid: string | null;
  orgId: string | null;
  instanceId: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readRequestId = (request: CallableRequestLike): string => {
  const header = request.rawRequest?.headers?.["x-cloud-trace-context"];
  const trace = Array.isArray(header) ? header[0] : header;
  const traceId = trace?.split("/")[0];
  return traceId && traceId.length > 0 ? traceId : randomUUID();
};

const toHttpsError = (code: ErrorCode, params: ErrorParams, requestId: string, extra: Record<string, unknown> = {}) => {
  const described = describeError(code, code === "INTERNAL" ? { ...params, requestId } : params);
  return new HttpsError(described.httpsCode, described.message, {
    code,
    params,
    requestId,
    fix: described.fix,
    helpSlug: described.helpSlug,
    ...extra
  });
};

/** Turns a zod failure into INVALID_INPUT naming every bad field (never the values). */
class InputError extends Error {
  constructor(readonly issues: ReadonlyArray<{ path: string; message: string }>) {
    super("invalid input");
  }
}

const parseInput = (schema: z.ZodType, raw: unknown): unknown => {
  const parsed = schema.safeParse(raw);
  if (parsed.success) return parsed.data;
  throw new InputError(parsed.error.issues.map((issue) => ({ path: issue.path.map(String).join(".") || "input", message: issue.message })));
};

const buildCaller = (auth: NonNullable<CallableRequestLike["auth"]>): Caller => ({
  uid: auth.uid,
  isAdmin: auth.token.admin === true,
  email: typeof auth.token.email === "string" ? auth.token.email : null,
  emailVerified: auth.token.email_verified === true,
  kiosk: readKioskClaims(auth.token)
});

const loadProfile = async (deps: ServerDeps, uid: string): Promise<PrivateProfileDoc | null> =>
  readDoc<PrivateProfileDoc>(await deps.db.doc(PATHS.privateProfile(uid)).get());

/** Steps 3 to 9 for one resolved op. Mutates only the trace used for logging. */
const runOp = async (op: RegisteredOp, request: CallableRequestLike, rawInput: unknown, deps: ServerDeps, requestId: string, trace: CallTrace) => {
  if (!request.auth) throw new AppError("AUTH_REQUIRED");
  const caller = buildCaller(request.auth);
  trace.uid = caller.uid;
  const clock = await requestClock(deps);
  if (caller.kiosk && caller.kiosk.expMs <= clock.nowMs()) throw new AppError("KIOSK_SESSION_EXPIRED");

  const input = parseInput(op.input, rawInput);

  if (caller.kiosk && (op.auth.kioskInstanceId === undefined || op.auth.kioskInstanceId(input) !== caller.kiosk.instanceId)) {
    throw new AppError("PERMISSION_DENIED");
  }

  const gated = op.auth.requiresProfile(caller);
  const profile = gated ? await loadProfile(deps, caller.uid) : null;
  if (gated && profile?.profileComplete !== true) throw new AppError("PROFILE_INCOMPLETE");

  const authorized = await op.auth.authorize(input, { caller, db: deps.db });
  trace.orgId = authorized.orgId;
  // Ops without a resource resolver (checkIn, checkOut) still name their instance in the log.
  const inputInstanceId = isRecord(input) && typeof input.instanceId === "string" ? input.instanceId : null;
  trace.instanceId = authorized.instanceId ?? inputInstanceId;

  if (op.rateLimit) await consumeRateLimit(deps.db, caller.uid, op.rateLimit, deps.env.config, clock.nowMs());

  const result = await op.handler({
    fn: `${op.endpoint}.${op.op}`,
    input,
    caller,
    clock,
    deps,
    requestId,
    resource: authorized.resource,
    orgId: authorized.orgId,
    instanceId: authorized.instanceId,
    profile
  });
  const checked = op.output.safeParse(result);
  if (!checked.success) throw new Error(`${op.endpoint}.${op.op} returned output that does not match its schema`);
  return checked.data;
};

/** Checks a dispatch table lists exactly the ops the shared map declares for the endpoint. */
export const assertOpTable = (endpoint: Endpoint, ops: readonly RegisteredOp[]): ReadonlyMap<string, RegisteredOp> => {
  const table = new Map(ops.map((op) => [op.op, op]));
  const expected = [...OP_NAMES[endpoint]].sort();
  const actual = [...table.keys()].sort();
  const wrongEndpoint = ops.filter((op) => op.endpoint !== endpoint);
  if (wrongEndpoint.length > 0 || expected.join() !== actual.join() || table.size !== ops.length) {
    throw new Error(`${endpoint} dispatch table [${actual.join(", ")}] does not match shared OPS [${expected.join(", ")}]`);
  }
  return table;
};

/** Pure request handler (no Firebase runtime needed), used by onCall and by tests. */
export const createEndpointHandler = (endpoint: Endpoint, ops: readonly RegisteredOp[], getDeps: () => ServerDeps = defaultDeps) => {
  const table = assertOpTable(endpoint, ops);

  return async (request: CallableRequestLike): Promise<OpSuccess<unknown>> => {
    const startedAt = performance.now();
    const requestId = readRequestId(request);
    const trace: CallTrace = { op: null, uid: request.auth?.uid ?? null, orgId: null, instanceId: null };
    const deps = getDeps();

    const finish = (outcome: Outcome, code: string | null): void => {
      const entry = {
        fn: `${endpoint}.${trace.op ?? "?"}`,
        uid: trace.uid,
        orgId: trace.orgId,
        instanceId: trace.instanceId,
        outcome,
        code,
        ms: Math.round(performance.now() - startedAt),
        requestId
      };
      const message = `${entry.fn} ${outcome}`;
      if (outcome === "error") deps.log.error(message, entry);
      else if (outcome === "rejected") deps.log.warn(message, entry);
      else deps.log.info(message, entry);
    };

    try {
      if (!isRecord(request.data) || typeof request.data.op !== "string") throw new AppError("INVALID_INPUT", { fields: "op" });
      const { op: opName, ...rawInput } = request.data;
      trace.op = opName.slice(0, 64);
      // A Map has no prototype keys, so "toString" or "__proto__" can never match an op.
      const op = table.get(opName);
      if (!op) throw new AppError("UNKNOWN_OPERATION", { op: trace.op });

      const data = await runOp(op, request, rawInput, deps, requestId, trace);
      finish("ok", null);
      return { ok: true, data, requestId };
    } catch (error) {
      if (error instanceof InputError) {
        finish("rejected", "INVALID_INPUT");
        const fields = [...new Set(error.issues.map((issue) => issue.path))].join(", ");
        throw toHttpsError("INVALID_INPUT", { fields }, requestId, { issues: error.issues });
      }
      if (isAppError(error)) {
        finish("rejected", error.code);
        throw toHttpsError(error.code, error.params, requestId);
      }
      finish("error", "INTERNAL");
      deps.log.error(`${endpoint}.${trace.op ?? "?"} threw`, { requestId, error: error instanceof Error ? error.message : String(error) });
      throw toHttpsError("INTERNAL", {}, requestId);
    }
  };
};

/** Declares a deployable callable endpoint. App Check is enforced when APPCHECK_ENFORCE=true (X11). */
export const defineEndpoint = (endpoint: Endpoint, ops: readonly RegisteredOp[], options: CallableOptions = {}) =>
  onCall({ enforceAppCheck: process.env.APPCHECK_ENFORCE === "true", ...options }, createEndpointHandler(endpoint, ops));

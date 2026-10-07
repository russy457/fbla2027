/**
 * defineCallable.ts
 * The single wrapper every callable endpoint goes through (plan X8, G4).
 * Each endpoint (volunteer, coordinator, kiosk, admin, ai) receives
 * { op, input } and this wrapper:
 *   1. checks the envelope and looks up the operation by name,
 *   2. checks auth (Tier 0 stub: the caller must be signed in),
 *   3. validates the input with the operation's zod schema,
 *   4. runs the handler,
 *   5. writes one structured log line {fn, op, uid, outcome, ms, requestId},
 *   6. turns AppError (shared error catalog) into an HttpsError the client
 *      can map back to friendly copy. Unknown errors become INTERNAL so no
 *      stack trace or internal message ever reaches the browser.
 *
 * Later tiers add resource-derived authorization (G2), the profile gate (G11),
 * and rate limits here, so every operation gets them for free.
 */
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { z } from "zod";
import * as logger from "firebase-functions/logger";
import { HttpsError, onCall, type CallableOptions } from "firebase-functions/v2/https";
import { AppError, describeError, isAppError, type DescribedError } from "@fbla/shared";

/** Auth requirement for an operation. More levels (coordinator, admin) arrive with G2. */
export type OpAuth = "signedIn";

export interface OpContext {
  readonly fn: string;
  readonly op: string;
  readonly uid: string;
  readonly requestId: string;
}

export interface OpDefinition<Schema extends z.ZodType = z.ZodType, Result = unknown> {
  readonly input: Schema;
  readonly auth: OpAuth;
  readonly handler: (input: z.output<Schema>, context: OpContext) => Result | Promise<Result>;
}

/** Identity helper that keeps the handler's input type tied to its schema. */
export const defineOp = <Schema extends z.ZodType, Result>(
  definition: OpDefinition<Schema, Result>
): OpDefinition<Schema, Result> => definition;

export type CallOutcome = "ok" | "rejected" | "error";

export interface CallLogEntry {
  readonly fn: string;
  readonly op: string | null;
  readonly uid: string | null;
  readonly outcome: CallOutcome;
  readonly ms: number;
  readonly requestId: string;
  readonly errorCode?: string;
}

export type CallLogger = (entry: CallLogEntry) => void;

/** Minimal slice of CallableRequest the wrapper needs, so tests can pass plain objects. */
export interface CallableRequestLike {
  readonly data: unknown;
  readonly auth?: { readonly uid: string } | undefined;
  readonly rawRequest?: { readonly headers?: Readonly<Record<string, string | string[] | undefined>> } | undefined;
}

export interface CallableConfig {
  readonly name: string;
  readonly ops: Readonly<Record<string, OpDefinition>>;
  readonly options?: CallableOptions;
  /** Injected in tests; defaults to firebase-functions/logger. */
  readonly log?: CallLogger;
}

const envelopeSchema = z.object({
  op: z.string().min(1).max(64),
  input: z.unknown().optional()
});

const defaultLog: CallLogger = (entry) => {
  const message = `${entry.fn}.${entry.op ?? "?"} ${entry.outcome}`;
  if (entry.outcome === "error") logger.error(message, entry);
  else if (entry.outcome === "rejected") logger.warn(message, entry);
  else logger.info(message, entry);
};

const readRequestId = (request: CallableRequestLike): string => {
  const header = request.rawRequest?.headers?.["x-cloud-trace-context"];
  const trace = Array.isArray(header) ? header[0] : header;
  const traceId = trace?.split("/")[0];
  return traceId && traceId.length > 0 ? traceId : randomUUID();
};

const toHttpsError = (described: DescribedError, requestId: string, extra: Record<string, unknown> = {}): HttpsError =>
  new HttpsError(described.httpsCode, described.message, {
    code: described.code,
    fix: described.fix,
    helpSlug: described.helpSlug,
    requestId,
    ...extra
  });

const firstIssuePath = (error: z.ZodError): string =>
  error.issues[0]?.path.map(String).join(".") || "input";

/** Pure request handler (no Firebase runtime needed). Exported for unit tests. */
export const createCallableHandler = (config: CallableConfig) => {
  const log = config.log ?? defaultLog;

  return async (request: CallableRequestLike): Promise<unknown> => {
    const startedAt = performance.now();
    const requestId = readRequestId(request);
    let opName: string | null = null;
    const uid = request.auth?.uid ?? null;

    const finish = (outcome: CallOutcome, errorCode?: string): void => {
      const ms = Math.round(performance.now() - startedAt);
      log({ fn: config.name, op: opName, uid, outcome, ms, requestId, ...(errorCode ? { errorCode } : {}) });
    };

    try {
      const envelope = envelopeSchema.safeParse(request.data);
      if (!envelope.success) throw new AppError("INVALID_INPUT", { field: "op" });
      opName = envelope.data.op;

      const operation = Object.prototype.hasOwnProperty.call(config.ops, opName) ? config.ops[opName] : undefined;
      if (!operation) throw new AppError("UNKNOWN_OPERATION", { op: opName });

      if (operation.auth === "signedIn" && !uid) throw new AppError("UNAUTHENTICATED");

      const parsed = operation.input.safeParse(envelope.data.input);
      if (!parsed.success) {
        const field = firstIssuePath(parsed.error);
        finish("rejected", "INVALID_INPUT");
        throw toHttpsError(describeError("INVALID_INPUT", { field }), requestId, {
          issues: parsed.error.issues.map((issue) => ({ path: issue.path.map(String).join("."), message: issue.message }))
        });
      }

      const result = await operation.handler(parsed.data, {
        fn: config.name,
        op: opName,
        uid: uid ?? "",
        requestId
      });
      finish("ok");
      return result;
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      if (isAppError(error)) {
        finish("rejected", error.code);
        throw toHttpsError(error.describe(), requestId);
      }
      finish("error", "INTERNAL");
      logger.error(`${config.name}.${opName ?? "?"} threw`, { requestId, error: String(error) });
      throw toHttpsError(describeError("INTERNAL"), requestId);
    }
  };
};

/** Declares a deployable callable endpoint. App Check is enforced when APPCHECK_ENFORCE=true (X11). */
export const defineCallable = (config: CallableConfig) =>
  onCall(
    { enforceAppCheck: process.env.APPCHECK_ENFORCE === "true", ...config.options },
    createCallableHandler(config)
  );

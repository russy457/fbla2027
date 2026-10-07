/**
 * errors.ts
 * Turns error codes from the catalog (errorCatalog.ts, SPEC#errors) into
 * thrown errors on the server and friendly copy on the client.
 *
 *   Server: `throw new AppError("SHIFT_FULL")`. defineCallable converts it to
 *           an HttpsError whose details are {code, params, requestId, ...}.
 *   Client: `toUserError(err)` (SPEC#screen-errors) reads those details back
 *           and returns {title, message, fix, helpSlug, requestId} for the UI.
 */
import { ERROR_CATALOG, type ErrorCode, type ErrorParams, type HelpSlug, type HttpsErrorCode } from "./errorCatalog";

export { ERROR_CATALOG, HELP_SLUGS, type ErrorCatalogEntry, type ErrorCode, type ErrorParams, type HelpSlug, type HttpsErrorCode } from "./errorCatalog";

/** Plain, serializable description of an error, safe to send to the client. */
export interface DescribedError {
  readonly code: ErrorCode;
  readonly httpsCode: HttpsErrorCode;
  readonly message: string;
  readonly fix: string;
  readonly helpSlug: HelpSlug | null;
}

export const isErrorCode = (value: unknown): value is ErrorCode =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(ERROR_CATALOG, value);

export const describeError = (code: ErrorCode, params: ErrorParams = {}): DescribedError => {
  const found = ERROR_CATALOG[code];
  return {
    code,
    httpsCode: found.httpsCode,
    message: found.message(params),
    fix: found.fix,
    helpSlug: found.helpSlug
  };
};

/**
 * Error thrown by domain code. Functions convert it to an HttpsError using the
 * catalog entry; anything that is not an AppError becomes INTERNAL.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly params: ErrorParams;

  constructor(code: ErrorCode, params: ErrorParams = {}) {
    super(describeError(code, params).message);
    this.name = "AppError";
    this.code = code;
    this.params = params;
  }

  describe(): DescribedError {
    return describeError(this.code, this.params);
  }
}

export const isAppError = (value: unknown): value is AppError => value instanceof AppError;

/** What the UI shows for any failure (SPEC#screen-errors, D22). */
export interface UserError {
  readonly code: ErrorCode | null;
  readonly title: string;
  readonly message: string;
  readonly fix: string;
  readonly helpSlug: HelpSlug | null;
  readonly requestId: string | null;
  readonly params: ErrorParams;
}

/** Short heading per wire code; the catalog message carries the detail. */
const TITLES: Readonly<Record<HttpsErrorCode, string>> = {
  "invalid-argument": "Check your entry",
  unauthenticated: "Sign in needed",
  "permission-denied": "No access",
  "not-found": "Not found",
  "already-exists": "Already done",
  "failed-precondition": "Not available right now",
  "resource-exhausted": "Please wait",
  aborted: "Busy right now",
  internal: "Something went wrong"
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/** Keeps only string and number params, so untrusted details cannot inject objects into copy. */
const readParams = (value: unknown): ErrorParams =>
  isRecord(value)
    ? Object.fromEntries(
        Object.entries(value).filter((pair): pair is [string, string | number] => ["string", "number"].includes(typeof pair[1]))
      )
    : {};

const fromCode = (code: ErrorCode, params: ErrorParams, requestId: string | null): UserError => {
  const described = describeError(code, requestId === null ? params : { requestId, ...params });
  return {
    code,
    title: TITLES[described.httpsCode],
    message: described.message,
    fix: described.fix,
    helpSlug: described.helpSlug,
    requestId,
    params
  };
};

/**
 * Maps anything thrown by a callable (FirebaseError with details, AppError,
 * network failure, plain Error) to UI copy. Unknown errors become
 * "Something went wrong (ref: ID)" so nothing is silently dropped.
 */
export const toUserError = (error: unknown): UserError => {
  if (isAppError(error)) return fromCode(error.code, error.params, null);
  const details = isRecord(error) && isRecord(error.details) ? error.details : null;
  const requestId = details && typeof details.requestId === "string" ? details.requestId : null;
  if (details && isErrorCode(details.code)) return fromCode(details.code, readParams(details.params), requestId);
  return fromCode("INTERNAL", {}, requestId);
};

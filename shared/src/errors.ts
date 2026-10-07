/**
 * errors.ts
 * The error catalog (plan X9). Cloud Functions throw errors by catalog code;
 * the client maps the same code back to friendly copy, a fix, and a help
 * article. Keeping both sides on one list means a message is written once and
 * every error a user can see has a next step.
 *
 * Each entry has:
 *   code       stable identifier sent to the client in HttpsError details
 *   httpsCode  the Firebase callable error code used on the wire
 *   message    user-facing sentence, built from optional params
 *   fix        what the user (or developer) should do next
 *   helpSlug   Help Center article slug, or null when no article applies
 */

/** Firebase callable error codes (the subset of FunctionsErrorCode we use). */
export type HttpsErrorCode =
  | "invalid-argument"
  | "unauthenticated"
  | "permission-denied"
  | "not-found"
  | "failed-precondition"
  | "resource-exhausted"
  | "internal";

export type ErrorParams = Readonly<Record<string, string | number>>;

export interface ErrorCatalogEntry {
  readonly code: string;
  readonly httpsCode: HttpsErrorCode;
  readonly message: (params: ErrorParams) => string;
  readonly fix: string;
  readonly helpSlug: string | null;
}

const entry = (value: ErrorCatalogEntry): ErrorCatalogEntry => Object.freeze(value);

export const ERROR_CATALOG = Object.freeze({
  UNAUTHENTICATED: entry({
    code: "UNAUTHENTICATED",
    httpsCode: "unauthenticated",
    message: () => "Please sign in to continue.",
    fix: "Sign in, then try again.",
    helpSlug: "signing-in"
  }),
  PERMISSION_DENIED: entry({
    code: "PERMISSION_DENIED",
    httpsCode: "permission-denied",
    message: () => "You do not have permission to do that.",
    fix: "Ask an organization owner to add you as a coordinator, or switch accounts.",
    helpSlug: "roles-and-permissions"
  }),
  PROFILE_INCOMPLETE: entry({
    code: "PROFILE_INCOMPLETE",
    httpsCode: "failed-precondition",
    message: () => "Finish setting up your profile first.",
    fix: "Complete onboarding (birth date and interests), then try again.",
    helpSlug: "finishing-your-profile"
  }),
  NOT_FOUND: entry({
    code: "NOT_FOUND",
    httpsCode: "not-found",
    message: (params) => (params.resource ? `We could not find that ${params.resource}.` : "We could not find that."),
    fix: "Check the link, or go back and pick it again from the list.",
    helpSlug: null
  }),
  INVALID_INPUT: entry({
    code: "INVALID_INPUT",
    httpsCode: "invalid-argument",
    message: (params) => (params.field ? `Please check the ${params.field} field.` : "Some of the information sent was not valid."),
    fix: "Correct the highlighted fields and submit again.",
    helpSlug: null
  }),
  UNKNOWN_OPERATION: entry({
    code: "UNKNOWN_OPERATION",
    httpsCode: "invalid-argument",
    message: (params) => `This app version asked for an action the server does not know (${params.op ?? "none"}).`,
    fix: "Reload the page to get the latest version of the app.",
    helpSlug: null
  }),
  INTERNAL: entry({
    code: "INTERNAL",
    httpsCode: "internal",
    message: () => "Something went wrong on our side.",
    fix: "Try again in a minute. If it keeps happening, share the request ID with your coordinator.",
    helpSlug: null
  })
});

export type ErrorCode = keyof typeof ERROR_CATALOG;

/** Plain, serializable description of an error, safe to send to the client. */
export interface DescribedError {
  readonly code: ErrorCode;
  readonly httpsCode: HttpsErrorCode;
  readonly message: string;
  readonly fix: string;
  readonly helpSlug: string | null;
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

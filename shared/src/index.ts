/**
 * index.ts
 * Public entry point of @fbla/shared. The web app and Cloud Functions import
 * from "@fbla/shared" only, never from files inside this folder, so the
 * package can be reorganized without breaking callers.
 */
export { clock, getOffsetMs, setOffsetMs, withFixedNow, type Clock } from "./clock";
export {
  DEFAULT_LIMITS,
  LIMIT_ENV_VARS,
  resolveLimits,
  type EnvSource,
  type LimitName,
  type Limits
} from "./config";
export {
  AppError,
  ERROR_CATALOG,
  describeError,
  isAppError,
  isErrorCode,
  type DescribedError,
  type ErrorCatalogEntry,
  type ErrorCode,
  type ErrorParams,
  type HttpsErrorCode
} from "./errors";
export {
  EnvValidationError,
  envFlag,
  optionalEnvString,
  parseEnv,
  type EnvIssue,
  type EnvRecord,
  type ParseEnvOptions
} from "./validation/env";

/**
 * config.ts
 * Every tunable limit in one place (plan X13). Functions read these through
 * resolveLimits(process.env) so an operator can override a limit with an
 * environment variable without a code change; the client uses DEFAULT_LIMITS
 * for display (for example the 2,000 character counter on the assistant box).
 */

export const DEFAULT_LIMITS = Object.freeze({
  /** AI assistant calls allowed per user per hour. */
  aiCallsPerHour: 20,
  /** AI assistant calls allowed per user per day. */
  aiCallsPerDay: 100,
  /** Longest assistant question, in characters. */
  aiInputMaxChars: 2000,
  /** Longest assistant answer, in model output tokens. */
  aiOutputMaxTokens: 1024,
  /** Check-in or check-out attempts allowed per user per window. */
  checkInAttemptsPerWindow: 10,
  /** Length of the check-in attempt window, in minutes. */
  checkInWindowMinutes: 10,
  /** How often the kiosk code rotates, in seconds. */
  kioskCodeRotationSeconds: 30,
  /** How far ahead recurring series are materialized, in weeks. */
  seriesWindowWeeks: 8
});

export type LimitName = keyof typeof DEFAULT_LIMITS;
export type Limits = { readonly [K in LimitName]: number };

/** Environment variable that overrides each limit. */
export const LIMIT_ENV_VARS: Readonly<Record<LimitName, string>> = Object.freeze({
  aiCallsPerHour: "LIMIT_AI_CALLS_PER_HOUR",
  aiCallsPerDay: "LIMIT_AI_CALLS_PER_DAY",
  aiInputMaxChars: "LIMIT_AI_INPUT_MAX_CHARS",
  aiOutputMaxTokens: "LIMIT_AI_OUTPUT_MAX_TOKENS",
  checkInAttemptsPerWindow: "LIMIT_CHECKIN_ATTEMPTS_PER_WINDOW",
  checkInWindowMinutes: "LIMIT_CHECKIN_WINDOW_MINUTES",
  kioskCodeRotationSeconds: "LIMIT_KIOSK_CODE_ROTATION_SECONDS",
  seriesWindowWeeks: "LIMIT_SERIES_WINDOW_WEEKS"
});

export type EnvSource = Readonly<Record<string, string | undefined>>;

const parsePositiveInteger = (name: string, raw: string): number => {
  const trimmed = raw.trim();
  const value = Number(trimmed);
  if (trimmed === "" || !Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive whole number, got "${raw}"`);
  }
  return value;
};

/**
 * Returns the effective limits: defaults, with any LIMIT_* environment
 * variable applied on top. Throws a clear error for a malformed override so a
 * typo fails at startup instead of silently disabling a limit.
 */
export const resolveLimits = (env: EnvSource = {}): Limits => {
  const names = Object.keys(DEFAULT_LIMITS) as LimitName[];
  return Object.freeze(
    Object.fromEntries(
      names.map((name) => {
        const varName = LIMIT_ENV_VARS[name];
        const raw = env[varName];
        return [name, raw === undefined ? DEFAULT_LIMITS[name] : parsePositiveInteger(varName, raw)];
      })
    ) as Limits
  );
};

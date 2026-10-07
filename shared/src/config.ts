/**
 * config.ts
 * Every tunable limit and threshold in one place (SPEC#config, SPEC#formulas
 * section 7.3). Functions read these through resolveConfig(process.env) so an
 * operator can override a value with an environment variable named after the
 * key in UPPER_SNAKE_CASE (aiPerHour -> AI_PER_HOUR) without a code change.
 * The client uses DEFAULT_CONFIG for display (countdowns, "opens at" text,
 * the 2,000 character counter on the assistant box).
 */

export const DEFAULT_CONFIG = Object.freeze({
  /** AI assistant calls allowed per user per hour. */
  aiPerHour: 20,
  /** AI assistant calls allowed per user per day. */
  aiPerDay: 100,
  /** AI calls allowed for everyone per UTC day before AI turns off. */
  aiGlobalDailyCap: 500,
  /** Longest assistant question, in characters. */
  aiMaxInputChars: 2000,
  /** Longest assistant answer, in model output tokens. */
  aiMaxOutputTokens: 1024,
  /** Check-in plus check-out attempts allowed per user per window. */
  checkinRateMax: 10,
  /** Length of the check-in attempt window, in seconds. */
  checkinRateWindowSec: 600,
  /** How often the kiosk code rotates, in seconds. */
  kioskRotationSec: 30,
  /** How long before shift start a coordinator may start the kiosk, in minutes. */
  kioskStartBeforeMin: 60,
  /** Lifetime of a kiosk custom token, in hours. */
  kioskTokenHours: 12,
  /** How far ahead recurring series are materialized, in weeks. */
  seriesWindowWeeks: 8,
  /** The waitlist closes this many minutes before start. */
  waitlistCutoffMin: 120,
  /** A volunteer cancel closer than this to start counts as a late cancel. */
  lateCancelHours: 24,
  /** A promotion closer than this to start excuses a no-show. */
  latePromotionHours: 24,
  /** A promoted volunteer may release the seat without penalty within this window. */
  releaseWindowHours: 24,
  /** Check-in opens this many minutes before start. */
  checkinOpenBeforeMin: 30,
  /** Check-out opens this many minutes after check-in. */
  checkoutMinAfterCheckinMin: 15,
  /** Check-out stays open this many minutes after the shift ends; finalize runs then too. */
  checkoutGraceMin: 30,
  /** Instances processed per runDueJobs page. */
  jobPageSize: 200,
  /** runDueJobs lease length, in seconds. */
  jobLeaseSec: 240
});

export type ConfigKey = keyof typeof DEFAULT_CONFIG;
export type AppConfig = { readonly [K in ConfigKey]: number };

/** Approved-hour milestones that earn a badge (SPEC#formulas 7.3). */
export const MILESTONES = Object.freeze([25, 50, 100] as const);

/** Organization time zone used when none is set (SPEC#time zones 7.5). */
export const DEFAULT_TIME_ZONE = "America/Chicago";

/** camelCase key to UPPER_SNAKE_CASE env name: checkinRateMax -> CHECKIN_RATE_MAX. */
const toEnvName = (key: string): string => key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase();

/** Environment variable that overrides each config key. */
export const CONFIG_ENV_VARS: Readonly<Record<ConfigKey, string>> = Object.freeze(
  Object.fromEntries((Object.keys(DEFAULT_CONFIG) as ConfigKey[]).map((key) => [key, toEnvName(key)])) as Record<
    ConfigKey,
    string
  >
);

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
 * Returns the effective config: defaults, with any override variable applied
 * on top. A malformed override throws a clear error so a typo fails at
 * startup instead of silently disabling a limit.
 */
export const resolveConfig = (env: EnvSource = {}): AppConfig => {
  const keys = Object.keys(DEFAULT_CONFIG) as ConfigKey[];
  return Object.freeze(
    Object.fromEntries(
      keys.map((key) => {
        const varName = CONFIG_ENV_VARS[key];
        const raw = env[varName];
        return [key, raw === undefined ? DEFAULT_CONFIG[key] : parsePositiveInteger(varName, raw)];
      })
    ) as AppConfig
  );
};

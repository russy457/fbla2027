/**
 * api.ts
 * The typed client for every trusted write (SPEC#api 5.1, SPEC#definecallable).
 *
 *   callOp("volunteer", "signup", { instanceId })  ->  Promise<{ signupId, status, ... }>
 *
 * Wire format: httpsCallable(functions, endpoint)({ op, ...input }) returns
 * { ok: true, data, requestId }. The op map in @fbla/shared types both the
 * input and the output, and the output is re-validated with the same zod
 * schema the server used, because a response is still external data.
 *
 * Failures never leak raw Firebase errors to screens: every thrown value
 * becomes an ApiError holding the friendly UserError from toUserError
 * (SPEC#screen-errors, D22). There is no optimistic UI: callers show a
 * pending state until this promise settles, then re-render from Firestore.
 */
import { httpsCallable } from "firebase/functions";
import {
  OPS,
  OP_NAMES,
  toUserError,
  type Endpoint,
  type OpInput,
  type OpName,
  type OpOutput,
  type UserError
} from "@fbla/shared";
import { getFirebase } from "./firebase";
import { readClientEnv } from "./env";

/** Error type every screen catches. `userError` is ready to render. */
export class ApiError extends Error {
  readonly userError: UserError;

  constructor(userError: UserError) {
    super(userError.message);
    this.name = "ApiError";
    this.userError = userError;
  }
}

/** Callable error codes that mean "we never reached the server", not "the server said no". */
const NETWORK_CODES = new Set(["functions/unavailable", "functions/deadline-exceeded"]);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/** UserError for a dropped connection, so it reads as "try again" instead of an internal failure. */
export const NETWORK_USER_ERROR: UserError = Object.freeze({
  code: null,
  title: "Connection problem",
  message: "We couldn't reach the server. Check your connection and try again.",
  fix: "Try again.",
  helpSlug: null,
  requestId: null,
  params: {}
});

const LOCAL_NETWORK_USER_ERROR: UserError = Object.freeze({
  ...NETWORK_USER_ERROR,
  message: "Local action server is offline. Run npm run demo:restart in a terminal.",
  fix: "Start the full local demo."
});

const CLOUD_DEMO_NETWORK_USER_ERROR: UserError = Object.freeze({
  ...NETWORK_USER_ERROR,
  message: "Local action server is offline. Run npm run demo:cloud in a terminal.",
  fix: "Start the cloud presentation server."
});

/**
 * Converts anything thrown during a call into a UserError. Network failures
 * get their own copy; everything else goes through the shared catalog.
 */
export const toApiUserError = (error: unknown): UserError => {
  if (error instanceof ApiError) return error.userError;
  const hasDetails = isRecord(error) && isRecord(error.details);
  if (!hasDetails && isRecord(error) && typeof error.code === "string" && NETWORK_CODES.has(error.code)) {
    const env = readClientEnv();
    if (env.ok && env.env.VITE_USE_EMULATORS) return LOCAL_NETWORK_USER_ERROR;
    if (env.ok && env.env.VITE_FUNCTIONS_EMULATOR) return CLOUD_DEMO_NETWORK_USER_ERROR;
    return NETWORK_USER_ERROR;
  }
  return toUserError(error);
};

/** The part of an op entry the client needs: the output schema used to re-check responses. */
type OutputSchema = { readonly output: { safeParse: (value: unknown) => { success: boolean; data?: unknown } } };

const schemasFor = (endpoint: Endpoint, op: string): OutputSchema => {
  const pair = (OPS[endpoint] as Readonly<Record<string, OutputSchema>>)[op];
  if (!pair) throw new ApiError(toUserError(new Error(`Unknown op ${endpoint}.${op}`)));
  return pair;
};

/**
 * Calls one op and returns its typed `data`. Throws ApiError on any failure.
 * The response envelope and the data are both checked before returning.
 */
export const callOp = async <E extends Endpoint, O extends OpName<E>>(
  endpoint: E,
  op: O,
  input: OpInput<E, O>
): Promise<OpOutput<E, O>> => {
  const schemas = schemasFor(endpoint, op);
  try {
    const callable = httpsCallable<Record<string, unknown>, unknown>(getFirebase().functions, endpoint);
    const response = await callable({ op, ...(input as Record<string, unknown>) });
    const body = response.data;
    if (!isRecord(body) || body.ok !== true) throw new Error(`${endpoint}.${op} returned an unexpected envelope`);
    const checked = schemas.output.safeParse(body.data);
    if (!checked.success) throw new Error(`${endpoint}.${op} returned data that does not match its schema`);
    return checked.data as OpOutput<E, O>;
  } catch (error) {
    throw new ApiError(toApiUserError(error));
  }
};

/**
 * The same ops as an object: api.volunteer.signup({ instanceId }). Built from
 * OP_NAMES so this map always lists exactly the ops in shared/src/ops.ts
 * (SPEC 2.3: check:functions-index compares the lists).
 */
export type ApiClient = {
  readonly [E in Endpoint]: { readonly [O in OpName<E>]: (input: OpInput<E, O>) => Promise<OpOutput<E, O>> };
};

const buildEndpoint = <E extends Endpoint>(endpoint: E): ApiClient[E] =>
  Object.freeze(
    Object.fromEntries(
      OP_NAMES[endpoint].map((op) => [op, (input: OpInput<E, typeof op>) => callOp(endpoint, op, input)])
    )
  ) as ApiClient[E];

export const api: ApiClient = Object.freeze({
  volunteer: buildEndpoint("volunteer"),
  kiosk: buildEndpoint("kiosk"),
  coordinator: buildEndpoint("coordinator"),
  admin: buildEndpoint("admin"),
  ai: buildEndpoint("ai")
});

/**
 * A fresh idempotency key for one user intent (SPEC 5.1: generated once per
 * click and reused on retry). Callers keep it until the intent changes.
 */
export const newRequestNonce = (): string => crypto.randomUUID();

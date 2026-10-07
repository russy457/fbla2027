/**
 * ops.ts
 * The typed op map (SPEC#api, SPEC#definecallable): endpoint -> op ->
 * {input, output} zod schemas. It is the single list the Functions dispatch
 * tables and the client API (src/lib/api.ts) are checked against, so adding
 * an op here without a handler, or a handler without an entry here, fails.
 *
 * Wire format (SPEC 5.1): the client calls
 *   httpsCallable(endpoint)({ op, ...input })
 * and receives { ok: true, data, requestId } where data matches `output`.
 *
 * Client usage:
 *   import { OPS, type OpInput, type OpOutput } from "@fbla/shared";
 *   const input: OpInput<"volunteer", "signup"> = { instanceId };
 *   const result = await httpsCallable<OpRequest<"volunteer", "signup">, OpResponse<"volunteer", "signup">>(
 *     functions, "volunteer")({ op: "signup", ...input });
 */
import type { z } from "zod";
import {
  cancelSignupInput,
  cancelSignupOutput,
  completeProfileInput,
  completeProfileOutput,
  issueLetterInput,
  issueLetterOutput,
  signupInput,
  signupOutput
} from "./schemas/ops/volunteerOps";
import {
  checkInInput,
  checkInOutput,
  checkOutInput,
  checkOutOutput,
  finalizeShiftInput,
  finalizeShiftOutput,
  issueKioskCodeInput,
  issueKioskCodeOutput,
  revokeLetterInput,
  revokeLetterOutput,
  startKioskInput,
  startKioskOutput
} from "./schemas/ops/shiftOps";
import {
  pingInput,
  pingOutput,
  runDueJobsInput,
  runDueJobsOutput,
  setDemoClockInput,
  setDemoClockOutput
} from "./schemas/ops/systemOps";
// Tier 1 lane C
import { askAssistantInput, askAssistantOutput } from "./schemas/ops/aiOps";
import { resetDemoDataInput, resetDemoDataOutput } from "./schemas/ops/demoOps";

const op = <I extends z.ZodType, O extends z.ZodType>(input: I, output: O) => ({ input, output }) as const;

export const OPS = {
  volunteer: {
    ping: op(pingInput, pingOutput),
    completeProfile: op(completeProfileInput, completeProfileOutput),
    signup: op(signupInput, signupOutput),
    cancelSignup: op(cancelSignupInput, cancelSignupOutput),
    issueLetter: op(issueLetterInput, issueLetterOutput)
  },
  kiosk: {
    ping: op(pingInput, pingOutput),
    issueKioskCode: op(issueKioskCodeInput, issueKioskCodeOutput),
    checkIn: op(checkInInput, checkInOutput),
    checkOut: op(checkOutInput, checkOutOutput)
  },
  coordinator: {
    ping: op(pingInput, pingOutput),
    startKiosk: op(startKioskInput, startKioskOutput),
    finalizeShift: op(finalizeShiftInput, finalizeShiftOutput),
    revokeLetter: op(revokeLetterInput, revokeLetterOutput)
  },
  admin: {
    ping: op(pingInput, pingOutput),
    runDueJobs: op(runDueJobsInput, runDueJobsOutput),
    setDemoClock: op(setDemoClockInput, setDemoClockOutput),
    // Tier 1 lane C
    resetDemoData: op(resetDemoDataInput, resetDemoDataOutput)
  },
  ai: {
    ping: op(pingInput, pingOutput),
    // Tier 1 lane C
    askAssistant: op(askAssistantInput, askAssistantOutput)
  }
} as const;

export type OpMap = typeof OPS;
export type Endpoint = keyof OpMap;
export type OpName<E extends Endpoint> = keyof OpMap[E] & string;

type OpEntry<E extends Endpoint, O extends OpName<E>> = OpMap[E][O] extends { input: z.ZodType; output: z.ZodType }
  ? OpMap[E][O]
  : never;

/** What the client sends for an op (before the `op` field is added). */
export type OpInput<E extends Endpoint, O extends OpName<E>> = z.input<OpEntry<E, O>["input"]>;
/** The parsed input a handler receives. */
export type OpParsedInput<E extends Endpoint, O extends OpName<E>> = z.output<OpEntry<E, O>["input"]>;
/** The `data` field of a successful response. */
export type OpOutput<E extends Endpoint, O extends OpName<E>> = z.output<OpEntry<E, O>["output"]>;

/** The full callable payload: { op, ...input }. */
export type OpRequest<E extends Endpoint, O extends OpName<E>> = { op: O } & OpInput<E, O>;

/** Every successful callable response (SPEC 5.1). Failures throw an HttpsError instead. */
export interface OpSuccess<T> {
  readonly ok: true;
  readonly data: T;
  readonly requestId: string;
}
export type OpResponse<E extends Endpoint, O extends OpName<E>> = OpSuccess<OpOutput<E, O>>;

export const ENDPOINTS = Object.freeze(Object.keys(OPS) as Endpoint[]);

/** Op names per endpoint, for registry checks (check:functions-index) and the client map. */
export const OP_NAMES: { readonly [E in Endpoint]: readonly OpName<E>[] } = Object.freeze({
  volunteer: Object.keys(OPS.volunteer) as OpName<"volunteer">[],
  kiosk: Object.keys(OPS.kiosk) as OpName<"kiosk">[],
  coordinator: Object.keys(OPS.coordinator) as OpName<"coordinator">[],
  admin: Object.keys(OPS.admin) as OpName<"admin">[],
  ai: Object.keys(OPS.ai) as OpName<"ai">[]
});

/** True when `name` is an op on `endpoint` (own keys only, so "toString" is rejected). */
export const isOpName = <E extends Endpoint>(endpoint: E, name: string): name is OpName<E> =>
  Object.prototype.hasOwnProperty.call(OPS[endpoint], name);

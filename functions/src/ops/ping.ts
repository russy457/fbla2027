/**
 * ping.ts
 * The only operation registered in the Tier 0 skeleton. Every endpoint exposes
 * it so the client, the emulator smoke test, and DEMO.md pre-flight checks can
 * prove the callable path works end to end (auth, validation, logging).
 */
import { z } from "zod";
import { clock } from "@fbla/shared";
import { defineOp } from "../lib/defineCallable";

const MAX_ECHO_LENGTH = 100;

export const pingInputSchema = z
  .object({ echo: z.string().max(MAX_ECHO_LENGTH).optional() })
  .strict()
  .default({});

export interface PingResult {
  readonly pong: true;
  readonly fn: string;
  readonly uid: string;
  readonly time: string;
  readonly echo: string | null;
}

export const pingOp = defineOp({
  input: pingInputSchema,
  auth: "signedIn",
  handler: (input, context): PingResult => ({
    pong: true,
    fn: context.fn,
    uid: context.uid,
    time: clock.now().toISOString(),
    echo: input.echo ?? null
  })
});

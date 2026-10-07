/**
 * ping.ts
 * Every endpoint exposes ping so the client, the emulator smoke test, and the
 * DEMO.md pre-flight check can prove the callable path works end to end
 * (auth, validation, logging, the request clock).
 */
import type { Endpoint } from "@fbla/shared";
import { signedIn } from "../lib/auth";
import { defineCallable, type RegisteredOp } from "../lib/defineCallable";

/** Builds the ping op for one endpoint. All five share the same schemas in the op map. */
export const pingOp = (endpoint: Endpoint): RegisteredOp => ({
  ...defineCallable({
    endpoint: "volunteer",
    op: "ping",
    auth: signedIn(),
    handler: async ({ input, caller, clock }) => ({
      pong: true as const,
      fn: endpoint,
      uid: caller.uid,
      time: clock.now().toISOString(),
      echo: input.echo ?? null
    })
  }),
  endpoint
});

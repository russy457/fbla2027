import { describe, expect, it } from "vitest";
import { withFixedNow } from "@fbla/shared";
import { createCallableHandler } from "../lib/defineCallable";
import { adminOps } from "./admin";
import { aiOps } from "./ai";
import { coordinatorOps } from "./coordinator";
import { kioskOps } from "./kiosk";
import { volunteerOps } from "./volunteer";
import { healthPayload } from "../health";

const ENDPOINTS = {
  volunteer: volunteerOps,
  coordinator: coordinatorOps,
  kiosk: kioskOps,
  admin: adminOps,
  ai: aiOps
} as const;

const FIXED = Date.UTC(2026, 9, 6, 15, 0, 0);

describe("callable endpoints", () => {
  it.each(Object.entries(ENDPOINTS))("%s registers only ping in the skeleton", (_name, ops) => {
    expect(Object.keys(ops)).toEqual(["ping"]);
  });

  it.each(Object.entries(ENDPOINTS))("%s answers ping with the shared clock time", async (name, ops) => {
    const handler = createCallableHandler({ name, ops, log: () => undefined });
    const result = await withFixedNow(FIXED, () => handler({ data: { op: "ping", input: { echo: "hello" } }, auth: { uid: "u1" } }));
    expect(result).toEqual({ pong: true, fn: name, uid: "u1", time: "2026-10-06T15:00:00.000Z", echo: "hello" });
  });

  it("ping works without an input object", async () => {
    const handler = createCallableHandler({ name: "volunteer", ops: volunteerOps, log: () => undefined });
    await expect(handler({ data: { op: "ping" }, auth: { uid: "u1" } })).resolves.toMatchObject({ pong: true, echo: null });
  });

  it("ping rejects unexpected keys", async () => {
    const handler = createCallableHandler({ name: "volunteer", ops: volunteerOps, log: () => undefined });
    await expect(handler({ data: { op: "ping", input: { extra: 1 } }, auth: { uid: "u1" } })).rejects.toMatchObject({
      code: "invalid-argument"
    });
  });
});

describe("healthPayload", () => {
  it("reports ok, the project, and the shared clock time", () => {
    const payload = withFixedNow(FIXED, () => healthPayload({ GCLOUD_PROJECT: "demo-fbla2027" }));
    expect(payload).toEqual({ ok: true, project: "demo-fbla2027", time: "2026-10-06T15:00:00.000Z" });
  });

  it("falls back to GCP_PROJECT, then unknown", () => {
    expect(healthPayload({ GCP_PROJECT: "p2" }).project).toBe("p2");
    expect(healthPayload({}).project).toBe("unknown");
  });
});

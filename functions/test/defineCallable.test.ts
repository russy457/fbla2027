/**
 * defineCallable.test.ts
 * The shared callable pipeline (SPEC#definecallable, SPEC 4.4): envelope,
 * auth, kiosk-token scoping and expiry, input validation naming fields,
 * profile gate, error mapping, the success envelope, and the structured log.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { createEndpointHandler, assertOpTable } from "../src/lib/defineCallable";
import { volunteerOps } from "../src/endpoints/volunteer";
import { kioskOps } from "../src/endpoints/kiosk";
import { healthPayload } from "../src/health";
import { BASE_MS, HOUR, call, expectCode, kioskUser, logLines, makeDeps, resetEmulators, testClock, user } from "./harness";
import { seedInstance, seedWorld } from "./fixtures";

beforeEach(async () => {
  await resetEmulators();
  await seedWorld();
  await seedInstance("inst1");
});

describe("envelope and dispatch", () => {
  it("returns { ok, data, requestId } and logs one structured line without PII", async () => {
    const data = await call("ai", "ping", { echo: "hello" }, user("vol1"));
    expect(data).toEqual({ pong: true, fn: "ai", uid: "vol1", time: new Date(BASE_MS).toISOString(), echo: "hello" });
    const line = logLines.find((entry) => entry.message === "ai.ping ok");
    expect(line?.fields).toMatchObject({ fn: "ai.ping", uid: "vol1", orgId: null, instanceId: null, outcome: "ok", code: null });
    expect(JSON.stringify(line?.fields)).not.toContain("@example.test");
  });

  it("rejects a missing op, an unknown op, and prototype keys", async () => {
    const handler = createEndpointHandler("volunteer", volunteerOps, () => makeDeps());
    await expectCode(handler({ data: "nope", auth: user("vol1") }), "INVALID_INPUT");
    await expectCode(handler({ data: { op: "teleport" }, auth: user("vol1") }), "UNKNOWN_OPERATION");
    await expectCode(handler({ data: { op: "toString" }, auth: user("vol1") }), "UNKNOWN_OPERATION");
  });

  it("uses the Cloud trace id as the request id", async () => {
    const handler = createEndpointHandler("volunteer", volunteerOps, () => makeDeps());
    const error = await expectCode(
      handler({ data: { op: "signup" }, auth: undefined, rawRequest: { headers: { "x-cloud-trace-context": "trace-123/4;o=1" } } }),
      "AUTH_REQUIRED"
    );
    expect((error.details as { requestId: string }).requestId).toBe("trace-123");
  });

  it("refuses a dispatch table that does not match the shared op map", () => {
    expect(() => assertOpTable("kiosk", volunteerOps)).toThrow(/does not match/);
    expect(() => assertOpTable("kiosk", kioskOps.slice(1))).toThrow(/does not match/);
  });
});

describe("auth and validation order", () => {
  it("requires sign-in", async () => {
    await expectCode(call("volunteer", "signup", { instanceId: "inst1" }, undefined), "AUTH_REQUIRED");
  });

  it("names every invalid field and rejects unknown keys (no client orgId)", async () => {
    const error = await expectCode(call("volunteer", "signup", { instanceId: "a/b", orgId: "orgB" }, user("vol1")), "INVALID_INPUT");
    expect(error.message).toContain("instanceId");
    expect((error.details as { issues: unknown[] }).issues.length).toBeGreaterThan(0);
  });

  it("applies the profile gate (G11)", async () => {
    await expectCode(call("volunteer", "signup", { instanceId: "inst1" }, user("incomplete")), "PROFILE_INCOMPLETE");
    await expectCode(call("volunteer", "signup", { instanceId: "inst1" }, user("nobody")), "PROFILE_INCOMPLETE");
  });

  it("kiosk tokens: expired is KIOSK_SESSION_EXPIRED; any op but its own issueKioskCode is denied", async () => {
    await expectCode(call("kiosk", "issueKioskCode", { instanceId: "inst1" }, kioskUser("inst1", BASE_MS - 1)), "KIOSK_SESSION_EXPIRED");
    await expectCode(call("kiosk", "checkIn", { instanceId: "inst1", code: "123456" }, kioskUser("inst1")), "PERMISSION_DENIED");
    await expectCode(call("volunteer", "signup", { instanceId: "inst1" }, kioskUser("inst1")), "PERMISSION_DENIED");
    await expectCode(call("admin", "runDueJobs", {}, kioskUser("inst1")), "PERMISSION_DENIED");
    await expectCode(call("ai", "ping", {}, kioskUser("inst1")), "PERMISSION_DENIED");
  });

  it("admin ops require the admin claim", async () => {
    await expectCode(call("admin", "runDueJobs", {}, user("coordA")), "PERMISSION_DENIED");
  });
});

describe("health", () => {
  it("reports ok, demo mode, the request clock, and the last job run", async () => {
    testClock.set(BASE_MS + HOUR);
    const before = await healthPayload(makeDeps());
    expect(before).toMatchObject({ ok: true, demoMode: true, project: "demo-fbla2027", lastJobRunAt: null });
    expect(before.time).toBe(new Date(BASE_MS + HOUR).toISOString());
    await call("admin", "runDueJobs", {}, { uid: "admin1", token: { admin: true } });
    expect((await healthPayload(makeDeps())).lastJobRunAt).toBe(new Date(BASE_MS + HOUR).toISOString());
  });
});

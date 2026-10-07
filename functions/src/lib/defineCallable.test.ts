import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { HttpsError } from "firebase-functions/v2/https";
import { AppError } from "@fbla/shared";
import { createCallableHandler, defineOp, type CallLogEntry, type CallableRequestLike } from "./defineCallable";

const loggerMock = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
vi.mock("firebase-functions/logger", () => loggerMock);

const SIGNED_IN = { uid: "user-1" } as const;

const buildHandler = () => {
  const entries: CallLogEntry[] = [];
  const echo = defineOp({
    input: z.object({ message: z.string().min(1) }),
    auth: "signedIn",
    handler: (input, context) => ({ said: input.message, uid: context.uid, fn: context.fn, op: context.op })
  });
  const denied = defineOp({
    input: z.object({}).default({}),
    auth: "signedIn",
    handler: () => {
      throw new AppError("PERMISSION_DENIED");
    }
  });
  const broken = defineOp({
    input: z.object({}).default({}),
    auth: "signedIn",
    handler: async () => {
      throw new Error("database exploded with secret details");
    }
  });
  const handler = createCallableHandler({
    name: "volunteer",
    ops: { echo, denied, broken },
    log: (entry) => entries.push(entry)
  });
  return { handler, entries };
};

const call = (data: unknown, overrides: Partial<CallableRequestLike> = {}): CallableRequestLike => ({
  data,
  auth: SIGNED_IN,
  ...overrides
});

const captureHttpsError = async (promise: Promise<unknown>): Promise<HttpsError> => {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(HttpsError);
    return error as HttpsError;
  }
  throw new Error("expected the call to reject");
};

describe("createCallableHandler dispatch", () => {
  it("routes to the named op with validated input and context", async () => {
    const { handler, entries } = buildHandler();
    const result = await handler(call({ op: "echo", input: { message: "hi" } }));
    expect(result).toEqual({ said: "hi", uid: "user-1", fn: "volunteer", op: "echo" });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ fn: "volunteer", op: "echo", uid: "user-1", outcome: "ok" });
    expect(typeof entries[0]?.ms).toBe("number");
    expect(entries[0]?.requestId).toMatch(/.+/);
  });

  it("rejects an unknown op with UNKNOWN_OPERATION", async () => {
    const { handler, entries } = buildHandler();
    const error = await captureHttpsError(handler(call({ op: "toString" })));
    expect(error.code).toBe("invalid-argument");
    expect(error.details).toMatchObject({ code: "UNKNOWN_OPERATION" });
    expect(entries[0]).toMatchObject({ outcome: "rejected", errorCode: "UNKNOWN_OPERATION", op: "toString" });
  });

  it("rejects a malformed envelope", async () => {
    const { handler, entries } = buildHandler();
    const error = await captureHttpsError(handler(call("not an object")));
    expect(error.details).toMatchObject({ code: "INVALID_INPUT" });
    expect(entries[0]).toMatchObject({ op: null, outcome: "rejected" });
  });
});

describe("createCallableHandler auth", () => {
  it("requires a signed-in caller", async () => {
    const { handler, entries } = buildHandler();
    const error = await captureHttpsError(handler(call({ op: "echo", input: { message: "hi" } }, { auth: undefined })));
    expect(error.code).toBe("unauthenticated");
    expect(error.details).toMatchObject({ code: "UNAUTHENTICATED", helpSlug: "signing-in" });
    expect(entries[0]).toMatchObject({ uid: null, outcome: "rejected", errorCode: "UNAUTHENTICATED" });
  });
});

describe("createCallableHandler validation", () => {
  it("maps zod failures to INVALID_INPUT naming the field", async () => {
    const { handler, entries } = buildHandler();
    const error = await captureHttpsError(handler(call({ op: "echo", input: { message: "" } })));
    expect(error.code).toBe("invalid-argument");
    expect(error.message).toBe("Please check the message field.");
    expect(error.details).toMatchObject({ code: "INVALID_INPUT", issues: [{ path: "message" }] });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ outcome: "rejected", errorCode: "INVALID_INPUT" });
  });

  it("names the input itself when the whole input is missing", async () => {
    const { handler } = buildHandler();
    const error = await captureHttpsError(handler(call({ op: "echo" })));
    expect(error.message).toBe("Please check the input field.");
  });
});

describe("createCallableHandler error mapping", () => {
  it("maps AppError through the shared catalog", async () => {
    const { handler, entries } = buildHandler();
    const error = await captureHttpsError(handler(call({ op: "denied" })));
    expect(error.code).toBe("permission-denied");
    expect(error.details).toMatchObject({ code: "PERMISSION_DENIED", fix: expect.any(String) });
    expect(entries[0]).toMatchObject({ outcome: "rejected", errorCode: "PERMISSION_DENIED" });
  });

  it("hides unexpected errors behind INTERNAL", async () => {
    const { handler, entries } = buildHandler();
    const error = await captureHttpsError(handler(call({ op: "broken" })));
    expect(error.code).toBe("internal");
    expect(error.message).not.toContain("secret");
    expect(entries[0]).toMatchObject({ outcome: "error", errorCode: "INTERNAL" });
  });

  it("uses the Cloud trace id as the request id when present", async () => {
    const { handler, entries } = buildHandler();
    const error = await captureHttpsError(
      handler(call({ op: "denied" }, { rawRequest: { headers: { "x-cloud-trace-context": "abc123/1;o=1" } } }))
    );
    expect(error.details).toMatchObject({ requestId: "abc123" });
    expect(entries[0]?.requestId).toBe("abc123");
  });

  it("accepts an array-valued trace header", async () => {
    const { handler, entries } = buildHandler();
    await handler(call({ op: "echo", input: { message: "x" } }, { rawRequest: { headers: { "x-cloud-trace-context": ["t-9/2"] } } }));
    expect(entries[0]?.requestId).toBe("t-9");
  });
});

describe("default logger", () => {
  it("writes info, warn, and error lines through firebase-functions/logger", async () => {
    const handler = createCallableHandler({
      name: "admin",
      ops: {
        ok: defineOp({ input: z.object({}).default({}), auth: "signedIn", handler: () => "fine" }),
        nope: defineOp({
          input: z.object({}).default({}),
          auth: "signedIn",
          handler: () => {
            throw new AppError("NOT_FOUND");
          }
        }),
        crash: defineOp({
          input: z.object({}).default({}),
          auth: "signedIn",
          handler: () => {
            throw new Error("boom");
          }
        })
      }
    });
    await expect(handler(call({ op: "ok" }))).resolves.toBe("fine");
    await expect(handler(call({ op: "nope" }))).rejects.toBeInstanceOf(HttpsError);
    await expect(handler(call({ op: "crash" }))).rejects.toBeInstanceOf(HttpsError);
    expect(loggerMock.info).toHaveBeenCalledWith("admin.ok ok", expect.objectContaining({ fn: "admin", op: "ok", outcome: "ok" }));
    expect(loggerMock.warn).toHaveBeenCalledWith("admin.nope rejected", expect.objectContaining({ errorCode: "NOT_FOUND" }));
    expect(loggerMock.error).toHaveBeenCalledWith("admin.crash error", expect.objectContaining({ outcome: "error" }));
  });
});

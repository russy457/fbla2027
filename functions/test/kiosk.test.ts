/**
 * kiosk.test.ts
 * startKiosk, issueKioskCode, checkIn, checkOut (SPEC#fn-startkiosk,
 * SPEC#fn-issuekioskcode, SPEC#fn-checkin, SPEC#fn-checkout): windows driven
 * by the injected clock, stale and previous-window codes, rate limiting,
 * retry idempotency (checkOut twice -> one HoursLog), cross-org denial, and
 * kiosk-token scoping.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { COLLECTIONS, kioskWindowAt, type HoursLogDoc, type InstanceSecretDoc, type SignupDoc } from "@fbla/shared";
import { EMULATOR_KIOSK_MASTER_SECRET } from "../src/lib/env";
import { codeForWindow, deriveInstanceKey } from "../src/kiosk/kioskCode";
import { BASE_MS, HOUR, MINUTE, auth, call, db, expectCode, kioskUser, resetEmulators, testClock, user } from "./harness";
import { seedInstance, seedWorld } from "./fixtures";

const START = BASE_MS + 3 * HOUR;
const END = START + 4 * HOUR;
const ROTATION_SEC = 30;

/** The code the kiosk shows right now, fetched the way the kiosk does. */
const currentCode = async (instanceId = "inst1"): Promise<string> =>
  (await call<{ code: string }>("kiosk", "issueKioskCode", { instanceId }, kioskUser(instanceId))).code;

/** Code for a window relative to now (0 = current, -1 = previous, -2 = stale). */
const codeAtOffset = async (windowOffset: number, instanceId = "inst1"): Promise<string> => {
  const secret = (await db.collection(COLLECTIONS.instanceSecrets).doc(instanceId).get()).data() as InstanceSecretDoc;
  const key = deriveInstanceKey(EMULATOR_KIOSK_MASTER_SECRET, secret.salt, instanceId, secret.keyVersion);
  return codeForWindow(key, kioskWindowAt(testClock.nowMs, ROTATION_SEC).index + windowOffset);
};

const signupOf = async (uid: string) => (await db.collection(COLLECTIONS.signups).doc(`inst1_${uid}`).get()).data() as SignupDoc;

beforeEach(async () => {
  await resetEmulators();
  await seedWorld();
  await seedInstance("inst1");
  await seedInstance("instB", { orgId: "orgB" });
  await call("volunteer", "signup", { instanceId: "inst1" }, user("vol1"));
});

describe("coordinator.startKiosk", () => {
  it("mints a kiosk custom token from start - 60 min", async () => {
    await expectCode(call("coordinator", "startKiosk", { instanceId: "inst1" }, user("coordA")), "KIOSK_NOT_OPEN");
    testClock.set(START - HOUR);
    const result = await call<{ customToken: string; expiresAt: string }>("coordinator", "startKiosk", { instanceId: "inst1" }, user("coordA"));
    expect(result.customToken.split(".")).toHaveLength(3);
    expect(result.expiresAt).toBe(new Date(START - HOUR + 12 * HOUR).toISOString());
    // The token's claims scope it to this instance.
    const payload = JSON.parse(Buffer.from(result.customToken.split(".")[1] ?? "", "base64url").toString()) as { claims: Record<string, unknown> };
    expect(payload.claims).toMatchObject({ kioskInstanceId: "inst1", kioskOrgId: "orgA" });
  });

  it("cross-org coordinators, volunteers, and kiosk tokens are denied", async () => {
    testClock.set(START - HOUR);
    await expectCode(call("coordinator", "startKiosk", { instanceId: "inst1" }, user("coordB")), "PERMISSION_DENIED");
    await expectCode(call("coordinator", "startKiosk", { instanceId: "inst1" }, user("vol1")), "PERMISSION_DENIED");
    await expectCode(call("coordinator", "startKiosk", { instanceId: "inst1" }, kioskUser("inst1")), "PERMISSION_DENIED");
  });

  it("refuses a cancelled shift", async () => {
    await seedInstance("gone", { status: "cancelled" });
    testClock.set(START - HOUR);
    await expectCode(call("coordinator", "startKiosk", { instanceId: "gone" }, user("coordA")), "SHIFT_CANCELLED");
  });
});

describe("kiosk.issueKioskCode", () => {
  it("serves the kiosk token for its own instance and the org's coordinator", async () => {
    testClock.set(START - 30 * MINUTE + 10_000);
    const fromKiosk = await call<{ code: string; secondsRemaining: number; qrPayload: string }>("kiosk", "issueKioskCode", { instanceId: "inst1" }, kioskUser("inst1"));
    const fromCoordinator = await call<{ code: string }>("kiosk", "issueKioskCode", { instanceId: "inst1" }, user("coordA"));
    expect(fromKiosk.code).toMatch(/^\d{6}$/);
    expect(fromCoordinator.code).toBe(fromKiosk.code);
    expect(fromKiosk.secondsRemaining).toBeGreaterThan(0);
    expect(fromKiosk.qrPayload).toBe(`http://localhost:5173/checkin?i=inst1&c=${fromKiosk.code}`);
    // Codes are never stored.
    expect(JSON.stringify((await db.collection(COLLECTIONS.instanceSecrets).doc("inst1").get()).data())).not.toContain(fromKiosk.code);
  });

  it("is closed outside start - 30 to end + 30 and denies other kiosks and orgs", async () => {
    await expectCode(call("kiosk", "issueKioskCode", { instanceId: "inst1" }, kioskUser("inst1")), "KIOSK_NOT_OPEN");
    testClock.set(START);
    await expectCode(call("kiosk", "issueKioskCode", { instanceId: "inst1" }, kioskUser("instB")), "PERMISSION_DENIED");
    await expectCode(call("kiosk", "issueKioskCode", { instanceId: "inst1" }, user("coordB")), "PERMISSION_DENIED");
    await expectCode(call("kiosk", "issueKioskCode", { instanceId: "inst1" }, user("vol1")), "PERMISSION_DENIED");
    testClock.set(END + 31 * MINUTE);
    await expectCode(call("kiosk", "issueKioskCode", { instanceId: "inst1" }, kioskUser("inst1")), "KIOSK_NOT_OPEN");
  });
});

describe("kiosk.checkIn", () => {
  it("enforces the check-in window with the injected clock", async () => {
    testClock.set(START - 31 * MINUTE);
    const error = await expectCode(call("kiosk", "checkIn", { instanceId: "inst1", code: "123456" }, user("vol1")), "CHECKIN_NOT_OPEN");
    expect((error.details as { params: { opensAt: string } }).params.opensAt).toBe(new Date(START - 30 * MINUTE).toISOString());
    testClock.set(START - 30 * MINUTE);
    const result = await call("kiosk", "checkIn", { instanceId: "inst1", code: await currentCode() }, user("vol1"));
    expect(result).toEqual({
      status: "checked-in",
      checkInAt: new Date(START - 30 * MINUTE).toISOString(),
      checkOutOpensAt: new Date(START - 15 * MINUTE).toISOString()
    });
    expect((await signupOf("vol1")).status).toBe("checked-in");
  });

  it("rejects stale and wrong codes but accepts the previous window's code", async () => {
    testClock.set(START);
    await currentCode(); // creates the instance secret
    await expectCode(call("kiosk", "checkIn", { instanceId: "inst1", code: await codeAtOffset(-2) }, user("vol1")), "KIOSK_CODE_INVALID");
    const current = await codeAtOffset(0);
    const previous = await codeAtOffset(-1);
    const wrong = ["000000", "111111", "222222"].find((code) => code !== current && code !== previous) ?? "333333";
    await expectCode(call("kiosk", "checkIn", { instanceId: "inst1", code: wrong }, user("vol1")), "KIOSK_CODE_INVALID");
    await expect(call("kiosk", "checkIn", { instanceId: "inst1", code: previous }, user("vol1"))).resolves.toMatchObject({ status: "checked-in" });
  });

  it("a retry after success returns the original check-in even with an old code", async () => {
    testClock.set(START);
    const first = await call("kiosk", "checkIn", { instanceId: "inst1", code: await currentCode() }, user("vol1"));
    testClock.advance(5 * MINUTE);
    const again = await call("kiosk", "checkIn", { instanceId: "inst1", code: "000000" }, user("vol1"));
    expect(again).toEqual(first);
  });

  it("requires a confirmed signup", async () => {
    testClock.set(START);
    await expectCode(call("kiosk", "checkIn", { instanceId: "inst1", code: await currentCode() }, user("vol2")), "NOT_SIGNED_UP");
  });

  it("rate-limits to 10 attempts per 10 minutes", async () => {
    testClock.set(START);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await call("kiosk", "checkIn", { instanceId: "inst1", code: "000001" }, user("vol2")).catch(() => null);
    }
    const error = await expectCode(call("kiosk", "checkIn", { instanceId: "inst1", code: "000001" }, user("vol2")), "RATE_LIMITED");
    expect((error.details as { params: { retryAfterSec: number } }).params.retryAfterSec).toBeGreaterThan(0);
    testClock.advance(10 * MINUTE);
    await expectCode(call("kiosk", "checkIn", { instanceId: "inst1", code: await currentCode() }, user("vol2")), "NOT_SIGNED_UP");
  });
});

describe("kiosk.checkOut", () => {
  const checkInAt = async (atMs: number) => {
    testClock.set(atMs);
    await call("kiosk", "checkIn", { instanceId: "inst1", code: await currentCode() }, user("vol1"));
  };

  it("opens 15 minutes after check-in and creates one approved kiosk HoursLog", async () => {
    await checkInAt(START + 7 * MINUTE);
    testClock.advance(10 * MINUTE);
    await expectCode(call("kiosk", "checkOut", { instanceId: "inst1", code: await currentCode() }, user("vol1")), "CHECKOUT_NOT_OPEN");
    testClock.set(END - 8 * MINUTE);
    const code = await currentCode();
    const result = await call("kiosk", "checkOut", { instanceId: "inst1", code }, user("vol1"));
    expect(result).toEqual({ status: "completed", minutes: 225, orgName: "Alamo Community Pantry", totalApprovedHours: 3.75 });

    // Retry with the same request (for example after a dropped response): same result, still one log.
    testClock.advance(2 * MINUTE);
    await expect(call("kiosk", "checkOut", { instanceId: "inst1", code }, user("vol1"))).resolves.toMatchObject({ minutes: 225 });
    const logs = await db.collection(COLLECTIONS.hoursLogs).where("uid", "==", "vol1").get();
    expect(logs.size).toBe(1);
    expect(logs.docs[0]?.id).toBe("inst1_vol1");
    expect(logs.docs[0]?.data() as HoursLogDoc).toMatchObject({ source: "kiosk", status: "approved", needsReview: false, minutes: 225 });
  });

  it("refuses check-out without check-in, after the grace window, and with a wrong code", async () => {
    testClock.set(START + HOUR);
    await expectCode(call("kiosk", "checkOut", { instanceId: "inst1", code: await currentCode() }, user("vol1")), "NOT_CHECKED_IN");
    await call("kiosk", "checkIn", { instanceId: "inst1", code: await currentCode() }, user("vol1"));
    testClock.advance(HOUR);
    const current = await codeAtOffset(0);
    const previous = await codeAtOffset(-1);
    const wrong = ["000000", "111111", "222222"].find((code) => code !== current && code !== previous) ?? "333333";
    await expectCode(call("kiosk", "checkOut", { instanceId: "inst1", code: wrong }, user("vol1")), "KIOSK_CODE_INVALID");
    testClock.set(END + 31 * MINUTE);
    await expectCode(call("kiosk", "checkOut", { instanceId: "inst1", code: "000000" }, user("vol1")), "CHECKOUT_CLOSED");
  });

  it("checkOut twice concurrently still writes one HoursLog", async () => {
    await checkInAt(START);
    testClock.set(START + 2 * HOUR);
    const code = await currentCode();
    const results = await Promise.allSettled([
      call("kiosk", "checkOut", { instanceId: "inst1", code }, user("vol1")),
      call("kiosk", "checkOut", { instanceId: "inst1", code }, user("vol1"))
    ]);
    expect(results.some((result) => result.status === "fulfilled")).toBe(true);
    const logs = await db.collection(COLLECTIONS.hoursLogs).where("uid", "==", "vol1").get();
    expect(logs.size).toBe(1);
    expect((await signupOf("vol1")).status).toBe("completed");
  });

  it("keeps the kiosk custom token usable against the auth emulator", async () => {
    testClock.set(START - HOUR);
    const { customToken } = await call<{ customToken: string }>("coordinator", "startKiosk", { instanceId: "inst1" }, user("coordA"));
    expect(customToken.length).toBeGreaterThan(20);
    // No auth user is created for kiosk tokens; listing users shows none with the kiosk prefix.
    const users = await auth.listUsers();
    expect(users.users.some((record) => record.uid.startsWith("kiosk_"))).toBe(false);
  });
});

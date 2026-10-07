/**
 * demoExtras.test.ts
 * The E1 dataset on top of SPEC 10.7: more cause areas, more upcoming
 * shifts, a pantry Needs attention queue (needsReview log, pending manual
 * log, open dispute), background totals that include the extra hours, and
 * no extra activity for the four sign-in accounts.
 */
import { describe, expect, it } from "vitest";
import { type HoursLogDoc, type InstanceDoc, type SignupDoc, type UserPublicDoc } from "@fbla/shared";
import { BACKGROUND, DEMO_ACCOUNTS, ORGS } from "./demoCast";
import { EXTRA_OPPORTUNITIES, buildDemoExtras } from "./demoExtras";
import { buildDemoSeed } from "./demoSeed";

const NOW_MS = Date.UTC(2026, 9, 6, 15, 0, 0);
const salt = (id: string) => Buffer.from(id).toString("base64");
const extras = buildDemoExtras(NOW_MS, salt);
const seed = buildDemoSeed({ nowMs: NOW_MS, shiftStartsInMs: 10 * 60_000, saltFor: salt, letterVerifyCode: "ABCDEFGHIJKLMNOPQRSTUVWXYZ", letterNonce: "n" });
const docs = <T>(prefix: string): T[] => extras.writes.filter((write) => write.path.startsWith(prefix)).map((write) => write.data as T);

describe("E1 demo extras", () => {
  it("adds opportunities in new cause areas and upcoming shifts", () => {
    const causes = new Set(Object.values(EXTRA_OPPORTUNITIES).map((opportunity) => opportunity.causeArea));
    expect(causes).toEqual(new Set(["seniors", "health-wellness", "education-youth", "environment"]));
    const upcoming = docs<InstanceDoc>("instances/").filter((instance) => instance.status === "scheduled");
    expect(upcoming.length).toBeGreaterThanOrEqual(4);
    expect(upcoming.every((instance) => instance.start.toMillis() > NOW_MS)).toBe(true);
    expect(extras.nextStarts.size).toBe(4);
  });

  it("gives the pantry a Needs attention queue", () => {
    const pantryLogs = docs<HoursLogDoc>("hoursLogs/").filter((log) => log.orgId === ORGS.pantry.id);
    expect(pantryLogs.filter((log) => log.needsReview && log.status === "pending")).toHaveLength(1);
    expect(pantryLogs.filter((log) => log.source === "manual" && log.status === "pending")).toHaveLength(1);
    expect(docs<SignupDoc>("signups/").filter((signup) => signup.disputeOpen && signup.status === "no-show")).toHaveLength(1);
  });

  it("involves only background people, and their public totals include the extra hours", () => {
    const accountUids = new Set(DEMO_ACCOUNTS.map((account) => account.uid));
    expect(docs<SignupDoc>("signups/").some((signup) => accountUids.has(signup.uid))).toBe(false);
    const mariaMinutes = (extras.approvedLogs.get(BACKGROUND.maria.uid) ?? []).reduce((sum, log) => sum + log.minutes, 0);
    expect(mariaMinutes).toBe(480);
    const maria = seed.writes.find((write) => write.path === `users/${BACKGROUND.maria.uid}`)?.data as UserPublicDoc;
    expect(maria.totalApprovedHours).toBe(8);
  });

  it("is part of the seed with a contact snapshot for every extra signup", () => {
    const paths = new Set(seed.writes.map((write) => write.path));
    for (const write of extras.writes) expect(paths.has(write.path)).toBe(true);
    for (const contact of extras.contacts) expect(paths.has(`signupContacts/${contact.instanceId}_${contact.person.uid}`)).toBe(true);
  });
});

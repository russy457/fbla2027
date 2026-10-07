/**
 * demoSeed.test.ts
 * The demo seed against SPEC#demo-accounts (10.7): every document parses with
 * its shared schema, and the SPEC facts hold (four accounts, Jordan's 22.5
 * approved hours that the demo shift pushes past 25, reliability from 8 past
 * shifts, three orgs with one unverified, the one-seat-left shift, a full
 * shift with a waitlist, one valid letter, the minor's hidden contact). The
 * printed links must all be routes in src/router.tsx.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import {
  HOUR_MS,
  MILESTONES,
  demoClockDocSchema,
  hoursLogDocSchema,
  instanceDocSchema,
  instanceSecretDocSchema,
  letterDocSchema,
  letterRefDocSchema,
  letterVerificationDocSchema,
  memberDocSchema,
  notificationDocSchema,
  opportunityDocSchema,
  organizationDocSchema,
  privateProfileDocSchema,
  savedItemDocSchema,
  signupContactDocSchema,
  signupDocSchema,
  userPublicDocSchema,
  type HoursLogDoc,
  type InstanceDoc,
  type LetterDoc,
  type NotificationDoc,
  type OrganizationDoc,
  type PrivateProfileDoc,
  type SignupContactDoc,
  type SignupDoc,
  type UserPublicDoc
} from "@fbla/shared";
import { DEMO_ACCOUNTS, MINOR, VOLUNTEER } from "./demoCast";
import { DEMO_INSTANCE_ID, DEMO_SHIFT_LENGTH_MIN, FULL_INSTANCE_ID, buildDemoSeed } from "./demoSeed";
import { demoLinks, formatSeedSummary } from "./seedSummary";

const NOW_MS = Date.UTC(2026, 9, 6, 15, 0, 0);
const seed = buildDemoSeed({
  nowMs: NOW_MS,
  shiftStartsInMs: 10 * 60_000,
  saltFor: (id) => Buffer.from(`salt-${id}`).toString("base64"),
  letterVerifyCode: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  letterNonce: "nonce"
});

/** Which schema a seed path must satisfy; null means a document with no shared schema (meta/seed). */
const schemaFor = (path: string): z.ZodType | null => {
  const parts = path.split("/");
  if (parts[0] === "organizations") return parts.length === 2 ? organizationDocSchema : parts[2] === "members" ? memberDocSchema : letterRefDocSchema;
  if (parts[0] === "users") return parts.length === 2 ? userPublicDocSchema : parts[2] === "saved" ? savedItemDocSchema : privateProfileDocSchema;
  if (parts[0] === "notifications") return notificationDocSchema;
  const byCollection: Record<string, z.ZodType | null> = {
    opportunities: opportunityDocSchema,
    instances: instanceDocSchema,
    instanceSecrets: instanceSecretDocSchema,
    signups: signupDocSchema,
    signupContacts: signupContactDocSchema,
    hoursLogs: hoursLogDocSchema,
    letters: letterDocSchema,
    letterVerifications: letterVerificationDocSchema,
    demoClock: demoClockDocSchema,
    meta: null
  };
  const schema = byCollection[parts[0] ?? ""];
  if (schema === undefined) throw new Error(`no schema mapping for ${path}`);
  return schema;
};

const docsIn = <T>(collection: string): Array<{ id: string; data: T }> =>
  seed.writes
    .filter((write) => write.path.split("/").length === 2 && write.path.startsWith(`${collection}/`))
    .map((write) => ({ id: write.path.split("/")[1] ?? "", data: write.data as T }));
const docAt = <T>(path: string): T => {
  const write = seed.writes.find((candidate) => candidate.path === path);
  if (!write) throw new Error(`seed has no ${path}`);
  return write.data as T;
};

describe("demo seed documents", () => {
  it("every document parses with its shared schema, and no path is written twice", () => {
    const failures = seed.writes.flatMap((write) => {
      const result = schemaFor(write.path)?.safeParse(write.data);
      return result && !result.success ? [`${write.path}: ${result.error.issues.map((issue) => issue.path.join(".")).join(", ")}`] : [];
    });
    expect(failures).toEqual([]);
    const paths = seed.writes.map((write) => write.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe("SPEC 10.7 facts", () => {
  it("has the four sign-in accounts with the admin claim only on the admin", () => {
    expect(DEMO_ACCOUNTS.map((account) => account.email)).toEqual([
      "admin@demo.fbla2027.test",
      "coordinator@demo.fbla2027.test",
      "volunteer@demo.fbla2027.test",
      "minor@demo.fbla2027.test"
    ]);
    expect(DEMO_ACCOUNTS.filter((account) => account.admin).map((account) => account.uid)).toEqual(["demo-admin"]);
    const profiles = DEMO_ACCOUNTS.map((account) => docAt<PrivateProfileDoc>(`users/${account.uid}/private/profile`));
    expect(profiles.every((profile) => profile.profileComplete)).toBe(true);
    expect(profiles.map((profile) => profile.isMinor)).toEqual([false, false, false, true]);
  });

  it("gives Jordan 22.5 approved hours, and the demo shift crosses the 25-hour milestone", () => {
    const approved = docsIn<HoursLogDoc>("hoursLogs").filter((log) => log.data.uid === VOLUNTEER.uid && log.data.status === "approved");
    expect(approved.reduce((sum, log) => sum + log.data.minutes, 0)).toBe(1350);
    expect(docAt<UserPublicDoc>(`users/${VOLUNTEER.uid}`).totalApprovedHours).toBe(22.5);
    expect(22.5 + DEMO_SHIFT_LENGTH_MIN / 60).toBeGreaterThanOrEqual(MILESTONES[0]);
  });

  it("derives Jordan's reliability from 8 past shifts (7 attended, 1 no-show)", () => {
    const profile = docAt<PrivateProfileDoc>(`users/${VOLUNTEER.uid}/private/profile`);
    expect(profile.reliability).toMatchObject({ attended: 7, noShows: 1, total: 8, score: 7 / 8, isNew: false });
    const finished = docsIn<SignupDoc>("signups").filter((signup) => signup.data.uid === VOLUNTEER.uid && ["completed", "no-show"].includes(signup.data.status));
    expect(finished).toHaveLength(8);
  });

  it("has three fictional orgs, exactly one unverified", () => {
    const orgs = docsIn<OrganizationDoc>("organizations");
    expect(orgs).toHaveLength(3);
    expect(orgs.every((org) => org.data.address.city === "Example City")).toBe(true);
    expect(orgs.filter((org) => !org.data.verified)).toHaveLength(1);
    expect(new Set(docsIn<{ causeArea: string }>("opportunities").map((opportunity) => opportunity.data.causeArea)).size).toBeGreaterThanOrEqual(3);
  });

  it("starts the demo shift in --shift-starts-in with capacity 3 and one seat left", () => {
    const demo = docAt<InstanceDoc>(`instances/${DEMO_INSTANCE_ID}`);
    expect(demo.start.toMillis()).toBe(seed.demoShiftStartMs);
    expect(seed.demoShiftStartMs).toBe(NOW_MS + 10 * 60_000);
    expect(demo).toMatchObject({ capacity: 3, signupCount: 2, status: "scheduled" });
    expect(docAt<SignupDoc>(`signups/${DEMO_INSTANCE_ID}_${VOLUNTEER.uid}`).status).toBe("confirmed");
  });

  it("has a full shift whose waitlist matches its waitlisted signups", () => {
    const full = docAt<InstanceDoc>(`instances/${FULL_INSTANCE_ID}`);
    expect(full.signupCount).toBe(full.capacity);
    expect(full.waitlist.length).toBeGreaterThan(0);
    const waitlisted = docsIn<SignupDoc>("signups").filter((signup) => signup.data.instanceId === FULL_INSTANCE_ID && signup.data.status === "waitlisted");
    expect(waitlisted.map((signup) => signup.id).sort()).toEqual(full.waitlist.map((entry) => entry.signupId).sort());
    expect(full.start.toMillis()).toBeGreaterThan(NOW_MS + 2 * HOUR_MS);
  });

  it("has past finalized shifts and one valid letter with its public verification", () => {
    expect(docsIn<InstanceDoc>("instances").filter((instance) => instance.data.status === "finalized").length).toBeGreaterThanOrEqual(8);
    const letters = docsIn<LetterDoc>("letters");
    expect(letters).toHaveLength(1);
    const letter = letters[0]!.data;
    expect(letter).toMatchObject({ uid: VOLUNTEER.uid, status: "valid", verifyCode: "ABCDEFGHIJKLMNOPQRSTUVWXYZ" });
    expect(letter.evidence.totalMinutes).toBeGreaterThan(0);
    expect(letter.evidence.excludedUnverifiedMinutes).toBeGreaterThan(0);
    expect(docAt<{ status: string; totalMinutes: number }>(`letterVerifications/${letter.verifyCode}`)).toMatchObject({ status: "valid", totalMinutes: letter.evidence.totalMinutes });
  });

  it("hides the minor's contact snapshot at the unverified org and nowhere else", () => {
    const samContacts = docsIn<SignupContactDoc>("signupContacts").filter((contact) => contact.data.uid === MINOR.uid);
    const hidden = samContacts.filter((contact) => contact.data.hidden);
    expect(hidden).toHaveLength(1);
    expect(hidden[0]?.data.fullName).toBeUndefined();
    expect(hidden[0]?.data.email).toBeUndefined();
    expect(samContacts.filter((contact) => !contact.data.hidden).every((contact) => contact.data.fullName === "Sam Lee")).toBe(true);
  });

  it("uses titles that never contain one another (text matches in the demo find one shift)", () => {
    const titles = [...new Set(docsIn<InstanceDoc>("instances").map((instance) => instance.data.title))];
    const overlapping = titles.filter((title) => titles.some((other) => other !== title && other.toLowerCase().includes(title.toLowerCase())));
    expect(overlapping).toEqual([]);
  });
});

describe("Tier 1 inbox for the demo volunteer", () => {
  it("has two unread hours-approved alerts for Jordan's latest shifts, so the badge shows", () => {
    const alerts = seed.writes.filter((write) => write.path.startsWith(`notifications/${VOLUNTEER.uid}/items/`));
    expect(alerts).toHaveLength(2);
    alerts.forEach((write) => {
      const alert = write.data as NotificationDoc;
      expect(alert).toMatchObject({ type: "hours-approved", read: false, link: "/impact" });
      expect(alert.createdAt.toMillis()).toBeLessThanOrEqual(NOW_MS);
      expect(write.path).toMatch(/\/items\/hours-approved_/);
    });
    expect(seed.writes.some((write) => write.path.startsWith("notifications/") && !write.path.startsWith(`notifications/${VOLUNTEER.uid}/`))).toBe(false);
  });

  it("saves one organization for Jordan", () => {
    const saved = seed.writes.filter((write) => write.path.startsWith(`users/${VOLUNTEER.uid}/saved/`));
    expect(saved.map((write) => write.path)).toEqual([`users/${VOLUNTEER.uid}/saved/org_common-table-pantry`]);
  });

  it("puts the demo volunteer's ZIP on the map and the orgs at their ZIP centroids", () => {
    expect(docAt<PrivateProfileDoc>(`users/${VOLUNTEER.uid}/private/profile`)).toMatchObject({ zip: "78204", homeGeohash: "9v1zq" });
    docsIn<OrganizationDoc>("organizations").forEach(({ data }) => expect(data.geo?.geohash).toHaveLength(5));
  });
});

describe("printed links", () => {
  const router = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "src", "router.tsx"), "utf8");
  /** Each printed path and the router path literals that serve it. */
  const ROUTES: Record<string, readonly string[]> = {
    Explore: ['"explore"'],
    "Shift page": ['"opportunity/:instanceId"'],
    "My Shifts": ['"me/shifts"'],
    "Impact and letters": ['"impact"'],
    Coordinator: ['"org/:orgId"', '"dashboard"'],
    Kiosk: ['"org/:orgId/kiosk/:instanceId"'],
    Admin: ['"admin"'],
    "Past letter": ['"verify/:code"']
  };

  it("prints only links to routes that exist in src/router.tsx", () => {
    for (const link of demoLinks("CODE")) {
      const literals = ROUTES[link.label];
      expect(literals, `no route mapping for ${link.label}`).toBeDefined();
      for (const literal of literals ?? []) expect(router, `${link.label} needs ${literal}`).toContain(`path: ${literal}`);
      const pattern = new RegExp(`^/${(literals ?? []).map((literal) => literal.slice(1, -1)).join("/").replace(/:[A-Za-z]+/g, "[^/]+")}$`);
      expect(link.path).toMatch(pattern);
    }
  });

  it("formats the credentials table and the links", () => {
    const text = formatSeedSummary({
      projectId: "demo-fbla2027",
      accounts: seed.accounts,
      password: "pw",
      appUrl: "http://localhost:5173",
      emulatorUiUrl: "http://localhost:4000",
      demoShiftStartMs: seed.demoShiftStartMs,
      shiftStartsInMs: 10 * 60_000,
      letterVerifyCode: "CODE",
      letterPdfStatus: "ready"
    });
    expect(text).toContain("volunteer@demo.fbla2027.test");
    expect(text).toContain("http://localhost:5173/opportunity/demo-shift");
    expect(text).toContain("http://localhost:5173/verify/CODE");
    expect(text).not.toContain("2014");
  });
});

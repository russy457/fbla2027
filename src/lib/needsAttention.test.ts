/**
 * needsAttention.test.ts
 * Grouping of the Needs attention queue (SPEC 9.8): logs and disputes by
 * shift, manual entries in their own group, names from signups or the log,
 * and "Approve all" limited to needsReview shift logs.
 */
import { describe, expect, it } from "vitest";
import { ts } from "@/test/fixtures";
import { FALLBACK_NAME, MANUAL_GROUP_TITLE, buildAttentionGroups, hoursLabel, type AttentionLogInput, type AttentionSignupInput } from "./needsAttention";

const log = (overrides: Partial<AttentionLogInput>): AttentionLogInput => ({
  id: "s1_u1",
  uid: "u1",
  instanceId: "s1",
  signupId: "s1_u1",
  source: "finalize",
  minutes: 120,
  needsReview: true,
  description: null,
  date: ts(0),
  ...overrides
});

const signup = (overrides: Partial<AttentionSignupInput>): AttentionSignupInput => ({
  id: "s1_u1",
  uid: "u1",
  instanceId: "s1",
  displayName: "Jordan R.",
  status: "no-show",
  instanceStart: ts(0),
  instanceEnd: ts(4 * 3_600_000),
  disputeOpen: false,
  dispute: null,
  ...overrides
});

const shifts = [
  { id: "s1", title: "Sort food", timeZone: "America/Chicago", start: ts(2000) },
  { id: "s2", title: "Read", timeZone: "America/Chicago", start: ts(1000) }
];

describe("buildAttentionGroups", () => {
  it("groups by shift, sorted by start, manual entries last", () => {
    const groups = buildAttentionGroups(
      [
        log({}),
        log({ id: "s2_u2", uid: "u2", instanceId: "s2", signupId: "s2_u2" }),
        log({ id: "manual_x", instanceId: null, signupId: null, source: "manual", needsReview: false, displayName: "Sam L." })
      ],
      [],
      [signup({})],
      shifts
    );
    expect(groups.map((group) => group.title)).toEqual(["Read", "Sort food", MANUAL_GROUP_TITLE]);
    expect(groups[1]?.items[0]).toMatchObject({ kind: "log", name: "Jordan R." });
    expect(groups[0]?.items[0]).toMatchObject({ name: FALLBACK_NAME });
    expect(groups[2]?.items[0]).toMatchObject({ name: "Sam L." });
    expect(groups[2]?.approvableLogIds).toEqual([]);
  });

  it("approve all only covers needsReview logs; disputes join their shift", () => {
    const groups = buildAttentionGroups(
      [log({}), log({ id: "s1_u3", signupId: "s1_u3", needsReview: false })],
      [signup({ id: "s1_u9", displayName: "Ana T.", disputeOpen: true, dispute: { note: "I was there" } })],
      [],
      shifts
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]?.approvableLogIds).toEqual(["s1_u1"]);
    expect(groups[0]?.items[2]).toMatchObject({ kind: "dispute", name: "Ana T.", note: "I was there", scheduledMinutes: 240 });
  });

  it("uses a fallback title for an unknown shift", () => {
    expect(buildAttentionGroups([log({ instanceId: "gone" })], [], [], [])[0]?.title).toBe("Shift");
  });
});

describe("hoursLabel", () => {
  it("formats singular and plural", () => {
    expect(hoursLabel(60)).toBe("1 hour");
    expect(hoursLabel(90)).toBe("1.5 hours");
    expect(hoursLabel(0)).toBe("0 hours");
  });
});

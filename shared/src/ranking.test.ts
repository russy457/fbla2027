/**
 * ranking.test.ts
 * Coordinator ranking (SPEC 8.4): who is eligible (past or discoverable,
 * minAge on the shift date, minors only at verified orgs), score = match x
 * reliability (0.8 when new), "why" chips, stable order, and the 20 cap.
 */
import { fromZonedTime } from "date-fns-tz";
import { describe, expect, it } from "vitest";
import { MAX_RANKED_CANDIDATES, isRankEligible, rankCandidates, type RankCandidate, type RankTarget } from "./ranking";
import { shiftInviteKey, shiftInviteNotification } from "./notifications";
import type { Availability } from "./schemas/userDocs";

const SAT_9AM = fromZonedTime("2026-10-17T09:00:00", "America/Chicago").getTime();
const none = { morning: false, afternoon: false, evening: false };
const saturdayMornings: Availability = { mon: none, tue: none, wed: none, thu: none, fri: none, sat: { ...none, morning: true }, sun: none };

const target: RankTarget = {
  causeArea: "hunger-food-security",
  skills: ["Lifting"],
  startMs: SAT_9AM,
  timeZone: "America/Chicago",
  geohash: "9v1zv",
  isVirtual: false,
  minAge: 13,
  orgVerified: true
};

const person = (key: string, overrides: Partial<RankCandidate> = {}): RankCandidate => ({
  key,
  displayName: `${key} R.`,
  birthDate: "2000-01-01",
  profile: { interests: ["hunger-food-security"], skills: [], availability: null, homeGeohash: null },
  reliability: { score: null, isNew: true },
  pastVolunteer: false,
  discoverable: true,
  ...overrides
});

describe("isRankEligible", () => {
  it.each([
    ["discoverable adult", person("a"), target, true],
    ["past volunteer who is not discoverable", person("a", { discoverable: false, pastVolunteer: true }), target, true],
    ["neither past nor discoverable", person("a", { discoverable: false }), target, false],
    ["under the shift's minimum age on its date", person("a", { birthDate: "2010-10-18" }), { ...target, minAge: 16 }, false],
    ["turns 16 on the shift date", person("a", { birthDate: "2010-10-17" }), { ...target, minAge: 16 }, true],
    ["minor at a verified org", person("a", { birthDate: "2011-05-01" }), target, true],
    ["minor at an unverified org", person("a", { birthDate: "2011-05-01" }), { ...target, orgVerified: false }, false],
    ["adult at an unverified org", person("a"), { ...target, orgVerified: false }, true]
  ])("%s", (_name, candidate, shift, expected) => {
    expect(isRankEligible(candidate, shift)).toBe(expected);
  });
});

describe("rankCandidates", () => {
  it("multiplies the match score by reliability, using 0.8 for new volunteers", () => {
    const ranked = rankCandidates([person("new"), person("steady", { reliability: { score: 1, isNew: false } }), person("shaky", { reliability: { score: 0.5, isNew: false } })], target);
    expect(ranked.map((candidate) => [candidate.key, candidate.score])).toEqual([
      ["steady", 0.4],
      ["new", 0.32],
      ["shaky", 0.2]
    ]);
  });

  it("explains every match signal and a past shift, never reliability", () => {
    const [top] = rankCandidates(
      [
        person("a", {
          pastVolunteer: true,
          reliability: { score: 1, isNew: false },
          profile: { interests: ["hunger-food-security"], skills: ["lifting"], availability: saturdayMornings, homeGeohash: "9v1zv" }
        })
      ],
      target
    );
    expect(top?.score).toBe(1);
    expect(top?.why.map((reason) => reason.kind)).toEqual(["interest", "skills", "availability", "nearby", "past-volunteer"]);
  });

  it("drops candidates with no signal unless they volunteered here before", () => {
    const blank = { interests: [], skills: [], availability: null, homeGeohash: null };
    const ranked = rankCandidates([person("stranger", { profile: blank }), person("regular", { profile: blank, pastVolunteer: true })], target);
    expect(ranked).toEqual([{ key: "regular", displayName: "regular R.", score: 0, why: [{ kind: "past-volunteer" }] }]);
  });

  it("orders ties by display name, then key, and leaves out ineligible people", () => {
    const ranked = rankCandidates([person("b", { displayName: "Ana T." }), person("a", { displayName: "Ana T." }), person("c", { displayName: "Abe L." }), person("x", { discoverable: false })], target);
    expect(ranked.map((candidate) => candidate.key)).toEqual(["c", "a", "b"]);
  });

  it("returns at most 20 by default, or the given limit", () => {
    const many = Array.from({ length: 30 }, (_value, index) => person(`p${String(index).padStart(2, "0")}`));
    expect(rankCandidates(many, target)).toHaveLength(MAX_RANKED_CANDIDATES);
    expect(rankCandidates(many, target, 3)).toHaveLength(3);
  });
});

describe("shiftInviteNotification", () => {
  it("names the org and shift and links to the shift", () => {
    const content = shiftInviteNotification({ instanceId: "s1_20261017", title: "Saturday sort", orgName: "Common Table Pantry", startMs: SAT_9AM, timeZone: "America/Chicago" });
    expect(content).toMatchObject({
      type: "shift-invite",
      title: "Common Table Pantry invited you to Saturday sort",
      link: "/opportunity/s1_20261017",
      data: { instanceId: "s1_20261017" }
    });
    expect(content.body).toContain("Sat, Oct 17, 9:00 AM CDT");
    expect(shiftInviteKey("s1", "u1")).toBe("s1_u1");
  });
});

/**
 * tier2LaneB.test.ts
 * Pure client helpers of Tier 2 lane B: collection item rows (next shift,
 * unverified orgs, missing targets, counts), the curator credit, and the AI
 * planner pre-fill (description added and highlighted, the source note).
 */
import { describe, expect, it } from "vitest";
import { parsePlannerText, type OrganizationDoc } from "@fbla/shared";
import { ADMIN_CURATOR, curatorName } from "@/components/collections/curatorName";
import { MISSING_OPPORTUNITY, MISSING_ORG, collectionCountText, resolveCollectionItems } from "@/lib/collectionItems";
import type { Opportunity } from "@/lib/data/opportunities";
import type { Organization } from "@/lib/data/orgs";
import { aiSourceNote, prefillFromAi } from "@/lib/plannerAiPrefill";
import { SHIFT_START_MS, makeInstance, ts } from "@/test/fixtures";

const opportunity = (id: string, extra: Partial<Opportunity> = {}): Opportunity =>
  ({ id, orgId: "org-1", orgName: "Common Table Pantry", orgVerified: true, title: "Sort food", description: "Sort donations.", status: "active", ...extra }) as Opportunity;
const org = (id: string, extra: Partial<OrganizationDoc> = {}): Organization =>
  ({ id, name: "Common Table Pantry", mission: "Feed families.", verified: false, archived: false, ...extra }) as Organization;

describe("resolveCollectionItems", () => {
  const sources = {
    opportunities: [opportunity("opp-1"), opportunity("opp-2", { description: "", orgVerified: false })],
    orgs: [org("org-1"), org("org-gone", { archived: true })],
    instances: [
      makeInstance({ id: "late", opportunityId: "opp-1", start: ts(SHIFT_START_MS + 86_400_000) }),
      makeInstance({ id: "soon", opportunityId: "opp-1" }),
      makeInstance({ id: "past", opportunityId: "opp-1", start: ts(0) }),
      makeInstance({ id: "cancelled", opportunityId: "opp-2", status: "cancelled" })
    ],
    nowMs: SHIFT_START_MS - 1000
  };

  it("links shifts to their next date and orgs to their page", () => {
    const rows = resolveCollectionItems(
      [
        { kind: "opportunity", refId: "opp-1" },
        { kind: "opportunity", refId: "opp-2" },
        { kind: "org", refId: "org-1" }
      ],
      sources
    );
    expect(rows[0]).toMatchObject({ title: "Sort food", href: "/opportunity/soon", verified: true, next: { instanceId: "soon" } });
    expect(rows[1]).toMatchObject({ href: null, detail: null, next: null, verified: false, missing: false });
    expect(rows[2]).toMatchObject({ title: "Common Table Pantry", href: "/organizations/org-1", detail: "Feed families.", verified: false });
  });

  it("keeps missing targets as unlinked rows", () => {
    const rows = resolveCollectionItems(
      [
        { kind: "opportunity", refId: "gone" },
        { kind: "org", refId: "org-gone" }
      ],
      sources
    );
    expect(rows.map((row) => [row.title, row.href, row.missing])).toEqual([
      [MISSING_OPPORTUNITY, null, true],
      [MISSING_ORG, null, true]
    ]);
  });

  it("counts shifts and organizations in words", () => {
    expect(collectionCountText([])).toBe("Empty");
    expect(collectionCountText([{ kind: "opportunity", refId: "a" }])).toBe("1 shift");
    expect(collectionCountText([{ kind: "opportunity", refId: "a" }, { kind: "opportunity", refId: "b" }, { kind: "org", refId: "c" }])).toBe("2 shifts and 1 organization");
  });

  it("credits the org or the app team, never a person", () => {
    const names = new Map([["org-1", "Common Table Pantry"]]);
    expect(curatorName("org-1", names)).toBe("Common Table Pantry");
    expect(curatorName(null, names)).toBe(ADMIN_CURATOR);
    expect(curatorName("org-x", names)).toBe("a local organization");
  });
});

describe("prefillFromAi", () => {
  const draft = parsePlannerText("need 12 people Sat 9-1 sorting at the food bank", { referenceDate: "2026-10-14" });

  it("adds the AI description to the pre-fill and highlights it", () => {
    const prefill = prefillFromAi({ draft, description: "Help sort food.", source: "ai", limited: false });
    expect(prefill.description).toBe("Help sort food.");
    expect(prefill.filled.has("description")).toBe(true);
    expect(prefill.filled.has("capacity")).toBe(true);
  });

  it("is the plain parser pre-fill without a description", () => {
    const prefill = prefillFromAi({ draft, description: null, source: "parser", limited: false });
    expect(prefill.description).toBeUndefined();
    expect(prefill.filled.has("description")).toBe(false);
  });

  it("explains who drafted it", () => {
    expect(aiSourceNote({ source: "ai", limited: false })).toMatch(/Drafted with AI/);
    expect(aiSourceNote({ source: "parser", limited: true })).toMatch(/AI limit/);
    expect(aiSourceNote({ source: "parser", limited: false })).toMatch(/isn't available/);
  });
});

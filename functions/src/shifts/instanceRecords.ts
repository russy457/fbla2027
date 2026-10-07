/**
 * instanceRecords.ts
 * Builders for a new shift (SPEC#dm-instances) and its kiosk key material
 * (SPEC 3.9), shared by createInstance (one dated shift) and the series
 * materializer (Tier 2), so a series shift is the same document a coordinator
 * would create by hand. Title, org name, verified flag, minimum age, and the
 * org time zone are denormalized so Explore and My Shifts render from one
 * document.
 */
import { randomBytes } from "node:crypto";
import { DEFAULT_TIME_ZONE, type AppConfig, type InstanceDoc, type InstanceSecretDoc, type OpportunityDoc, type OrganizationDoc } from "@fbla/shared";
import { ts } from "../lib/firestore";
import { jobTimesFor, type ShiftTimesMs } from "./instanceTimes";

const SALT_BYTES = 32;

export interface NewInstanceParams {
  readonly opportunityId: string;
  readonly opportunity: Pick<OpportunityDoc, "orgId" | "title" | "minAge">;
  readonly org: Pick<OrganizationDoc, "name" | "verified" | "timeZone">;
  readonly seriesId: string | null;
  readonly times: ShiftTimesMs;
  readonly capacity: number;
  readonly config: AppConfig;
  readonly nowMs: number;
}

export const newInstanceDoc = (params: NewInstanceParams): InstanceDoc => {
  const jobTimes = jobTimesFor(params.times, params.config);
  const at = ts(params.nowMs);
  return {
    orgId: params.opportunity.orgId,
    opportunityId: params.opportunityId,
    seriesId: params.seriesId,
    title: params.opportunity.title,
    orgName: params.org.name,
    orgVerified: params.org.verified,
    minAge: params.opportunity.minAge,
    timeZone: params.org.timeZone || DEFAULT_TIME_ZONE,
    ...jobTimes,
    capacity: params.capacity,
    signupCount: 0,
    waitlist: [],
    waitlistSeq: 0,
    checkedInCount: 0,
    status: "scheduled",
    cutoffDoneAt: null,
    finalizedAt: null,
    nextActionAt: jobTimes.cutoffAt,
    sequence: 0,
    cancelledAt: null,
    cancelledBy: null,
    cancelReason: null,
    createdAt: at,
    updatedAt: at
  };
};

/** 32 random salt bytes, key version 1 (the kiosk key is derived from it, SPEC 5.10). */
export const newInstanceSecret = (nowMs: number): InstanceSecretDoc => ({
  salt: randomBytes(SALT_BYTES).toString("base64"),
  keyVersion: 1,
  createdAt: ts(nowMs),
  updatedAt: ts(nowMs)
});

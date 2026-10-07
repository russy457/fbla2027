/**
 * rankTarget.ts
 * What a ranking matches against (SPEC 8.4): for a real shift, its listing's
 * cause, skills, and place plus the shift's time, zone, minimum age, and the
 * org's verified flag; for a draft (the planner, before the shift exists),
 * the draft's fields and the organization's own place and zone.
 * Also the rate limits for the two ranking ops (SPEC Appendix B 47 style).
 */
import type { Firestore } from "firebase-admin/firestore";
import {
  AppError,
  COLLECTIONS,
  DEFAULT_TIME_ZONE,
  type InstanceDoc,
  type OpportunityDoc,
  type OrganizationDoc,
  type RankDraft,
  type RankTarget
} from "@fbla/shared";
import type { Loaded } from "../lib/auth";
import { msOf, readDoc } from "../lib/firestore";
import type { RateLimitRule } from "../lib/rateLimit";

const DEFAULT_MIN_AGE = 13;

/** rankVolunteers reads hundreds of documents: 60 rankings per coordinator per hour. */
export const RANK_RATE_LIMIT: RateLimitRule = { bucket: "rankVolunteers", max: () => 60, windowSec: () => 3600 };

/** inviteVolunteers sends up to 20 alerts per call: 20 calls per coordinator per hour. */
export const INVITE_RATE_LIMIT: RateLimitRule = { bucket: "inviteVolunteers", max: () => 20, windowSec: () => 3600 };

export const instanceRankTarget = async (db: Firestore, instance: Loaded<InstanceDoc>): Promise<RankTarget> => {
  const opportunity = readDoc<OpportunityDoc>(await db.collection(COLLECTIONS.opportunities).doc(instance.data.opportunityId).get());
  if (opportunity === null) throw new AppError("NOT_FOUND");
  return {
    causeArea: opportunity.causeArea,
    skills: opportunity.skills,
    startMs: msOf(instance.data.start),
    timeZone: instance.data.timeZone,
    geohash: opportunity.location?.geo?.geohash ?? null,
    isVirtual: opportunity.type === "virtual",
    minAge: instance.data.minAge,
    orgVerified: instance.data.orgVerified
  };
};

export const draftRankTarget = (org: OrganizationDoc, draft: RankDraft): RankTarget => ({
  causeArea: draft.causeArea,
  skills: draft.skills,
  startMs: Date.parse(draft.start),
  timeZone: org.timeZone || DEFAULT_TIME_ZONE,
  geohash: org.geo?.geohash ?? null,
  isVirtual: false,
  minAge: draft.minAge ?? DEFAULT_MIN_AGE,
  orgVerified: org.verified
});

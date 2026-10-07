/**
 * rankVolunteers.ts
 * coordinator.rankVolunteers (Tier 2, SPEC 5.2, 8.4, H2): the coordinator of
 * a shift's org (or, for a planner draft, of the org) gets up to 20 people to
 * invite, best first. Deterministic, no AI: shared/ranking.ts scores match x
 * reliability over past volunteers and discoverable people, with the age and
 * minor rules applied on the shift date.
 *
 * Privacy: the response holds display names (first name + last initial), a
 * score, "why" chips, and a sealed ref per person, never a uid, contact,
 * birth date, or location (ranking/rankRefs.ts). People already on the shift
 * and the caller are left out. Read-only apart from the rate-limit counter.
 */
import { COLLECTIONS, RANK_REF_TTL_MS, rankCandidates, type SignupDoc } from "@fbla/shared";
import { coordinatorOf } from "../lib/auth";
import { defineCallable } from "../lib/defineCallable";
import { rankResource } from "../lib/seriesAuth";
import { loadRankCandidates } from "../ranking/candidates";
import { sealRankRef } from "../ranking/rankRefs";
import { RANK_RATE_LIMIT, draftRankTarget, instanceRankTarget } from "../ranking/rankTarget";

export const rankVolunteers = defineCallable({
  endpoint: "coordinator",
  op: "rankVolunteers",
  auth: coordinatorOf(rankResource()),
  rateLimit: RANK_RATE_LIMIT,
  handler: async ({ caller, clock, deps, resource }) => {
    const { db, env } = deps;
    const nowMs = clock.nowMs();
    const excluded = new Set([caller.uid]);
    if (resource.kind === "instance") {
      // Anyone with a signup doc for this shift, active or cancelled, cannot sign up again.
      const onShift = await db.collection(COLLECTIONS.signups).where("instanceId", "==", resource.instance.id).get();
      onShift.docs.forEach((doc) => excluded.add((doc.data() as SignupDoc).uid));
    }
    const target = resource.kind === "instance" ? await instanceRankTarget(db, resource.instance) : draftRankTarget(resource.org.data, resource.draft);
    // The org comes from the stored shift or organization, never from client input (G2).
    const ownerOrg = resource.kind === "instance" ? resource.instance.data.orgId : resource.org.id;
    const ranked = rankCandidates(await loadRankCandidates(db, ownerOrg, excluded), target);
    const expMs = nowMs + RANK_REF_TTL_MS;
    return {
      candidates: ranked.map((candidate) => ({
        ref: sealRankRef(env.kioskMasterSecret, { uid: candidate.key, orgId: ownerOrg, expMs }),
        displayName: candidate.displayName,
        score: candidate.score,
        // Copy the read-only skill lists into the plain arrays the output schema describes.
        why: candidate.why.map((reason) => (reason.kind === "skills" ? { kind: "skills" as const, skills: [...reason.skills] } : reason))
      })),
      refExpiresAt: new Date(expMs).toISOString()
    };
  }
});

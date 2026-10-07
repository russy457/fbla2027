/**
 * tier2LaneA.ts
 * Tier 2 lane A ops, grouped per endpoint so each endpoint table adds them
 * with one spread (SPEC 2.3, G4): recurring series (upsertSeries,
 * extendSeries), whole-series signup (signupSeries, extendSeriesSignup), and
 * volunteer ranking with invites (rankVolunteers, inviteVolunteers). Every
 * coordinator op derives its org from the target resource, never from input.
 */
import type { RegisteredOp } from "../lib/defineCallable";
import { extendSeries } from "../ops/extendSeries";
import { extendSeriesSignup } from "../ops/extendSeriesSignup";
import { inviteVolunteers } from "../ops/inviteVolunteers";
import { rankVolunteers } from "../ops/rankVolunteers";
import { signupSeries } from "../ops/signupSeries";
import { upsertSeries } from "../ops/upsertSeries";

export const tier2LaneAVolunteerOps: readonly RegisteredOp[] = [signupSeries, extendSeriesSignup];

export const tier2LaneACoordinatorOps: readonly RegisteredOp[] = [upsertSeries, extendSeries, rankVolunteers, inviteVolunteers];

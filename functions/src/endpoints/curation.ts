/**
 * curation.ts
 * Tier 2 lane B curated collection ops, grouped per endpoint so each endpoint
 * table adds them with one spread (SPEC 2.3, G4, SPEC 3.19): coordinators
 * manage their org's collections (org derived from the stored collection),
 * admins manage the app-wide ones (orgId null). Clients never write
 * collections directly; firestore.rules deny it.
 */
import type { RegisteredOp } from "../lib/defineCallable";
import { deleteAdminCollection, deleteCollection } from "../ops/deleteCollection";
import { publishAdminCollection, publishCollection } from "../ops/publishCollection";
import { upsertAdminCollection, upsertCollection } from "../ops/upsertCollection";

export const curationCoordinatorOps: readonly RegisteredOp[] = [upsertCollection, publishCollection, deleteCollection];

export const curationAdminOps: readonly RegisteredOp[] = [upsertAdminCollection, publishAdminCollection, deleteAdminCollection];

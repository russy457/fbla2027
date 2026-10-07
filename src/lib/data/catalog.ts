/**
 * catalog.ts
 * The active opportunities (public read), for Explore's recommendations and
 * smart filters: an instance carries title and time, but the cause area,
 * skills, type, and location live on its opportunity (SPEC#dm-opportunities).
 * One equality filter, so the automatic single-field index serves it.
 */
import { collection, limit, query, where } from "firebase/firestore";
import { COLLECTIONS, opportunityDocSchema } from "@fbla/shared";
import { getFirebase } from "../firebase";
import { listenToQuery } from "./listen";
import type { Opportunity } from "./opportunities";

/** Far above demo scale; Explore shows at most 50 shifts anyway. */
const CATALOG_LIMIT = 200;

export const listenToActiveOpportunities = (onData: (opportunities: Opportunity[]) => void, onError: (error: Error) => void): (() => void) =>
  listenToQuery(
    query(collection(getFirebase().db, COLLECTIONS.opportunities), where("status", "==", "active"), limit(CATALOG_LIMIT)),
    opportunityDocSchema,
    onData,
    onError
  );

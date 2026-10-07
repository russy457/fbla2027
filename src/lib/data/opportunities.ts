/**
 * opportunities.ts
 * Reads of opportunities (SPEC#dm-opportunities; public per SPEC#rules-matrix).
 * The Opportunity screen reads one for its description and place; the shift
 * itself (date, time, seats) comes from the live instance document.
 */
import { doc, getDoc } from "firebase/firestore";
import { COLLECTIONS, opportunityDocSchema, type OpportunityDoc } from "@fbla/shared";
import { getFirebase } from "../firebase";
import { parseDocSnapshot, type WithId } from "./parse";

export type Opportunity = WithId<OpportunityDoc>;

export const getOpportunity = async (opportunityId: string): Promise<Opportunity | null> =>
  parseDocSnapshot(opportunityDocSchema, await getDoc(doc(getFirebase().db, COLLECTIONS.opportunities, opportunityId)));

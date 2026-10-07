/**
 * refreshOrgDenormals.ts
 * Keeps copies of organization facts in step after an org edit or an admin
 * verification change (SPEC 5.8, 3.6, 3.8, T4):
 *   - orgName / orgVerified on every opportunity and every instance that has
 *     not started yet,
 *   - T4 contact hiding on open (non-frozen) contact snapshots: a minor at an
 *     unverified org has hidden: true and no PII fields; when the org becomes
 *     verified the PII is restored from the volunteer's private profile.
 * Writes go out in batches of at most BATCH_LIMIT and only where a value differs.
 */
import { FieldValue, type DocumentReference, type Firestore } from "firebase-admin/firestore";
import {
  COLLECTIONS,
  PATHS,
  type InstanceDoc,
  type OpportunityDoc,
  type PrivateProfileDoc,
  type SignupContactDoc
} from "@fbla/shared";
import { readDoc, ts } from "../lib/firestore";

const BATCH_LIMIT = 400;

interface PendingWrite {
  readonly ref: DocumentReference;
  readonly data: Record<string, unknown>;
}

const commitAll = async (db: Firestore, writes: readonly PendingWrite[]): Promise<void> => {
  for (let index = 0; index < writes.length; index += BATCH_LIMIT) {
    const batch = db.batch();
    writes.slice(index, index + BATCH_LIMIT).forEach((write) => batch.update(write.ref, write.data));
    await batch.commit();
  }
};

export interface OrgFacts {
  readonly orgId: string;
  readonly name: string;
  readonly verified: boolean;
}

/** Copies the org name and verified flag onto opportunities and future instances. */
const refreshListings = async (db: Firestore, facts: OrgFacts, nowMs: number): Promise<number> => {
  const [opportunities, instances] = await Promise.all([
    db.collection(COLLECTIONS.opportunities).where("orgId", "==", facts.orgId).get(),
    db.collection(COLLECTIONS.instances).where("orgId", "==", facts.orgId).get()
  ]);
  const stale = (data: { orgName: string; orgVerified: boolean }): boolean => data.orgName !== facts.name || data.orgVerified !== facts.verified;
  const patch = { orgName: facts.name, orgVerified: facts.verified, updatedAt: ts(nowMs) };
  const writes: PendingWrite[] = [
    ...opportunities.docs.filter((doc) => stale(doc.data() as OpportunityDoc)).map((doc) => ({ ref: doc.ref, data: patch })),
    ...instances.docs
      .filter((doc) => {
        const instance = doc.data() as InstanceDoc;
        return instance.start.toMillis() > nowMs && stale(instance);
      })
      .map((doc) => ({ ref: doc.ref, data: patch }))
  ];
  await commitAll(db, writes);
  return writes.length;
};

/** Re-applies T4 hiding to the org's open contact snapshots. */
const refreshContacts = async (db: Firestore, facts: OrgFacts, nowMs: number): Promise<number> => {
  const open = await db.collection(COLLECTIONS.signupContacts).where("orgId", "==", facts.orgId).where("frozen", "==", false).get();
  const writes: PendingWrite[] = [];
  for (const doc of open.docs) {
    const contact = doc.data() as SignupContactDoc;
    const shouldHide = contact.isMinor && !facts.verified;
    if (shouldHide === contact.hidden) continue;
    if (shouldHide) {
      writes.push({
        ref: doc.ref,
        data: { hidden: true, fullName: FieldValue.delete(), email: FieldValue.delete(), phone: FieldValue.delete(), refreshedAt: ts(nowMs), updatedAt: ts(nowMs) }
      });
      continue;
    }
    const profile = readDoc<PrivateProfileDoc>(await db.doc(PATHS.privateProfile(contact.uid)).get());
    if (profile === null) continue;
    writes.push({
      ref: doc.ref,
      data: { hidden: false, fullName: profile.fullName, email: profile.email, phone: profile.phone, refreshedAt: ts(nowMs), updatedAt: ts(nowMs) }
    });
  }
  await commitAll(db, writes);
  return writes.length;
};

export interface RefreshResult {
  readonly listings: number;
  readonly contacts: number;
}

/** Refreshes every denormalized copy of the org's name and verified flag. */
export const refreshOrgDenormals = async (db: Firestore, facts: OrgFacts, nowMs: number, verifiedChanged: boolean): Promise<RefreshResult> => ({
  listings: await refreshListings(db, facts, nowMs),
  contacts: verifiedChanged ? await refreshContacts(db, facts, nowMs) : 0
});

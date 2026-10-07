/**
 * refreshOrgDenormals.ts
 * Keeps copies of organization facts in step after an org edit or an admin
 * verification change (SPEC 5.8, 3.6, 3.8, T4):
 *   - orgName / orgVerified on every opportunity and every instance that has
 *     not started yet,
 *   - T4 contact hiding on open (non-frozen) contact snapshots: a minor at an
 *     unverified org has hidden: true and no PII fields; when the org becomes
 *     verified the PII is restored from the volunteer's private profile.
 * Writes go out in chunks of at most BATCH_LIMIT and only where a value
 * differs, so a pass is idempotent: running it again after a partial
 * failure only writes what is still wrong.
 *
 * Contact chunks commit in a transaction that re-reads the org: if its
 * verified flag no longer matches the pass's target (a newer change landed
 * mid-pass), the pass stops with complete: false instead of writing the
 * outdated state. Pending repairs are tracked by contactRefreshJob.ts, which
 * only clears its job after a pass returns complete: true.
 */
import { FieldValue, type DocumentReference, type Firestore } from "firebase-admin/firestore";
import {
  COLLECTIONS,
  PATHS,
  type InstanceDoc,
  type OpportunityDoc,
  type OrganizationDoc,
  type PrivateProfileDoc,
  type SignupContactDoc
} from "@fbla/shared";
import { readDoc, runTx, ts } from "../lib/firestore";

const BATCH_LIMIT = 400;

interface PendingWrite {
  readonly ref: DocumentReference;
  readonly data: Record<string, unknown>;
}

export interface OrgFacts {
  readonly orgId: string;
  readonly name: string;
  readonly verified: boolean;
}

export interface RefreshOptions {
  /** Writes per chunk; tests lower it to get several chunks from a few docs. */
  readonly chunkSize?: number;
  /** Test hook run before each contact chunk commits; throwing simulates a failed batch. */
  readonly beforeContactChunk?: (chunkIndex: number) => Promise<void> | void;
}

const chunksOf = <T>(items: readonly T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_unused, index) => items.slice(index * size, (index + 1) * size));

const commitAll = async (db: Firestore, writes: readonly PendingWrite[], chunkSize: number): Promise<void> => {
  for (const chunk of chunksOf(writes, chunkSize)) {
    const batch = db.batch();
    chunk.forEach((write) => batch.update(write.ref, write.data));
    await batch.commit();
  }
};

/** Copies the org name and verified flag onto opportunities and future instances. */
const refreshListings = async (db: Firestore, facts: OrgFacts, nowMs: number, chunkSize: number): Promise<number> => {
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
  await commitAll(db, writes, chunkSize);
  return writes.length;
};

/** The write that brings one contact snapshot to the target, or null when it already matches. */
const contactWrite = async (db: Firestore, ref: DocumentReference, contact: SignupContactDoc, verified: boolean, nowMs: number): Promise<PendingWrite | null> => {
  const shouldHide = contact.isMinor && !verified;
  if (shouldHide === contact.hidden) return null;
  if (shouldHide) {
    return { ref, data: { hidden: true, fullName: FieldValue.delete(), email: FieldValue.delete(), phone: FieldValue.delete(), refreshedAt: ts(nowMs), updatedAt: ts(nowMs) } };
  }
  const profile = readDoc<PrivateProfileDoc>(await db.doc(PATHS.privateProfile(contact.uid)).get());
  if (profile === null) return null;
  return { ref, data: { hidden: false, fullName: profile.fullName, email: profile.email, phone: profile.phone, refreshedAt: ts(nowMs), updatedAt: ts(nowMs) } };
};

interface ContactPass {
  readonly written: number;
  readonly complete: boolean;
}

/** Re-applies T4 hiding to the org's open contact snapshots, one guarded transaction per chunk. */
const refreshContacts = async (db: Firestore, facts: OrgFacts, nowMs: number, options: RefreshOptions): Promise<ContactPass> => {
  const open = await db.collection(COLLECTIONS.signupContacts).where("orgId", "==", facts.orgId).where("frozen", "==", false).get();
  const planned = await Promise.all(open.docs.map((doc) => contactWrite(db, doc.ref, doc.data() as SignupContactDoc, facts.verified, nowMs)));
  const writes = planned.filter((write): write is PendingWrite => write !== null);
  const orgRef = db.collection(COLLECTIONS.organizations).doc(facts.orgId);
  const chunks = chunksOf(writes, options.chunkSize ?? BATCH_LIMIT);
  let written = 0;
  for (const [index, chunk] of chunks.entries()) {
    await options.beforeContactChunk?.(index);
    const committed = await runTx(db, async (tx) => {
      const org = readDoc<OrganizationDoc>(await tx.get(orgRef));
      if (org === null || org.verified !== facts.verified) return false;
      chunk.forEach((write) => tx.update(write.ref, write.data));
      return true;
    });
    if (!committed) return { written, complete: false };
    written += chunk.length;
  }
  return { written, complete: true };
};

export interface RefreshResult {
  readonly listings: number;
  readonly contacts: number;
  /** False when a newer verified change overtook this pass; its own job finishes the work. */
  readonly complete: boolean;
}

/** Refreshes every denormalized copy of the org's name and verified flag. */
export const refreshOrgDenormals = async (
  db: Firestore,
  facts: OrgFacts,
  nowMs: number,
  verifiedChanged: boolean,
  options: RefreshOptions = {}
): Promise<RefreshResult> => {
  // Contacts first: hiding minors' details matters more than the listing badge.
  const contacts = verifiedChanged ? await refreshContacts(db, facts, nowMs, options) : { written: 0, complete: true };
  // An overtaken pass writes nothing more; the newer change's job owns the listings too.
  if (!contacts.complete) return { listings: 0, contacts: contacts.written, complete: false };
  const listings = await refreshListings(db, facts, nowMs, options.chunkSize ?? BATCH_LIMIT);
  return { listings, contacts: contacts.written, complete: contacts.complete };
};

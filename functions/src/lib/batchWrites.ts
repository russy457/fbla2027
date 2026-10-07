/**
 * batchWrites.ts
 * Commits a list of writes in WriteBatches of at most BATCH_LIMIT, for
 * fan-out work outside a transaction (a time change touching every signup
 * of a shift, plus one notification each). Firestore caps a batch at 500
 * writes; 400 leaves headroom.
 */
import type { Firestore, WriteBatch } from "firebase-admin/firestore";

const BATCH_LIMIT = 400;

/** One write, applied to whichever batch it lands in. */
export type BatchWrite = (batch: WriteBatch) => void;

export const commitInChunks = async (db: Firestore, writes: readonly BatchWrite[]): Promise<void> => {
  for (let index = 0; index < writes.length; index += BATCH_LIMIT) {
    const batch = db.batch();
    writes.slice(index, index + BATCH_LIMIT).forEach((write) => write(batch));
    await batch.commit();
  }
};

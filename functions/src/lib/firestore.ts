/**
 * firestore.ts
 * Small Firestore helpers shared by every op:
 *   - ts(): instants from the request clock become Timestamps (never
 *     FieldValue.serverTimestamp, SPEC 2.4), and isoOf() turns them back into
 *     ISO strings for callable responses.
 *   - runTx(): one Admin-SDK transaction with at most 3 attempts; contention
 *     that survives the retries becomes the catalog error CONTENTION (SPEC 5.1).
 *   - readDoc(): typed snapshot data or null.
 */
import { Timestamp, type DocumentSnapshot, type Firestore, type Transaction } from "firebase-admin/firestore";
import { AppError, type TimestampLike } from "@fbla/shared";

/** SPEC 5.1: contention is retried up to 3 times, then CONTENTION. */
const MAX_TX_ATTEMPTS = 3;
/** gRPC status ABORTED; Firestore uses it for transaction contention and lock timeouts. */
const GRPC_ABORTED = 10;

export const ts = (at: Date | number): Timestamp => Timestamp.fromMillis(at instanceof Date ? at.getTime() : at);

export const isoOf = (value: TimestampLike): string => value.toDate().toISOString();

export const msOf = (value: TimestampLike): number => value.toMillis();

/** Typed data of a snapshot, or null when the document does not exist. */
export const readDoc = <T>(snapshot: DocumentSnapshot): T | null => (snapshot.exists ? (snapshot.data() as T) : null);

const isContention = (error: unknown): boolean => {
  const code = (error as { code?: unknown } | null)?.code;
  return code === GRPC_ABORTED || code === "aborted" || code === "ABORTED";
};

export const runTx = async <T>(db: Firestore, work: (tx: Transaction) => Promise<T>): Promise<T> => {
  try {
    return await db.runTransaction(work, { maxAttempts: MAX_TX_ATTEMPTS });
  } catch (error) {
    if (isContention(error)) throw new AppError("CONTENTION");
    throw error;
  }
};

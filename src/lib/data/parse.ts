/**
 * parse.ts
 * Firestore documents are external data (coding rule: never trust it), so
 * every repository runs the shared zod schema on each document before a
 * screen sees it. A malformed document becomes a DataShapeError naming the
 * path, instead of a crash deep inside a component.
 */
import type { DocumentSnapshot, QuerySnapshot, SnapshotOptions } from "firebase/firestore";
import type { z } from "zod";

export class DataShapeError extends Error {
  constructor(path: string, detail: string) {
    super(`Document ${path} has an unexpected shape (${detail}).`);
    this.name = "DataShapeError";
  }
}

/** A parsed document with its id, so lists can key rows and link by id. */
export type WithId<T> = T & { readonly id: string };

const parseOne = <S extends z.ZodType>(schema: S, path: string, id: string, data: unknown): WithId<z.output<S>> => {
  const result = schema.safeParse(data);
  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join(".") || "(root)").join(", ");
    throw new DataShapeError(path, fields);
  }
  return { ...(result.data as object), id } as WithId<z.output<S>>;
};

/** Parses one snapshot; a missing document is null (not an error). */
export const parseDocSnapshot = <S extends z.ZodType>(schema: S, snapshot: DocumentSnapshot): WithId<z.output<S>> | null =>
  snapshot.exists() ? parseOne(schema, snapshot.ref.path, snapshot.id, snapshot.data()) : null;

/**
 * Parses every document of a query snapshot, in query order. `options`
 * (for example serverTimestamps: "estimate") lets a client-written
 * server timestamp read as a value before the server confirms it.
 */
export const parseQuerySnapshot = <S extends z.ZodType>(schema: S, snapshot: QuerySnapshot, options?: SnapshotOptions): Array<WithId<z.output<S>>> =>
  snapshot.docs.map((doc) => parseOne(schema, doc.ref.path, doc.id, doc.data(options)));

/**
 * listen.ts
 * Small adapters from Firestore listeners to the Subscribe signature used by
 * useLiveQuery: they parse each snapshot with a zod schema and route parse
 * failures to the error callback instead of throwing inside Firestore.
 */
import { onSnapshot, type DocumentReference, type Query, type SnapshotOptions } from "firebase/firestore";
import type { z } from "zod";
import { parseDocSnapshot, parseQuerySnapshot, type WithId } from "./parse";

type OnData<T> = (data: T) => void;
type OnError = (error: Error) => void;

const asError = (error: unknown): Error => (error instanceof Error ? error : new Error(String(error)));

export const listenToDoc = <S extends z.ZodType>(
  ref: DocumentReference,
  schema: S,
  onData: OnData<WithId<z.output<S>> | null>,
  onError: OnError
): (() => void) =>
  onSnapshot(
    ref,
    (snapshot) => {
      try {
        onData(parseDocSnapshot(schema, snapshot));
      } catch (error) {
        onError(asError(error));
      }
    },
    (error) => onError(asError(error))
  );

export const listenToQuery = <S extends z.ZodType>(
  source: Query,
  schema: S,
  onData: OnData<Array<WithId<z.output<S>>>>,
  onError: OnError,
  options?: SnapshotOptions
): (() => void) =>
  onSnapshot(
    source,
    (snapshot) => {
      try {
        onData(parseQuerySnapshot(schema, snapshot, options));
      } catch (error) {
        onError(asError(error));
      }
    },
    (error) => onError(asError(error))
  );

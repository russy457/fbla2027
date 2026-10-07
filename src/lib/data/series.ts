/**
 * series.ts
 * Reads of recurring series (Tier 2, SPEC 3.7; public read) and of a
 * volunteer's own whole-series signup record (seriesSignups, owner read).
 * Both are written only by Functions; screens re-render from these
 * listeners after an op returns (no optimistic UI).
 */
import { collection, doc, orderBy, query, where } from "firebase/firestore";
import { COLLECTIONS, instanceDocSchema, seriesDocSchema, seriesSignupDocSchema, seriesSignupIdFor, type SeriesDoc, type SeriesSignupDoc } from "@fbla/shared";
import { getFirebase } from "../firebase";
import type { Instance } from "./instances";
import { listenToDoc, listenToQuery } from "./listen";
import type { WithId } from "./parse";

export type Series = WithId<SeriesDoc>;
export type SeriesSignupRecord = WithId<SeriesSignupDoc>;

type OnError = (error: Error) => void;

export const listenToSeries = (seriesId: string, onData: (series: Series | null) => void, onError: OnError): (() => void) =>
  listenToDoc(doc(getFirebase().db, COLLECTIONS.series, seriesId), seriesDocSchema, onData, onError);

export const listenToMySeriesSignup = (seriesId: string, uid: string, onData: (record: SeriesSignupRecord | null) => void, onError: OnError): (() => void) =>
  listenToDoc(doc(getFirebase().db, COLLECTIONS.seriesSignups, seriesSignupIdFor(seriesId, uid)), seriesSignupDocSchema, onData, onError);

/** A series' shifts by start (opportunityId + start index, Q2), filtered to the series on the client. */
export const listenToSeriesInstances = (opportunityId: string, seriesId: string, onData: (instances: Instance[]) => void, onError: OnError): (() => void) => {
  const byOpportunity = query(collection(getFirebase().db, COLLECTIONS.instances), where("opportunityId", "==", opportunityId), orderBy("start", "asc"));
  return listenToQuery(byOpportunity, instanceDocSchema, (instances) => onData(instances.filter((instance) => instance.seriesId === seriesId)), onError);
};

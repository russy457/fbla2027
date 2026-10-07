/**
 * useSeries.ts
 * Live reads for recurring series (Tier 2): one series, the signed-in
 * volunteer's whole-series signup record, and a series' shifts.
 */
import { useLiveQuery, type LiveQueryResult } from "./useLiveQuery";
import type { Instance } from "@/lib/data/instances";
import { listenToMySeriesSignup, listenToSeries, listenToSeriesInstances, type Series, type SeriesSignupRecord } from "@/lib/data/series";

export const useSeries = (seriesId: string | null): LiveQueryResult<Series | null> =>
  useLiveQuery({
    queryKey: ["series", seriesId],
    enabled: seriesId !== null,
    subscribe: (onData, onError) => listenToSeries(seriesId ?? "", onData, onError)
  });

export const useMySeriesSignup = (seriesId: string | null, uid: string | null): LiveQueryResult<SeriesSignupRecord | null> =>
  useLiveQuery({
    queryKey: ["mySeriesSignup", seriesId, uid],
    enabled: seriesId !== null && uid !== null,
    subscribe: (onData, onError) => listenToMySeriesSignup(seriesId ?? "", uid ?? "", onData, onError)
  });

export const useSeriesInstances = (opportunityId: string | null, seriesId: string | null): LiveQueryResult<Instance[]> =>
  useLiveQuery({
    queryKey: ["seriesInstances", opportunityId, seriesId],
    enabled: opportunityId !== null && seriesId !== null,
    subscribe: (onData, onError) => listenToSeriesInstances(opportunityId ?? "", seriesId ?? "", onData, onError)
  });

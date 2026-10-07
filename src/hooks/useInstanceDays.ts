/**
 * useInstanceDays.ts
 * Groups Explore's shifts into days ("Today", "Tomorrow", "Saturday, Oct 17")
 * using each shift's own time zone (SPEC 7.5), and drops shifts that have
 * already ended or been finalized. Pure grouping lives in groupInstancesByDay
 * so it can be tested without React.
 */
import { useMemo } from "react";
import { formatInTimeZone } from "date-fns-tz";
import type { Instance } from "@/lib/data/instances";

export interface InstanceDay {
  readonly key: string;
  readonly label: string;
  readonly instances: readonly Instance[];
}

const DAY_MS = 86_400_000;

const labelFor = (instance: Instance, nowMs: number): string => {
  const zone = instance.timeZone;
  const key = formatInTimeZone(instance.start.toDate(), zone, "yyyy-MM-dd");
  if (key === formatInTimeZone(new Date(nowMs), zone, "yyyy-MM-dd")) return "Today";
  if (key === formatInTimeZone(new Date(nowMs + DAY_MS), zone, "yyyy-MM-dd")) return "Tomorrow";
  return formatInTimeZone(instance.start.toDate(), zone, "EEEE, MMM d");
};

export const groupInstancesByDay = (instances: readonly Instance[], nowMs: number): InstanceDay[] => {
  const visible = instances.filter((instance) => instance.status !== "finalized" && instance.end.toMillis() > nowMs);
  return visible.reduce<InstanceDay[]>((days, instance) => {
    const key = formatInTimeZone(instance.start.toDate(), instance.timeZone, "yyyy-MM-dd");
    const last = days[days.length - 1];
    if (last && last.key === key) {
      return [...days.slice(0, -1), { ...last, instances: [...last.instances, instance] }];
    }
    return [...days, { key, label: labelFor(instance, nowMs), instances: [instance] }];
  }, []);
};

export const useInstanceDays = (instances: readonly Instance[], nowMs: number): InstanceDay[] =>
  useMemo(() => groupInstancesByDay(instances, nowMs), [instances, nowMs]);

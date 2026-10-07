/**
 * needsAttention.ts
 * Builds the coordinator's Needs attention queue (SPEC#screen-needs-attention
 * D9): pending hours logs (kiosk-verified needsReview rows and pending manual
 * entries) and open attendance disputes, grouped by shift. Manual entries
 * have no shift and share one "Manual entries" group. "Approve all" only
 * covers needsReview rows of one shift (kiosk-verified attendance), never
 * manual entries, which a coordinator should read one by one.
 * Pure: the dashboard passes live Firestore data in.
 */
import type { HoursSource, SignupStatus } from "@fbla/shared";

export interface AttentionLogInput {
  readonly id: string;
  readonly uid: string;
  readonly instanceId: string | null;
  readonly signupId: string | null;
  readonly source: HoursSource;
  readonly minutes: number;
  readonly needsReview: boolean;
  readonly description: string | null;
  readonly date: { toMillis(): number };
  readonly displayName?: string | null | undefined;
}

export interface AttentionSignupInput {
  readonly id: string;
  readonly uid: string;
  readonly instanceId: string;
  readonly displayName: string;
  readonly status: SignupStatus;
  readonly instanceStart: { toMillis(): number };
  readonly instanceEnd: { toMillis(): number };
  readonly disputeOpen: boolean;
  readonly dispute: { readonly note: string } | null;
}

export interface AttentionShiftInput {
  readonly id: string;
  readonly title: string;
  readonly timeZone: string;
  readonly start: { toMillis(): number };
}

export type AttentionItem =
  | {
      readonly kind: "log";
      readonly id: string;
      readonly name: string;
      readonly minutes: number;
      readonly source: HoursSource;
      readonly needsReview: boolean;
      readonly description: string | null;
    }
  | {
      readonly kind: "dispute";
      readonly id: string;
      readonly name: string;
      readonly note: string;
      readonly status: SignupStatus;
      readonly scheduledMinutes: number;
    };

export interface AttentionGroup {
  readonly key: string;
  readonly title: string;
  readonly startMs: number | null;
  readonly timeZone: string | null;
  readonly items: AttentionItem[];
  /** needsReview log ids for this shift's "Approve all" (empty for manual entries). */
  readonly approvableLogIds: string[];
}

export const MANUAL_GROUP_KEY = "manual";
export const MANUAL_GROUP_TITLE = "Manual entries";
export const FALLBACK_NAME = "Volunteer";
const FALLBACK_SHIFT_TITLE = "Shift";

export const SOURCE_LABELS: Readonly<Record<HoursSource, string>> = {
  kiosk: "Kiosk check-out",
  finalize: "No check-out (auto-completed)",
  coordinator: "Set by a coordinator",
  manual: "Manual entry",
  "org-cancel": "Shift cancelled mid-shift"
};

interface Draft {
  key: string;
  title: string;
  startMs: number | null;
  timeZone: string | null;
  items: AttentionItem[];
}

export const buildAttentionGroups = (
  logs: readonly AttentionLogInput[],
  disputes: readonly AttentionSignupInput[],
  signups: readonly AttentionSignupInput[],
  shifts: readonly AttentionShiftInput[]
): AttentionGroup[] => {
  const signupById = new Map(signups.map((signup) => [signup.id, signup]));
  const shiftById = new Map(shifts.map((shift) => [shift.id, shift]));
  const groups = new Map<string, Draft>();
  const groupFor = (instanceId: string | null): Draft => {
    const key = instanceId ?? MANUAL_GROUP_KEY;
    const existing = groups.get(key);
    if (existing) return existing;
    const shift = instanceId === null ? undefined : shiftById.get(instanceId);
    const draft: Draft = {
      key,
      title: instanceId === null ? MANUAL_GROUP_TITLE : (shift?.title ?? FALLBACK_SHIFT_TITLE),
      startMs: shift?.start.toMillis() ?? null,
      timeZone: shift?.timeZone ?? null,
      items: []
    };
    groups.set(key, draft);
    return draft;
  };

  logs.forEach((log) => {
    const name = signupById.get(log.signupId ?? log.id)?.displayName ?? log.displayName ?? FALLBACK_NAME;
    groupFor(log.instanceId).items.push({
      kind: "log",
      id: log.id,
      name,
      minutes: log.minutes,
      source: log.source,
      needsReview: log.needsReview,
      description: log.description
    });
  });
  disputes.forEach((signup) => {
    groupFor(signup.instanceId).items.push({
      kind: "dispute",
      id: signup.id,
      name: signup.displayName,
      note: signup.dispute?.note ?? "",
      status: signup.status,
      scheduledMinutes: Math.round((signup.instanceEnd.toMillis() - signup.instanceStart.toMillis()) / 60_000)
    });
  });

  return [...groups.values()]
    .map((draft) => ({
      ...draft,
      approvableLogIds:
        draft.key === MANUAL_GROUP_KEY
          ? []
          : draft.items.flatMap((item) => (item.kind === "log" && item.needsReview ? [item.id] : []))
    }))
    .sort((a, b) => (a.startMs ?? Number.MAX_SAFE_INTEGER) - (b.startMs ?? Number.MAX_SAFE_INTEGER) || a.title.localeCompare(b.title));
};

/** Minutes as a short hours label: 90 -> "1.5 hours", 60 -> "1 hour". */
export const hoursLabel = (minutes: number): string => {
  const hours = Math.round((minutes / 60) * 100) / 100;
  return `${hours} ${hours === 1 ? "hour" : "hours"}`;
};

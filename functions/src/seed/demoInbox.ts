/**
 * demoInbox.ts
 * Tier 1 per-user demo data for Jordan, the demo volunteer (SPEC 10.7, E1):
 *   - two unread "hours-approved" alerts for the two most recent approved
 *     shifts in the history, so the header badge shows on first sign-in and
 *     /me/notifications is not empty (SPEC 8.3),
 *   - one saved organization, so /me/saved and the Save toggle on
 *     /organizations/:orgId show a saved state (SPEC 3.18).
 * Ids follow the live rules: notificationIdFor(type, logId) and
 * savedItemIdFor(kind, refId), so a later real alert for the same log
 * rewrites the seeded one instead of adding a second.
 */
import { HOUR_MS, PATHS, hoursApprovedNotification, minutesToHours, notificationIdFor, savedItemIdFor, type HoursLogDoc } from "@fbla/shared";
import { ts } from "../lib/firestore";
import { notificationDoc } from "../notifications/notify";
import { ORGS, VOLUNTEER } from "./demoCast";
import type { SeedWrite } from "./demoHistory";

/** Alerts appear two hours after each shift started, like a same-day approval. */
const APPROVAL_DELAY_MS = 2 * HOUR_MS;
const SEEDED_ALERTS = 2;

const orgNameOf = (orgId: string): string => Object.values(ORGS).find((org) => org.id === orgId)?.name ?? "your organization";

export const buildDemoInbox = (approvedLogs: ReadonlyMap<string, HoursLogDoc>, nowMs: number): SeedWrite[] => {
  const recent = [...approvedLogs.entries()]
    .filter(([, log]) => log.uid === VOLUNTEER.uid && log.status === "approved" && log.minutes > 0)
    .sort(([, a], [, b]) => b.date.toMillis() - a.date.toMillis())
    .slice(0, SEEDED_ALERTS);
  const alerts = recent.map(([logId, log]): SeedWrite => {
    const content = hoursApprovedNotification(minutesToHours(log.minutes), orgNameOf(log.orgId));
    const at = Math.min(log.date.toMillis() + APPROVAL_DELAY_MS, nowMs);
    return { path: PATHS.notificationItem(VOLUNTEER.uid, notificationIdFor(content.type, logId)), data: notificationDoc(content, at) };
  });
  const saved: SeedWrite = {
    path: PATHS.savedItem(VOLUNTEER.uid, savedItemIdFor("org", ORGS.pantry.id)),
    data: { kind: "org", refId: ORGS.pantry.id, savedAt: ts(nowMs) }
  };
  return [...alerts, saved];
};

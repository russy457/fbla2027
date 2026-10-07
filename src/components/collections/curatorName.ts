/**
 * curatorName.ts
 * Who a curated collection is "by" (SPEC 3.19): the organization's name for
 * an org collection, or the app team for an admin-authored one (orgId null).
 * Never the individual author: collections credit the org, not a person.
 */
import { APP_NAME } from "@/lib/brand";

export const ADMIN_CURATOR = `the ${APP_NAME} team`;

export const curatorName = (orgId: string | null, orgNames: ReadonlyMap<string, string>): string =>
  orgId === null ? ADMIN_CURATOR : (orgNames.get(orgId) ?? "a local organization");

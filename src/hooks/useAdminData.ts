/**
 * useAdminData.ts
 * Live admin reads (SPEC 9.2 "Admin"): the organization verification queue,
 * every organization (for Unverify), and recent runDueJobs history.
 */
import { useLiveQuery, type LiveQueryResult } from "./useLiveQuery";
import { listenToAllOrganizations, listenToJobRuns, listenToVerificationQueue, type JobRun } from "@/lib/data/adminData";
import type { Organization } from "@/lib/data/orgs";

export const useVerificationQueue = (): LiveQueryResult<Organization[]> =>
  useLiveQuery({ queryKey: ["verificationQueue"], subscribe: listenToVerificationQueue });

export const useAllOrganizations = (): LiveQueryResult<Organization[]> =>
  useLiveQuery({ queryKey: ["allOrganizationsLive"], subscribe: listenToAllOrganizations });

export const useJobRuns = (): LiveQueryResult<JobRun[]> => useLiveQuery({ queryKey: ["jobRuns"], subscribe: listenToJobRuns });

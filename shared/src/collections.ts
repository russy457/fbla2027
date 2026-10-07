/**
 * collections.ts
 * Firestore collection names and document paths in one place (SPEC#data-model),
 * so the client repositories, Functions, the seed, and the rules tests cannot
 * drift apart on spelling.
 */

export const COLLECTIONS = Object.freeze({
  organizations: "organizations",
  members: "members",
  letterRefs: "letterRefs",
  opportunities: "opportunities",
  instances: "instances",
  instanceSecrets: "instanceSecrets",
  signups: "signups",
  signupContacts: "signupContacts",
  hoursLogs: "hoursLogs",
  letters: "letters",
  letterVerifications: "letterVerifications",
  users: "users",
  private: "private",
  rateLimits: "rateLimits",
  turnstileTokens: "turnstileTokens",
  jobLeases: "jobLeases",
  jobRuns: "jobRuns",
  demoClock: "demoClock",
  meta: "meta",
  // Tier 1 lane A: in-app notifications (notifications/{uid}/items) and saved items (users/{uid}/saved).
  notifications: "notifications",
  notificationItems: "items",
  saved: "saved"
  // End Tier 1 lane A
});

export const PATHS = Object.freeze({
  member: (orgId: string, uid: string) => `${COLLECTIONS.organizations}/${orgId}/${COLLECTIONS.members}/${uid}`,
  letterRef: (orgId: string, letterId: string) => `${COLLECTIONS.organizations}/${orgId}/${COLLECTIONS.letterRefs}/${letterId}`,
  privateProfile: (uid: string) => `${COLLECTIONS.users}/${uid}/${COLLECTIONS.private}/profile`,
  rateLimit: (uid: string, bucket: string) => `${COLLECTIONS.rateLimits}/${uid}_${bucket}`,
  /** The only lease document; runDueJobs is the only scheduler (SPEC#fn-runduejobs-detail). */
  runDueJobsLease: () => `${COLLECTIONS.jobLeases}/runDueJobs`,
  demoClock: () => `${COLLECTIONS.demoClock}/global`,
  /** Storage path of a letter PDF (SPEC 3.22). */
  letterPdf: (uid: string, letterId: string) => `letters/${uid}/${letterId}.pdf`,
  // Tier 1 lane A
  notificationItems: (uid: string) => `${COLLECTIONS.notifications}/${uid}/${COLLECTIONS.notificationItems}`,
  notificationItem: (uid: string, itemId: string) => `${COLLECTIONS.notifications}/${uid}/${COLLECTIONS.notificationItems}/${itemId}`,
  savedItems: (uid: string) => `${COLLECTIONS.users}/${uid}/${COLLECTIONS.saved}`,
  savedItem: (uid: string, itemId: string) => `${COLLECTIONS.users}/${uid}/${COLLECTIONS.saved}/${itemId}`
  // End Tier 1 lane A
});

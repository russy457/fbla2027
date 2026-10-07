/**
 * generateVolunteerReport.ts
 * volunteer.generateVolunteerReport (SPEC 5.2, SPEC 8.6): the caller's own
 * hours report as a PDF. Only the caller's logs are read, so there is no
 * resource to authorize beyond a signed-in, onboarded volunteer. The PDF names
 * the volunteer by display name (first name + last initial) and never shows a
 * birth date or contact details. Dates are read in America/Chicago, the same
 * zone letters use for their ranges.
 */
import { AppError, DEFAULT_TIME_ZONE, displayNameFor } from "@fbla/shared";
import { profileComplete } from "../lib/auth";
import { defineCallable } from "../lib/defineCallable";
import { loadVolunteerReportData } from "../reports/data/volunteerHours";
import { generateReport } from "../reports/reportService";

export const generateVolunteerReport = defineCallable({
  endpoint: "volunteer",
  op: "generateVolunteerReport",
  auth: profileComplete(),
  handler: async ({ input, caller, clock, deps, profile }) => {
    if (profile === null) throw new AppError("PROFILE_INCOMPLETE");
    const displayName = displayNameFor(profile.firstName, profile.lastName);
    const prepare = async () => ({
      kind: "volunteer-hours" as const,
      displayName,
      data: await loadVolunteerReportData(deps.db, { uid: caller.uid, from: input.from, to: input.to, timeZone: DEFAULT_TIME_ZONE }),
      sections: input.sections,
      themeId: input.themeId,
      from: input.from,
      to: input.to,
      generatedAt: clock.now(),
      timeZone: DEFAULT_TIME_ZONE
    });
    return generateReport({
      deps,
      uid: caller.uid,
      kind: "volunteer-hours",
      orgId: null,
      requestNonce: input.requestNonce,
      params: { from: input.from, to: input.to, sections: input.sections, themeId: input.themeId, opportunityId: null },
      nowMs: clock.nowMs(),
      prepare
    });
  }
});

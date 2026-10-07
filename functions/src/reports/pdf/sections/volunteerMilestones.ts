/**
 * volunteerMilestones.ts
 * Volunteer report "Milestones" (SPEC 8.6, E4): lifetime approved hours, the
 * 25 / 50 / 100 hour milestones reached, and the distance to the next one.
 */
import { MILESTONES, type MilestoneProgress } from "@fbla/shared";
import type { PdfReportBuilder } from "../reportBuilder";

export const renderVolunteerMilestones = (builder: PdfReportBuilder, progress: MilestoneProgress): void => {
  builder.beginSection("Milestones", "Lifetime approved hours, not limited to this report's dates.");
  builder.drawKeyValueGrid(
    [
      { label: "Lifetime hours", value: progress.lifetimeHours.toFixed(2) },
      {
        label: "Next milestone",
        value: progress.next === null ? "Every milestone reached" : `${progress.next} hours (${(progress.hoursToNext ?? 0).toFixed(2)} to go)`
      },
      ...MILESTONES.map((milestone) => ({ label: `${milestone} hours`, value: progress.reached.includes(milestone) ? "Reached" : "Not yet" }))
    ],
    2
  );
};

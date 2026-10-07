/**
 * renderReport.ts
 * Draws a report PDF from already-aggregated data (SPEC 8.6). The data comes
 * from the shared build* functions (shared/src/reportData.ts), the same ones
 * the client preview and CSV export use, so the numbers always agree.
 * Sections print in canonical order (orderSections); each one prints a muted
 * "No data in this range." line instead of failing when it is empty.
 * Pure apart from pdfkit: same input, same drawing; the caller stores bytes.
 */
import {
  REPORT_THEMES,
  formatYmd,
  orderSections,
  type OrgReportData,
  type ReportSection,
  type ReportThemeId,
  type VolunteerReportData
} from "@fbla/shared";
import { PdfReportBuilder } from "./pdf/reportBuilder";
import { renderHoursByMonth } from "./pdf/sections/hoursByMonth";
import { renderOrgAttendance } from "./pdf/sections/orgAttendance";
import { renderOrgHoursByOpportunity } from "./pdf/sections/orgHoursByOpportunity";
import { renderOrgSummary } from "./pdf/sections/orgSummary";
import { renderOrgTopVolunteers } from "./pdf/sections/orgTopVolunteers";
import { renderVolunteerHoursByOrg, renderVolunteerMilestones, renderVolunteerShiftList, renderVolunteerSummary } from "./pdf/sections/volunteerSections";

interface CommonRenderInput {
  readonly sections: readonly string[];
  readonly themeId: ReportThemeId;
  readonly from: string;
  readonly to: string;
  readonly generatedAt: Date;
  readonly timeZone: string;
}

export interface OrgRenderInput extends CommonRenderInput {
  readonly kind: "org-participation";
  readonly orgName: string;
  /** Title of the opportunity filter, or null for every opportunity. */
  readonly opportunityTitle: string | null;
  readonly data: OrgReportData;
}

export interface VolunteerRenderInput extends CommonRenderInput {
  readonly kind: "volunteer-hours";
  /** First name + last initial; reports never show birth dates or contact details. */
  readonly displayName: string;
  readonly data: VolunteerReportData;
}

export type RenderReportInput = OrgRenderInput | VolunteerRenderInput;

type SectionRenderer<D> = (builder: PdfReportBuilder, data: D, timeZone: string) => void;

const ORG_RENDERERS: Partial<Record<ReportSection, SectionRenderer<OrgReportData>>> = {
  summary: (builder, data) => renderOrgSummary(builder, data.summary),
  hoursByOpportunity: (builder, data) => renderOrgHoursByOpportunity(builder, data.hoursByOpportunity),
  hoursByMonth: (builder, data) => renderHoursByMonth(builder, data.hoursByMonth),
  attendance: (builder, data) => renderOrgAttendance(builder, data.attendance),
  topVolunteers: (builder, data) => renderOrgTopVolunteers(builder, data.topVolunteers)
};

const VOLUNTEER_RENDERERS: Partial<Record<ReportSection, SectionRenderer<VolunteerReportData>>> = {
  summary: (builder, data) => renderVolunteerSummary(builder, data.summary),
  hoursByOrg: (builder, data) => renderVolunteerHoursByOrg(builder, data.hoursByOrg),
  hoursByMonth: (builder, data) => renderHoursByMonth(builder, data.hoursByMonth),
  shiftList: (builder, data, timeZone) => renderVolunteerShiftList(builder, data.shiftList, timeZone),
  milestones: (builder, data) => renderVolunteerMilestones(builder, data.milestones)
};

const runSections = <D>(builder: PdfReportBuilder, renderers: Partial<Record<ReportSection, SectionRenderer<D>>>, sections: readonly ReportSection[], data: D, timeZone: string): void => {
  sections.forEach((section) => {
    renderers[section]?.(builder, data, timeZone);
    builder.gap();
  });
};

export const reportTitleFor = (input: RenderReportInput): string =>
  input.kind === "org-participation" ? `${input.orgName} participation report` : "Volunteer hours report";

/** Renders the report and resolves with the PDF bytes. */
export const renderReport = async (input: RenderReportInput): Promise<Buffer> => {
  const builder = new PdfReportBuilder({
    title: reportTitleFor(input),
    theme: REPORT_THEMES[input.themeId],
    generatedAt: input.generatedAt,
    timeZone: input.timeZone
  });
  const rangeLabel = `${formatYmd(input.from)} to ${formatYmd(input.to)}`;
  const sections = orderSections(input.kind, input.sections);
  if (input.kind === "org-participation") {
    const scope = input.opportunityTitle === null ? "All opportunities" : `Opportunity: ${input.opportunityTitle}`;
    builder.drawCover(`${input.orgName}. ${scope}.`, rangeLabel);
    runSections(builder, ORG_RENDERERS, sections, input.data, input.timeZone);
  } else {
    builder.drawCover(`Hours for ${input.displayName}`, rangeLabel);
    runSections(builder, VOLUNTEER_RENDERERS, sections, input.data, input.timeZone);
  }
  return builder.finalize();
};

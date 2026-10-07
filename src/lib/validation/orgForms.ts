/**
 * orgForms.ts
 * The organization profile form schema (SPEC 5.8 registerOrganization and
 * updateOrganization "update"): the shared orgProfileFields plus the EIN
 * format the server enforces with EIN_INVALID ("Enter the EIN as
 * NN-NNNNNNN."), checked here first so the mistake shows next to the field.
 * Blank optional fields (phone, website) become null.
 */
import { z } from "zod";
import { EIN_PATTERN, orgProfileFields, type Address, type CauseArea } from "@fbla/shared";

const blankToNull = (value: unknown): unknown => (typeof value === "string" && value.trim() === "" ? null : value);

export const orgProfileFormSchema = z.object({
  name: orgProfileFields.name,
  mission: orgProfileFields.mission,
  causeAreas: z.array(z.string()).min(1, { message: "Pick 1 to 3 cause areas." }).max(3, { message: "Pick 1 to 3 cause areas." }).pipe(orgProfileFields.causeAreas),
  ein: z.string().trim().regex(EIN_PATTERN, { message: "Enter the EIN as NN-NNNNNNN." }),
  address: orgProfileFields.address,
  contactEmail: z.string().trim().pipe(orgProfileFields.contactEmail),
  contactPhone: z.preprocess(blankToNull, orgProfileFields.contactPhone),
  website: z.preprocess(blankToNull, orgProfileFields.website),
  timeZone: orgProfileFields.timeZone
});
export type OrgProfileValues = z.output<typeof orgProfileFormSchema>;

/** What the form edits: plain strings for the optional fields. */
export interface OrgProfileDraft {
  readonly name: string;
  readonly mission: string;
  readonly causeAreas: readonly CauseArea[];
  readonly ein: string;
  readonly address: Address;
  readonly contactEmail: string;
  readonly contactPhone: string;
  readonly website: string;
  readonly timeZone: string;
}

export const US_TIME_ZONES = [
  "America/Chicago",
  "America/New_York",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu"
] as const;

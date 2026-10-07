/**
 * ShiftEditPanels.tsx
 * The edit sections of the shift page (SPEC 9.2 "Shift roster" secondary
 * actions "cancel shift, edit"):
 *   EditShiftPanel        date/time/capacity -> coordinator.updateInstance;
 *                         lowering capacity below signups is refused
 *                         (CAPACITY_BELOW_SIGNUPS), a time change bumps the
 *                         calendar sequence, a capacity increase before the
 *                         cutoff may promote waitlisted volunteers
 *   EditOpportunityPanel  listing details -> coordinator.upsertOpportunity
 * Both are collapsed (details/summary) until opened.
 */
import type { ReactElement } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { OpportunityFields } from "@fbla/shared";
import { useOpRunner } from "@/hooks/useOpRunner";
import { api } from "@/lib/api";
import type { Instance } from "@/lib/data/instances";
import type { Opportunity } from "@/lib/data/opportunities";
import { fromShiftInstants } from "@/lib/shiftForm";
import { InstanceForm, type InstanceFormValues } from "./InstanceForm";
import { OpFeedback } from "./OpFeedback";
import { OpportunityForm } from "./OpportunityForm";

const SUMMARY_CLASS = "inline-flex min-h-touch cursor-pointer items-center text-lg font-semibold text-fg";

export const EditShiftPanel = ({ instance, nowMs }: { instance: Instance; nowMs: number }): ReactElement => {
  const runner = useOpRunner();
  const save = (values: InstanceFormValues): void => {
    void runner.run("update", () => api.coordinator.updateInstance({ instanceId: instance.id, ...values }), (out) => {
      if (!out.changed) return "Nothing changed.";
      return out.promoted.length > 0 ? `Shift updated; promoted ${out.promoted.length} from the waitlist.` : "Shift updated.";
    });
  };
  const initial = { ...fromShiftInstants(instance.start.toMillis(), instance.end.toMillis(), instance.timeZone), capacity: instance.capacity };
  return (
    <details className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <summary className={SUMMARY_CLASS}>Edit shift time or capacity</summary>
      <InstanceForm timeZone={instance.timeZone} nowMs={nowMs} initial={initial} submitLabel="Save shift" isPending={runner.pending !== null} onSubmit={save} />
      <OpFeedback message={runner.message} error={runner.error} />
    </details>
  );
};

const fieldsOf = (opportunity: Opportunity): OpportunityFields => ({
  title: opportunity.title,
  description: opportunity.description,
  causeArea: opportunity.causeArea,
  type: opportunity.type,
  skills: opportunity.skills,
  minAge: opportunity.minAge,
  location: opportunity.location ? { address: opportunity.location.address } : null
});

export const EditOpportunityPanel = ({ opportunity }: { opportunity: Opportunity }): ReactElement => {
  const runner = useOpRunner();
  const queryClient = useQueryClient();
  const save = async (fields: OpportunityFields): Promise<void> => {
    const result = await runner.run("save", () => api.coordinator.upsertOpportunity({ opportunityId: opportunity.id, fields }), () => "Opportunity details saved.");
    if (!result) return;
    // The single listing (useOpportunity) and the org's list (useOrgOpportunities, shift creation) are both plain queries.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["opportunity", opportunity.id] }),
      queryClient.invalidateQueries({ queryKey: ["orgOpportunities", opportunity.orgId] })
    ]);
  };
  return (
    <details className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <summary className={SUMMARY_CLASS}>Edit opportunity details</summary>
      <OpportunityForm initial={fieldsOf(opportunity)} submitLabel="Save details" isPending={runner.pending !== null} onSubmit={(fields) => void save(fields)} />
      <OpFeedback message={runner.message} error={runner.error} />
    </details>
  );
};

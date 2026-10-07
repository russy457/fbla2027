/**
 * OrgShiftNewPage.tsx
 * Route "/org/:orgId/shifts/new" (SPEC 9.2 "Shifts ... /new"): create a
 * shift in two steps.
 *   1. What: pick one of the org's active opportunities, or describe a new
 *      one (coordinator.upsertOpportunity create).
 *   2. When: date, times in the org zone, capacity (coordinator.createInstance).
 * Each create keeps its own request nonce across retries, so a double click
 * never makes two listings or two shifts. Opens the new shift page after.
 * (The plain-English planner box is Lane C; this is the structured form.)
 */
import { useId, useState, type ReactElement } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_TIME_ZONE, type OpportunityFields } from "@fbla/shared";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { InstanceForm, type InstanceFormValues } from "@/components/org/InstanceForm";
import { OpFeedback } from "@/components/org/OpFeedback";
import { OpportunityForm } from "@/components/org/OpportunityForm";
import { OrgPageShell } from "@/components/org/OrgPageShell";
import { INPUT_CLASSES } from "@/components/ui/TextField";
import { useNow } from "@/hooks/useNow";
import { useOrgOpportunities } from "@/hooks/useOrgAdmin";
import { useOpRunner } from "@/hooks/useOpRunner";
import { api, newRequestNonce } from "@/lib/api";
import { getOrganization } from "@/lib/data/orgs";
import { fromShiftInstants } from "@/lib/shiftForm";

const NEW_OPPORTUNITY = "__new__";
const DAY_MS = 86_400_000;
const DEFAULT_CAPACITY = 10;

/** Tomorrow 9:00 AM to 1:00 PM in the org zone, 10 seats. */
const defaultTimes = (nowMs: number, timeZone: string) => {
  const tomorrow = fromShiftInstants(nowMs + DAY_MS, nowMs + DAY_MS, timeZone).date;
  return { date: tomorrow, startTime: "09:00", endTime: "13:00", capacity: DEFAULT_CAPACITY };
};

const OrgShiftNewPage = (): ReactElement => {
  const { orgId = "" } = useParams();
  const nowMs = useNow(60_000);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const org = useQuery({ queryKey: ["organization", orgId], queryFn: () => getOrganization(orgId), staleTime: 60_000 });
  const opportunities = useOrgOpportunities(orgId);
  const [choice, setChoice] = useState("");
  const [nonces] = useState(() => ({ opportunity: newRequestNonce(), instance: newRequestNonce() }));
  const runner = useOpRunner();
  const selectId = useId();

  if (org.isError || opportunities.isError) return <ErrorState title="We couldn't load this organization" description="Check your connection, then reload." />;
  if (org.isPending || opportunities.isPending) return <LoadingState label="Loading" />;
  const timeZone = org.data?.timeZone ?? DEFAULT_TIME_ZONE;
  const active = (opportunities.data ?? []).filter((item) => item.status === "active");
  const selected = choice === "" && active.length === 0 ? NEW_OPPORTUNITY : choice;

  const createOpportunity = async (fields: OpportunityFields): Promise<void> => {
    const result = await runner.run("opportunity", () => api.coordinator.upsertOpportunity({ orgId, requestNonce: nonces.opportunity, fields }), () => `Saved "${fields.title}". Now pick a date and time.`);
    if (!result) return;
    await queryClient.invalidateQueries({ queryKey: ["orgOpportunities", orgId] });
    setChoice(result.opportunityId);
  };

  const createShift = async (values: InstanceFormValues): Promise<void> => {
    const result = await runner.run("instance", () => api.coordinator.createInstance({ opportunityId: selected, requestNonce: nonces.instance, ...values }), () => "Shift created.");
    if (result) navigate(`/org/${orgId}/shifts/${result.instanceId}`);
  };

  return (
    <OrgPageShell title="Create shift" intro="Choose what volunteers will do, then when.">
      <section aria-labelledby="step-what" className="flex flex-col gap-4">
        <h2 id="step-what" className="text-lg font-semibold text-fg">1. What</h2>
        <div className="flex max-w-xl flex-col gap-2">
          <label htmlFor={selectId} className="text-sm font-semibold text-fg">Opportunity</label>
          <select id={selectId} value={selected} onChange={(event) => setChoice(event.target.value)} className={INPUT_CLASSES}>
            <option value="">Choose an opportunity</option>
            {active.map((item) => (
              <option key={item.id} value={item.id}>{item.title}</option>
            ))}
            <option value={NEW_OPPORTUNITY}>New opportunity...</option>
          </select>
        </div>
        {selected === NEW_OPPORTUNITY ? (
          <OpportunityForm submitLabel="Save opportunity" isPending={runner.pending === "opportunity"} onSubmit={(fields) => void createOpportunity(fields)} />
        ) : null}
      </section>
      {selected !== "" && selected !== NEW_OPPORTUNITY ? (
        <section aria-labelledby="step-when" className="flex flex-col gap-4">
          <h2 id="step-when" className="text-lg font-semibold text-fg">2. When</h2>
          <InstanceForm timeZone={timeZone} nowMs={nowMs} initial={defaultTimes(nowMs, timeZone)} submitLabel="Create shift" isPending={runner.pending === "instance"} onSubmit={(values) => void createShift(values)} />
        </section>
      ) : null}
      <OpFeedback message={runner.message} error={runner.error} />
    </OrgPageShell>
  );
};

export default OrgShiftNewPage;

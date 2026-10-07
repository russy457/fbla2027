/**
 * OrgShiftNewPage.tsx
 * Route "/org/:orgId/shifts/new" (SPEC 9.2 "Shifts ... /new"): create a
 * shift in two steps.
 *   1. What: pick one of the org's active opportunities, or describe a new
 *      one (coordinator.upsertOpportunity create).
 *   2. When: date, times in the org zone, capacity (coordinator.createInstance).
 * Each create keeps its own request nonce across retries, so a double click
 * never makes two listings or two shifts. Opens the new shift page after.
 *
 * Above both steps, "Describe the shift in plain words" (PlannerBox, H2)
 * runs the deterministic parser and pre-fills both forms with what it
 * recognized, highlighted for review (SPEC#screen-planner 9.14). If the
 * parsed title matches an active opportunity that one is picked; otherwise
 * the New opportunity form opens pre-filled. It never submits anything.
 */
import { useId, useState, type ReactElement } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_TIME_ZONE, type OpportunityFields } from "@fbla/shared";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { InstanceForm, type InstanceFormValues } from "@/components/org/InstanceForm";
import { OpFeedback } from "@/components/org/OpFeedback";
import { EMPTY_ADDRESS } from "@/components/org/AddressFields";
import { EMPTY_OPPORTUNITY, OpportunityForm } from "@/components/org/OpportunityForm";
import { PlannerBox } from "@/components/org/PlannerBox";
import { OrgPageShell } from "@/components/org/OrgPageShell";
import { INPUT_CLASSES } from "@/components/ui/TextField";
import { useNow } from "@/hooks/useNow";
import { useOrgOpportunities } from "@/hooks/useOrgAdmin";
import { useOpRunner } from "@/hooks/useOpRunner";
import { api, newRequestNonce } from "@/lib/api";
import type { Opportunity } from "@/lib/data/orgAdmin";
import { getOrganization } from "@/lib/data/orgs";
import type { PlannerPrefill } from "@/lib/plannerPrefill";
import { fromShiftInstants } from "@/lib/shiftForm";

const NEW_OPPORTUNITY = "__new__";
const DAY_MS = 86_400_000;
const DEFAULT_CAPACITY = 10;

/** Tomorrow 9:00 AM to 1:00 PM in the org zone, 10 seats, overridden by anything the planner filled. */
const initialTimes = (nowMs: number, timeZone: string, prefill: PlannerPrefill | null) => {
  const tomorrow = fromShiftInstants(nowMs + DAY_MS, nowMs + DAY_MS, timeZone).date;
  return {
    date: prefill?.date ?? tomorrow,
    startTime: prefill?.startTime ?? "09:00",
    endTime: prefill?.endTime ?? "13:00",
    capacity: prefill?.capacity ?? DEFAULT_CAPACITY
  };
};

/** The opportunity form's starting values with the planner's title, cause, and place. */
const initialOpportunity = (prefill: PlannerPrefill | null): OpportunityFields => ({
  ...EMPTY_OPPORTUNITY,
  ...(prefill?.title ? { title: prefill.title } : {}),
  ...(prefill?.causeArea ? { causeArea: prefill.causeArea } : {}),
  ...(prefill?.location ? { location: { address: { ...EMPTY_ADDRESS, line1: prefill.location } } } : {})
});

/** An active opportunity whose title matches the parsed one (ignoring case), if any. */
const matchingOpportunity = (active: readonly Opportunity[], title: string | undefined): string | null => {
  const wanted = title?.trim().toLowerCase();
  return wanted ? (active.find((item) => item.title.trim().toLowerCase() === wanted)?.id ?? null) : null;
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
  const [prefill, setPrefill] = useState<PlannerPrefill | null>(null);
  // Bumped on every parse so both forms remount with the new starting values.
  const [prefillVersion, setPrefillVersion] = useState(0);
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

  const applyPrefill = (next: PlannerPrefill): void => {
    setPrefill(next);
    setPrefillVersion((version) => version + 1);
    if (choice !== "") return;
    const match = matchingOpportunity(active, next.title);
    if (match !== null) setChoice(match);
    else if (next.title || next.causeArea || next.location) setChoice(NEW_OPPORTUNITY);
  };

  const createShift = async (values: InstanceFormValues): Promise<void> => {
    const result = await runner.run("instance", () => api.coordinator.createInstance({ opportunityId: selected, requestNonce: nonces.instance, ...values }), () => "Shift created.");
    if (result) navigate(`/org/${orgId}/shifts/${result.instanceId}`);
  };

  return (
    <OrgPageShell title="Create shift" intro="Choose what volunteers will do, then when.">
      <PlannerBox timeZone={timeZone} nowMs={nowMs} onPrefill={applyPrefill} />
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
          <OpportunityForm
            key={prefillVersion}
            initial={initialOpportunity(prefill)}
            highlighted={prefill?.filled}
            submitLabel="Save opportunity"
            isPending={runner.pending === "opportunity"}
            onSubmit={(fields) => void createOpportunity(fields)}
          />
        ) : null}
      </section>
      {selected !== "" && selected !== NEW_OPPORTUNITY ? (
        <section aria-labelledby="step-when" className="flex flex-col gap-4">
          <h2 id="step-when" className="text-lg font-semibold text-fg">2. When</h2>
          <InstanceForm
            key={prefillVersion}
            timeZone={timeZone}
            nowMs={nowMs}
            initial={initialTimes(nowMs, timeZone, prefill)}
            highlighted={prefill?.filled}
            submitLabel="Create shift"
            isPending={runner.pending === "instance"}
            onSubmit={(values) => void createShift(values)}
          />
        </section>
      ) : null}
      <OpFeedback message={runner.message} error={runner.error} />
    </OrgPageShell>
  );
};

export default OrgShiftNewPage;

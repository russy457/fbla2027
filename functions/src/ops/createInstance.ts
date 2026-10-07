/**
 * createInstance.ts
 * coordinator.createInstance (SPEC 5.2, SPEC#dm-instances), coordinator of
 * the opportunity's org. Creates one dated shift with its kiosk key material
 * (instanceSecrets: 32 random salt bytes, key version 1; builders in
 * shifts/instanceRecords.ts, shared with recurring series) in one
 * transaction. The id is hash(uid, nonce), so a retry returns the same shift.
 * Title, org name, verified flag, minimum age, and the org time zone are
 * denormalized so Explore and My Shifts render from one document.
 */
import { AppError, COLLECTIONS, type InstanceDoc, type OrganizationDoc } from "@fbla/shared";
import { coordinatorOf } from "../lib/auth";
import { defineCallable } from "../lib/defineCallable";
import { readDoc, runTx } from "../lib/firestore";
import { opportunityResource } from "../lib/orgAuth";
import { hashId } from "../lib/requestIds";
import { assertShiftTimes } from "../shifts/instanceTimes";
import { newInstanceDoc, newInstanceSecret } from "../shifts/instanceRecords";
import { refreshNextInstanceStart } from "../shifts/opportunitySchedule";

export const createInstance = defineCallable({
  endpoint: "coordinator",
  op: "createInstance",
  auth: coordinatorOf(opportunityResource((input: { opportunityId: string }) => input.opportunityId)),
  handler: async ({ input, caller, clock, deps, resource }) => {
    const { db, env } = deps;
    const nowMs = clock.nowMs();
    const instanceId = hashId(["instance", caller.uid, input.requestNonce], 20);
    const ref = db.collection(COLLECTIONS.instances).doc(instanceId);
    const existing = readDoc<InstanceDoc>(await ref.get());
    if (existing !== null) {
      if (existing.opportunityId !== resource.id) throw new AppError("PERMISSION_DENIED");
      return { instanceId, created: false };
    }

    const opportunity = resource.data;
    if (opportunity.status !== "active") throw new AppError("INVALID_INPUT", { fields: "opportunityId" });
    const times = { startMs: Date.parse(input.start), endMs: Date.parse(input.end) };
    assertShiftTimes(times, nowMs);
    const org = readDoc<OrganizationDoc>(await db.collection(COLLECTIONS.organizations).doc(opportunity.orgId).get());
    if (org === null) throw new AppError("NOT_FOUND");

    const instance = newInstanceDoc({ opportunityId: resource.id, opportunity, org, seriesId: null, times, capacity: input.capacity, config: env.config, nowMs });
    const secret = newInstanceSecret(nowMs);
    const created = await runTx(db, async (tx) => {
      if ((await tx.get(ref)).exists) return false;
      tx.create(ref, instance);
      tx.set(db.collection(COLLECTIONS.instanceSecrets).doc(instanceId), secret);
      return true;
    });
    await refreshNextInstanceStart(db, resource.id, nowMs);
    return { instanceId, created };
  }
});

/** A volunteer cannot commit to two shifts whose time ranges overlap. */
import { ACTIVE_SIGNUP_STATUSES } from "./schemas/common";
import type { SignupDoc } from "./schemas/shiftDocs";

type Commitment = Pick<SignupDoc, "instanceId" | "instanceStart" | "instanceEnd" | "status">;

/** Half-open ranges let one shift end exactly when the next begins. */
export const findScheduleConflict = <T extends Commitment>(
  candidate: { readonly instanceId: string; readonly startMs: number; readonly endMs: number },
  signups: readonly T[]
): T | null =>
  signups.find(
    (signup) =>
      signup.instanceId !== candidate.instanceId &&
      (ACTIVE_SIGNUP_STATUSES as readonly string[]).includes(signup.status) &&
      signup.instanceStart.toMillis() < candidate.endMs &&
      candidate.startMs < signup.instanceEnd.toMillis()
  ) ?? null;

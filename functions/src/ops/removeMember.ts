/**
 * removeMember.ts
 * coordinator.removeMember (SPEC 5.2), owner only. Removes a coordinator's
 * membership; the owner can never be removed (CANNOT_REMOVE_OWNER). A
 * missing member is not an error (set semantics): removed is false.
 */
import { AppError, PATHS, type MemberDoc } from "@fbla/shared";
import { defineCallable } from "../lib/defineCallable";
import { readDoc } from "../lib/firestore";
import { orgResource, ownerOf } from "../lib/orgAuth";

export const removeMember = defineCallable({
  endpoint: "coordinator",
  op: "removeMember",
  auth: ownerOf(orgResource((input: { orgId: string }) => input.orgId)),
  handler: async ({ input, deps }) => {
    const ref = deps.db.doc(PATHS.member(input.orgId, input.uid));
    const member = readDoc<MemberDoc>(await ref.get());
    if (member === null) return { removed: false };
    if (member.role === "owner") throw new AppError("CANNOT_REMOVE_OWNER");
    await ref.delete();
    return { removed: true };
  }
});

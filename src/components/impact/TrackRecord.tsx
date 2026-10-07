/**
 * TrackRecord.tsx
 * "Your track record" on Impact (SPEC#reliability 7.2, T3, D12): neutral
 * text such as "Attended 8 of 10 recent shifts" or "New volunteer", with
 * the inputs spelled out, and never a colored score badge. Only the
 * volunteer sees this (it comes from their own private profile); it is never
 * used to block a signup. Requesting a review of a no-show belongs to the
 * attendance tools (requestAttendanceReview).
 */
import type { ReactElement } from "react";
import { reliabilitySummary, type Reliability } from "@fbla/shared";

export const TrackRecord = ({ reliability }: { reliability: Reliability }): ReactElement => (
  <section aria-labelledby="track-record-title" className="flex flex-col gap-2">
    <h2 id="track-record-title" className="text-xl font-semibold text-fg">
      Your track record
    </h2>
    <p className="text-lg text-fg">{reliabilitySummary(reliability)}</p>
    <p className="max-w-[60ch] text-sm text-fg-muted">
      {reliability.isNew
        ? "After 3 finished shifts this shows how often you came. Only you and the organizations you sign up with can see it."
        : `Counted from your last ${reliability.total} finished shifts in the past year: ${reliability.attended} attended, ${reliability.noShows} missed, ${reliability.lateCancels} cancelled within 24 hours. Excused shifts, early cancels, and shifts the organization cancelled never count. Only you and the organizations you sign up with can see it.`}
    </p>
  </section>
);

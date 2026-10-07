/**
 * icsDownload.ts
 * E2 calendar files on the client (SPEC#ics 8.7): builds the .ics for one
 * signup with the shared builder (org time zone, stable UID, SEQUENCE from
 * the instance) and hands it to the browser as a download. No subscribed
 * feed; each click makes a fresh file. A cancellation file carries
 * METHOD:CANCEL, which some calendar apps ignore, so the UI shows
 * CANCELLATION_NOTE next to the link.
 */
import { buildSignupIcs, clock, icsFileName } from "@fbla/shared";
import { APP_NAME } from "./brand";
import type { Instance } from "./data/instances";
import type { Opportunity } from "./data/opportunities";

export const CANCELLATION_NOTE = "If your calendar still shows this shift, delete the event.";

export interface SignupIcsParams {
  readonly signupId: string;
  readonly instance: Instance;
  readonly opportunity: Opportunity | null;
  readonly cancelled: boolean;
  /** window.location.origin, passed in so this stays testable. */
  readonly origin: string;
  readonly nowMs: number;
}

const placeOf = (opportunity: Opportunity | null): string | null => {
  const address = opportunity?.location?.address;
  return address ? `${address.line1}, ${address.city}, ${address.state} ${address.zip}` : null;
};

/** The file name and text for one signup's calendar file. */
export const signupIcs = (params: SignupIcsParams): { fileName: string; text: string } => {
  const { instance } = params;
  const url = `${params.origin}/opportunity/${encodeURIComponent(instance.id)}`;
  const text = buildSignupIcs({
    signupId: params.signupId,
    appHost: new URL(params.origin).host,
    productName: APP_NAME,
    title: instance.title,
    orgName: instance.orgName,
    description: params.opportunity?.description ?? null,
    location: placeOf(params.opportunity),
    url,
    startMs: instance.start.toMillis(),
    endMs: instance.end.toMillis(),
    timeZone: instance.timeZone,
    sequence: instance.sequence,
    stampMs: params.nowMs,
    cancelled: params.cancelled
  });
  return { fileName: icsFileName(instance.title, params.cancelled), text };
};

/** Saves text as a file through a temporary object URL. */
export const saveTextFile = (fileName: string, text: string, type: string): void => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before freeing the URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const downloadSignupIcs = (params: Omit<SignupIcsParams, "origin" | "nowMs">): void => {
  const { fileName, text } = signupIcs({ ...params, origin: window.location.origin, nowMs: clock.nowMs() });
  saveTextFile(fileName, text, "text/calendar;charset=utf-8");
};

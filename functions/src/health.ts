/**
 * health.ts
 * Plain HTTP health check (kept from the old app, used by the DEMO.md
 * pre-flight check). Reports the project id and the current time from the
 * shared clock, so a demo clock offset is visible here too.
 */
import { onRequest } from "firebase-functions/v2/https";
import { clock } from "@fbla/shared";

export interface HealthPayload {
  readonly ok: true;
  readonly project: string;
  readonly time: string;
}

export const healthPayload = (env: Readonly<Record<string, string | undefined>>): HealthPayload => ({
  ok: true,
  project: env.GCLOUD_PROJECT ?? env.GCP_PROJECT ?? "unknown",
  time: clock.now().toISOString()
});

export const health = onRequest((_request, response) => {
  response.set("Cache-Control", "no-store");
  response.json(healthPayload(process.env));
});

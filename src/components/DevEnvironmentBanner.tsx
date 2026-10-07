/**
 * DevEnvironmentBanner.tsx
 * Development-only banner (plan X10) that explains local setup problems in
 * plain words instead of letting Firebase calls fail silently:
 *  - env incomplete: names the missing VITE_* variables and the fix;
 *  - emulators down: names the missing services and the one-command restart.
 * Rendered only when import.meta.env.DEV is true (see AppLayout). The env
 * result and the probe are props so tests can drive every state.
 */
import { useEffect, useState, type ReactElement } from "react";
import { Wrench } from "@phosphor-icons/react";
import { EnvValidationError } from "@fbla/shared";
import { readClientEnv, type ClientEnvResult } from "@/lib/env";
import { probeEmulators, type EmulatorProbeResult, type ProbeOptions } from "@/lib/emulatorProbe";

interface DevEnvironmentBannerProps {
  envResult?: ClientEnvResult;
  probe?: (options?: ProbeOptions) => Promise<EmulatorProbeResult>;
}

export const describeEnvProblem = (error: Error): string => {
  if (error instanceof EnvValidationError) {
    const names = error.issues.map((issue) => issue.variable).join(", ");
    return `Missing or invalid settings: ${names}. Copy .env.example to .env.local, then restart npm run dev.`;
  }
  return `${error.message} Copy .env.example to .env.local, then restart npm run dev.`;
};

export const describeProbeProblem = (result: EmulatorProbeResult, command = "npm run demo:restart"): string | null => {
  if (result.reachable) return null;
  const services = result.unreachable.map(({ service, port }) => `${service} :${port}`).join(", ");
  return `Local Firebase services are offline (${services}). Run ${command} in a terminal.`;
};

export const DevEnvironmentBanner = ({ envResult, probe = probeEmulators }: DevEnvironmentBannerProps): ReactElement | null => {
  const [env] = useState<ClientEnvResult>(() => envResult ?? readClientEnv());
  const [problem, setProblem] = useState<string | null>(() => (env.ok ? null : describeEnvProblem(env.error)));

  useEffect(() => {
    if (!env.ok || !(env.env.VITE_USE_EMULATORS || env.env.VITE_FUNCTIONS_EMULATOR || env.env.VITE_STORAGE_EMULATOR)) return undefined;
    let isActive = true;
    const services = env.env.VITE_USE_EMULATORS
      ? undefined
      : ([env.env.VITE_FUNCTIONS_EMULATOR && "functions", env.env.VITE_STORAGE_EMULATOR && "storage"].filter(Boolean) as ProbeOptions["services"]);
    probe({ services })
      .then((result) => {
        if (isActive) setProblem(describeProbeProblem(result, env.env.VITE_USE_EMULATORS ? "npm run demo:restart" : "npm run demo:cloud"));
      })
      .catch(() => {
        if (isActive) setProblem("Could not check the emulators. Run npm run doctor for details.");
      });
    return () => {
      isActive = false;
    };
  }, [env, probe]);

  if (!problem) return null;

  return (
    <div role="status" className="border-b border-status-warning bg-status-warning-subtle">
      <p className="mx-auto flex w-full max-w-6xl items-start gap-2 px-4 py-2 text-sm text-fg sm:px-6">
        <Wrench aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-status-warning" />
        <span>
          <strong className="font-semibold">Developer setup: </strong>
          {problem}
        </span>
      </p>
    </div>
  );
};

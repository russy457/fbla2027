/**
 * DevEnvironmentBanner.tsx
 * Development-only banner (plan X10) that explains local setup problems in
 * plain words instead of letting Firebase calls fail silently:
 *  - env incomplete: names the missing VITE_* variables and the fix;
 *  - emulators down: "Emulators not reachable on :8080, run npm run demo".
 * Rendered only when import.meta.env.DEV is true (see AppLayout). The env
 * result and the probe are props so tests can drive every state.
 */
import { useEffect, useState, type ReactElement } from "react";
import { Wrench } from "@phosphor-icons/react";
import { EnvValidationError } from "@fbla/shared";
import { readClientEnv, type ClientEnvResult } from "@/lib/env";
import { probeEmulators, type EmulatorProbeResult } from "@/lib/emulatorProbe";

interface DevEnvironmentBannerProps {
  envResult?: ClientEnvResult;
  probe?: () => Promise<EmulatorProbeResult>;
}

export const describeEnvProblem = (error: Error): string => {
  if (error instanceof EnvValidationError) {
    const names = error.issues.map((issue) => issue.variable).join(", ");
    return `Missing or invalid settings: ${names}. Copy .env.example to .env.local, then restart npm run dev.`;
  }
  return `${error.message} Copy .env.example to .env.local, then restart npm run dev.`;
};

export const describeProbeProblem = (result: EmulatorProbeResult): string | null => {
  if (result.reachable) return null;
  const ports = result.unreachable.map(({ port }) => `:${port}`).join(", ");
  return `Emulators not reachable on ${ports}, run npm run demo`;
};

export const DevEnvironmentBanner = ({ envResult, probe = probeEmulators }: DevEnvironmentBannerProps): ReactElement | null => {
  const [env] = useState<ClientEnvResult>(() => envResult ?? readClientEnv());
  const [problem, setProblem] = useState<string | null>(() => (env.ok ? null : describeEnvProblem(env.error)));

  useEffect(() => {
    if (!env.ok || !env.env.VITE_USE_EMULATORS) return undefined;
    let isActive = true;
    probe()
      .then((result) => {
        if (isActive) setProblem(describeProbeProblem(result));
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
      <p className="mx-auto flex w-full max-w-5xl items-start gap-2 px-4 py-2 text-sm text-fg">
        <Wrench aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-status-warning" />
        <span>
          <strong className="font-semibold">Developer setup: </strong>
          {problem}
        </span>
      </p>
    </div>
  );
};

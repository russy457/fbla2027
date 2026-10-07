/**
 * MilestoneProgress.tsx
 * Progress toward the next hour milestone (SPEC 7.3 MILESTONES 25/50/100,
 * D6 "0 of 25 hours to your first milestone"). A native <progress> element
 * gives screen readers the value; the visible bar grows with a transform
 * (compositor-only) and is static under reduced motion through the duration
 * tokens. After the last milestone it says so instead of showing a bar.
 */
import type { ReactElement } from "react";
import { MILESTONES, nextMilestone, round2 } from "@fbla/shared";

interface MilestoneProgressProps {
  readonly hours: number;
}

const previousMilestone = (target: number): number => {
  const index = MILESTONES.indexOf(target as (typeof MILESTONES)[number]);
  return index > 0 ? (MILESTONES[index - 1] ?? 0) : 0;
};

export const milestoneSentence = (hours: number): string => {
  const target = nextMilestone(hours);
  if (target === null) return `You passed every milestone. ${round2(hours)} hours and counting.`;
  const isFirst = target === MILESTONES[0];
  return `${round2(hours)} of ${target} hours to your ${isFirst ? "first" : "next"} milestone`;
};

export const MilestoneProgress = ({ hours }: MilestoneProgressProps): ReactElement => {
  const target = nextMilestone(hours);
  const sentence = milestoneSentence(hours);
  if (target === null) return <p className="font-semibold text-fg">{sentence}</p>;

  const floor = previousMilestone(target);
  const fraction = Math.min(1, Math.max(0, (hours - floor) / (target - floor)));
  return (
    <div className="flex flex-col gap-2">
      <p id="milestone-label" className="text-sm font-semibold text-fg">
        {sentence}
      </p>
      <progress aria-labelledby="milestone-label" value={round2(hours - floor)} max={target - floor} className="sr-only" />
      <div aria-hidden="true" className="h-3 w-full overflow-hidden rounded-full border border-border bg-surface-sunken">
        <div
          className="h-full w-full origin-left rounded-full bg-accent transition-transform duration-(--duration-slow) ease-out"
          style={{ transform: `scaleX(${fraction})` }}
        />
      </div>
    </div>
  );
};

/**
 * Milestones.tsx
 * E4 milestones on Impact (SPEC 7.3 MILESTONES 25/50/100, SPEC 3.17
 * milestonesSeen, D15 CountUp "and the milestone moment"):
 *   - the three badges, each with an icon and "Earned" or "N hours to go"
 *     (never color alone),
 *   - a one-time milestone moment for a newly reached badge: the number
 *     counts up (static under reduced motion, CountUp checks it), with
 *     "Download badge card" and Share, and "Got it" records the milestone in
 *     milestonesSeen (a client-writable private profile key) so it does not
 *     show again,
 *   - the weekly streak when there is one.
 */
import { useState, type ReactElement } from "react";
import { DownloadSimple, Medal, ShareNetwork, LockSimple } from "@phosphor-icons/react";
import { MILESTONES, PATHS, newMilestones, round2, type Milestone } from "@fbla/shared";
import { doc, updateDoc } from "firebase/firestore";
import CountUp from "@/components/bits/CountUp";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { badgeCardSvg, svgToPng, tokenColors } from "@/lib/badgeCard";
import { getFirebase } from "@/lib/firebase";
import { saveTextFile } from "@/lib/icsDownload";
import { cn } from "@/lib/cn";

interface MilestonesProps {
  readonly uid: string;
  readonly hours: number;
  readonly displayName: string;
  readonly milestonesSeen: readonly number[];
  readonly streakWeeks: number;
}

const markSeen = async (uid: string, seen: readonly number[], reached: readonly Milestone[]): Promise<void> => {
  const next = [...new Set([...seen, ...reached])].sort((a, b) => a - b);
  await updateDoc(doc(getFirebase().db, PATHS.privateProfile(uid)), { milestonesSeen: next });
};

const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const BadgeCardActions = ({ displayName, milestone, hours }: { displayName: string; milestone: Milestone; hours: number }): ReactElement => {
  const [status, setStatus] = useState<string | null>(null);
  const fileName = `badge-${milestone}-hours.png`;
  const svg = (): string => badgeCardSvg({ displayName, milestone, totalHours: round2(hours), colors: tokenColors() });

  const download = async (): Promise<void> => {
    try {
      downloadBlob(await svgToPng(svg()), fileName);
      setStatus("Badge card downloaded.");
    } catch {
      // Some browsers cannot rasterize; the SVG still works as an image file.
      saveTextFile(fileName.replace(".png", ".svg"), svg(), "image/svg+xml");
      setStatus("Badge card downloaded.");
    }
  };

  const share = async (): Promise<void> => {
    try {
      const file = new File([await svgToPng(svg())], fileName, { type: "image/png" });
      await navigator.share({ files: [file], title: `${milestone} volunteer hours` });
      setStatus(null);
    } catch {
      setStatus("Sharing didn't work here. Download the card instead.");
    }
  };

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void download()} className={buttonClassName("primary")}>
          <DownloadSimple aria-hidden="true" size={18} />
          Download badge card
        </button>
        {canShare ? (
          <button type="button" onClick={() => void share()} className={buttonClassName("secondary")}>
            <ShareNetwork aria-hidden="true" size={18} />
            Share
          </button>
        ) : null}
      </div>
      <p aria-live="polite" className="text-sm text-fg-muted">
        {status}
      </p>
    </div>
  );
};

export const Milestones = ({ uid, hours, displayName, milestonesSeen, streakWeeks }: MilestonesProps): ReactElement => {
  const fresh = newMilestones(hours, milestonesSeen);
  const moment = fresh[fresh.length - 1] ?? null;
  const earned = MILESTONES.filter((milestone) => hours >= milestone);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const dismiss = async (): Promise<void> => {
    if (moment === null) return;
    setIsSaving(true);
    setSaveFailed(false);
    try {
      // Every milestone reached so far counts as seen, so an older one never pops up later.
      await markSeen(uid, milestonesSeen, fresh);
    } catch {
      setSaveFailed(true);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section aria-labelledby="milestones-title" className="flex flex-col gap-4">
      <h2 id="milestones-title" className="text-xl font-semibold text-fg">
        Milestones
      </h2>

      {moment !== null ? (
        <div role="status" className="flex flex-col gap-4 rounded-lg border border-status-success bg-status-success-subtle p-5">
          <p className="text-2xl font-semibold text-fg">
            You reached <CountUp to={moment} from={0} duration={1.2} className="tabular-nums" /> hours!
          </p>
          <p className="text-fg-muted">That is a real difference. Share it, or keep going to the next one.</p>
          <BadgeCardActions displayName={displayName} milestone={moment} hours={hours} />
          <button type="button" disabled={isSaving} onClick={() => void dismiss()} className={buttonClassName("quiet", "w-fit")}>
            {isSaving ? "Saving..." : "Got it"}
          </button>
          {saveFailed ? <p className="text-sm text-status-danger">We couldn't save that. Try again.</p> : null}
        </div>
      ) : null}

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {MILESTONES.map((milestone) => {
          const isEarned = hours >= milestone;
          return (
            <li
              key={milestone}
              className={cn("flex items-center gap-3 rounded-lg border p-4", isEarned ? "border-status-success bg-surface" : "border-border bg-surface-sunken")}
            >
              {isEarned ? (
                <Medal aria-hidden="true" size={32} weight="fill" className="shrink-0 text-status-success" />
              ) : (
                <LockSimple aria-hidden="true" size={28} className="shrink-0 text-fg-subtle" />
              )}
              <div className="flex flex-col">
                <p className="font-semibold text-fg">{milestone} hours</p>
                <p className="text-sm text-fg-muted">{isEarned ? "Earned" : `${round2(milestone - hours)} hours to go`}</p>
              </div>
            </li>
          );
        })}
      </ul>

      {moment === null && earned.length > 0 ? (
        <BadgeCardActions displayName={displayName} milestone={earned[earned.length - 1] as Milestone} hours={hours} />
      ) : null}
      {streakWeeks > 0 ? (
        <p className="text-sm text-fg">
          {streakWeeks === 1 ? "You volunteered this week or last." : `You have volunteered ${streakWeeks} weeks in a row.`}
        </p>
      ) : null}
    </section>
  );
};

/**
 * DiscoverableToggle.tsx
 * The Profile screen's secondary action (SPEC#screen-inventory "Profile":
 * Discoverable toggle; SPEC 3.17 notificationPrefs.discoverable). When on,
 * organizations you have not volunteered with may see your display name in
 * their ranked suggestions (Tier 2) and invite you. It is an allowlisted
 * client write, so the checkbox reflects the live profile and shows a short
 * error if the write fails.
 */
import { useId, useState, type ReactElement } from "react";
import { saveDiscoverable } from "@/lib/preferenceSync";

interface DiscoverableToggleProps {
  readonly uid: string;
  readonly discoverable: boolean;
}

export const DiscoverableToggle = ({ uid, discoverable }: DiscoverableToggleProps): ReactElement => {
  const [isBusy, setIsBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const hintId = useId();

  const toggle = async (next: boolean): Promise<void> => {
    setIsBusy(true);
    setFailed(false);
    try {
      await saveDiscoverable(uid, next);
    } catch {
      setFailed(true);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="flex min-h-touch cursor-pointer items-center gap-3 text-fg">
        <input type="checkbox" checked={discoverable} disabled={isBusy} aria-describedby={hintId} onChange={(event) => void toggle(event.target.checked)} className="size-5 accent-accent" />
        Let new organizations invite me
      </label>
      <p id={hintId} className="max-w-[60ch] text-sm text-fg-muted">
        Organizations only ever see your first name and last initial. Organizations you have already helped can invite you either way.
      </p>
      {failed ? (
        <p role="alert" className="text-sm font-medium text-status-danger">
          That didn't save. Try again.
        </p>
      ) : null}
    </div>
  );
};

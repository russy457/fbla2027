/**
 * SaveToggle.tsx
 * Save / Saved toggle for an opportunity or an organization (SPEC 3.18,
 * SPEC#screen-inventory "save" secondary actions). A client write under the
 * rules (users/{uid}/saved/{kind}_{refId}), so it is the one place the UI may
 * update before the server answers; the pressed state still comes from the
 * live saved-items snapshot. Signed-out visitors do not see it.
 */
import { useState, type ReactElement } from "react";
import { BookmarkSimple } from "@phosphor-icons/react";
import type { SavedKind } from "@fbla/shared";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { useSavedItems } from "@/hooks/useInbox";
import { saveItem, unsaveItem } from "@/lib/data/inbox";
import { useSessionUser } from "@/store/authStore";

interface SaveToggleProps {
  readonly kind: SavedKind;
  readonly refId: string;
  /** What is being saved, for the accessible name ("Save Sort and pack food boxes"). */
  readonly label: string;
}

export const SaveToggle = ({ kind, refId, label }: SaveToggleProps): ReactElement | null => {
  const user = useSessionUser();
  const saved = useSavedItems(user?.uid ?? null);
  const [isBusy, setIsBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!user) return null;
  const isSaved = (saved.data ?? []).some((item) => item.kind === kind && item.refId === refId);

  const toggle = async (): Promise<void> => {
    setIsBusy(true);
    setFailed(false);
    try {
      if (isSaved) await unsaveItem(user.uid, kind, refId);
      else await saveItem(user.uid, kind, refId);
    } catch {
      setFailed(true);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        aria-pressed={isSaved}
        aria-label={`${isSaved ? "Saved" : "Save"}: ${label}`}
        disabled={isBusy}
        onClick={() => void toggle()}
        className={buttonClassName("quiet")}
      >
        <BookmarkSimple aria-hidden="true" size={18} weight={isSaved ? "fill" : "regular"} />
        {isSaved ? "Saved" : "Save"}
      </button>
      {failed ? (
        <span role="alert" className="text-xs text-status-danger">
          That didn't save. Try again.
        </span>
      ) : null}
    </span>
  );
};

/**
 * CommandPaletteLauncher.tsx
 * The header "Search" button plus the global Ctrl/Cmd+K shortcut. It owns
 * the palette's open state, its data, and focus restore (same contract as
 * the quick help launcher):
 *
 *   open     remember what had focus, render the palette in a portal on
 *            <body> (the sticky header's backdrop blur would trap a fixed
 *            child inside the header box)
 *   close    Esc, the close button, or the backdrop: focus goes back to
 *            where it was
 *   select   navigate; focus is left to the layout's focus-main-on-navigate
 *            (or restored when the item points at the current page)
 *
 * The header button shows from 640 px up: a phone header at 150% text has no
 * room for it (e2e/tier1-laneA.spec.ts overflow check), and phones reach the
 * same places through the tab bar, Explore search, and Help.
 *
 * Not available on a kiosk session (G15: the kiosk is locked to one shift);
 * the kiosk route renders without the app shell as well.
 */
import { useCallback, useRef, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { useLocation, useNavigate } from "react-router-dom";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { getHelpLibrary, type HelpLibrary } from "@/lib/help";
import type { PaletteItem } from "@/lib/palette/paletteCommands";
import { useSession } from "@/store/authStore";
import { CommandPalette } from "./CommandPalette";
import { usePaletteShortcut } from "./usePaletteShortcut";
import { usePaletteSources } from "./usePaletteSources";

interface CommandPaletteLauncherProps {
  /** Injected in tests; the app uses the bundled help articles. */
  readonly getLibrary?: () => HelpLibrary;
}

/** True when the device most likely has a Mac keyboard (shows Cmd instead of Ctrl). */
const isApplePlatform = (): boolean => typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);

export const CommandPaletteLauncher = ({ getLibrary = getHelpLibrary }: CommandPaletteLauncherProps): ReactElement | null => {
  const session = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const sources = usePaletteSources(isOpen, location.pathname, getLibrary);
  const isKiosk = session.status === "kiosk";

  const open = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) returnFocusRef.current = document.activeElement;
    setIsOpen(true);
  }, []);

  const closeByUser = useCallback(() => {
    setIsOpen(false);
    const target = returnFocusRef.current;
    returnFocusRef.current = null;
    // Wait one frame so the dialog has unmounted before focus moves back.
    requestAnimationFrame(() => {
      if (target?.isConnected) target.focus();
    });
  }, []);

  const toggle = useCallback(() => {
    if (isKiosk) return;
    if (isOpen) closeByUser();
    else open();
  }, [isKiosk, isOpen, closeByUser, open]);

  usePaletteShortcut(toggle);

  const select = (item: PaletteItem): void => {
    if (item.to === `${location.pathname}${location.search}`) {
      closeByUser();
      return;
    }
    returnFocusRef.current = null;
    setIsOpen(false);
    navigate(item.to);
  };

  if (isKiosk) return null;
  const modifier = isApplePlatform() ? "Cmd" : "Ctrl";
  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-keyshortcuts="Control+K Meta+K"
        className={buttonClassName("secondary", "hidden px-3 sm:inline-flex")}
      >
        <MagnifyingGlass aria-hidden="true" size={18} />
        <span className="sr-only lg:not-sr-only">Search</span>
        <kbd aria-hidden="true" className="hidden rounded-sm border border-border px-1 font-mono text-xs text-fg-muted lg:inline">
          {modifier} K
        </kbd>
      </button>
      {isOpen ? createPortal(<CommandPalette sources={sources} onSelect={select} onClose={closeByUser} />, document.body) : null}
    </>
  );
};

/**
 * HelpPanelLauncher.tsx
 * The "Quick help" button in the app header plus the global "?" shortcut.
 * It owns the panel's open state and focus restore:
 *
 *   open    remember what had focus, render the panel in a portal on <body>
 *           (the sticky header's backdrop blur would otherwise trap a fixed
 *           child inside the header box)
 *   close   by the user (Esc, close button, backdrop): focus returns to the
 *           element that had it before opening
 *   route   a link inside the panel navigated: close without restoring, so
 *           the layout's focus-main-on-navigate behavior wins
 */
import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";
import { Question } from "@phosphor-icons/react";
import { useLocation } from "react-router-dom";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { getHelpLibrary, type HelpLibrary } from "@/lib/help";
import { HelpPanel } from "./HelpPanel";
import { useHelpShortcut } from "./useHelpShortcut";

interface HelpPanelLauncherProps {
  /** Injected in tests; the app uses the bundled article library. */
  readonly library?: HelpLibrary;
}

export const HelpPanelLauncher = ({ library }: HelpPanelLauncherProps): ReactElement => {
  const [isOpen, setIsOpen] = useState(false);
  const { pathname } = useLocation();
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const openedOnPathRef = useRef(pathname);

  const open = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) returnFocusRef.current = document.activeElement;
    openedOnPathRef.current = pathname;
    setIsOpen(true);
  }, [pathname]);

  const closeByUser = useCallback(() => {
    setIsOpen(false);
    const target = returnFocusRef.current;
    returnFocusRef.current = null;
    // Wait one frame so the panel has unmounted before focus moves back.
    requestAnimationFrame(() => {
      if (target?.isConnected) target.focus();
    });
  }, []);

  useHelpShortcut(open);

  // A navigation from inside the panel closes it; focus is left to the layout.
  useEffect(() => {
    if (isOpen && pathname !== openedOnPathRef.current) {
      returnFocusRef.current = null;
      setIsOpen(false);
    }
  }, [isOpen, pathname]);

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-keyshortcuts="?"
        className={buttonClassName("secondary", "px-3")}
      >
        <Question aria-hidden="true" size={18} />
        <span className="sr-only sm:not-sr-only">Quick help</span>
        <kbd aria-hidden="true" className="hidden rounded-sm border border-border px-1 font-mono text-xs text-fg-muted lg:inline">
          ?
        </kbd>
      </button>
      {isOpen
        ? createPortal(
            <HelpPanel library={library ?? getHelpLibrary()} pathname={pathname} onClose={closeByUser} />,
            document.body
          )
        : null}
    </>
  );
};

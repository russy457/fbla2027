/**
 * usePaletteShortcut.ts
 * Global Ctrl+K (Windows, Linux) / Cmd+K (macOS) shortcut that toggles the
 * command palette. Unlike the "?" quick-help key it works while typing,
 * because a modifier chord never types text. It stays out of the way when
 * another modal dialog (quick help) is open, so two focus traps never fight,
 * and when another handler already claimed the key.
 */
import { useEffect } from "react";

/** True for Ctrl+K or Cmd+K without Shift or Alt. */
export const isPaletteChord = (event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">): boolean =>
  (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k";

/** True when a modal dialog other than the palette is open. */
const otherModalIsOpen = (): boolean => document.querySelector('[role="dialog"][aria-modal="true"]:not([data-command-palette])') !== null;

export const usePaletteShortcut = (onToggle: () => void): void => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !isPaletteChord(event)) return;
      // Browsers bind Ctrl+K to "search the web"; inside the app the chord belongs to the palette,
      // even while another dialog is open (where it does nothing, so focus never leaves the page).
      event.preventDefault();
      if (!otherModalIsOpen()) onToggle();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onToggle]);
};

/**
 * useFocusTrap.ts
 * Keeps keyboard focus inside a modal container (SPEC 9.16: focus handling
 * for modals). While active: the initial element is focused on mount, Tab and
 * Shift+Tab wrap around the container's focusable elements, and Escape calls
 * onEscape. Restoring focus after close is the opener's job, because only the
 * opener knows whether the close came from the user or from a navigation.
 */
import { useEffect, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

/** Focusable descendants in DOM order, skipping hidden ones. */
export const focusableWithin = (container: HTMLElement): HTMLElement[] =>
  [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
    (element) => !element.hasAttribute("hidden") && element.getAttribute("aria-hidden") !== "true"
  );

interface FocusTrapOptions {
  readonly containerRef: RefObject<HTMLElement>;
  /** Element to focus first; falls back to the first focusable element. */
  readonly initialFocusRef?: RefObject<HTMLElement>;
  readonly onEscape: () => void;
}

export const useFocusTrap = ({ containerRef, initialFocusRef, onEscape }: FocusTrapOptions): void => {
  // Initial focus once, when the trap mounts.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const target = initialFocusRef?.current ?? focusableWithin(container)[0] ?? container;
    target.focus();
  }, [containerRef, initialFocusRef]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const container = containerRef.current;
      if (!container) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onEscape();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = focusableWithin(container);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) {
        event.preventDefault();
        return;
      }
      const active = document.activeElement;
      const isOutside = !container.contains(active);
      // Wrap at either end, and pull focus back in if it ever escaped.
      if (event.shiftKey && (active === first || isOutside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || isOutside)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [containerRef, onEscape]);
};

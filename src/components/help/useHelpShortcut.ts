/**
 * useHelpShortcut.ts
 * Global "?" keyboard shortcut that opens quick help. It is ignored while
 * the user is typing (inputs, text areas, selects, contenteditable), when a
 * modifier other than Shift is held, or when another handler already
 * claimed the key, so it never steals a typed question mark.
 */
import { useEffect } from "react";

const TYPING_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/** True when a key press on this target would type text. */
export const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return TYPING_TAGS.has(target.tagName) || target.isContentEditable;
};

export const useHelpShortcut = (onTrigger: () => void): void => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "?" || event.defaultPrevented) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      onTrigger();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onTrigger]);
};

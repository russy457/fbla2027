/** Gentle wheel scrolling on desktop. Touch and reduced-motion scrolling stay native. */
import { useEffect } from "react";
import Lenis from "lenis";

export const SmoothScroll = (): null => {
  useEffect(() => {
    const root = document.documentElement;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    let scroller: Lenis | null = null;

    const update = (): void => {
      const reduce = root.dataset.motion === "reduced" || reducedMotion?.matches === true;
      if (reduce) {
        scroller?.destroy();
        scroller = null;
      } else if (!scroller) {
        scroller = new Lenis({
          autoRaf: true,
          anchors: true,
          allowNestedScroll: true,
          lerp: 0.18,
          wheelMultiplier: 0.9,
          syncTouch: false
        });
      }
    };

    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["data-motion"] });
    reducedMotion?.addEventListener("change", update);
    update();

    return () => {
      observer.disconnect();
      reducedMotion?.removeEventListener("change", update);
      scroller?.destroy();
    };
  }, []);

  return null;
};

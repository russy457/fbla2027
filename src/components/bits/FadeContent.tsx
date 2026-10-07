/**
 * FadeContent.tsx
 * Fades its children in (optionally from a blur) when they enter the viewport.
 * Plan D15: use only for route transitions (see src/layouts/AppLayout.tsx).
 *
 * Source: https://reactbits.dev/r/FadeContent-TS-TW.json (React Bits, https://github.com/DavidHDev/react-bits)
 * Vendored: 2026-10-06
 * License: MIT + Commons Clause (React Bits). The components may not be sold on their own.
 * Local edits: removed "use client" and the demo-site "snap-main-container"
 * lookup; under reduced motion it renders children directly with no GSAP work;
 * the default duration reads the --duration-slow token; durations are seconds
 * only (the upstream "values over 10 are milliseconds" guess was removed).
 */
import { useEffect, useRef, type HTMLAttributes, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { readDurationSeconds } from "@/lib/motionTokens";

gsap.registerPlugin(ScrollTrigger);

const FALLBACK_DURATION_SECONDS = 0.4;

interface FadeContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  container?: Element | string | null;
  blur?: boolean;
  /** Seconds. Defaults to the --duration-slow token. */
  duration?: number;
  ease?: string;
  delay?: number;
  threshold?: number;
  initialOpacity?: number;
  disappearAfter?: number;
  disappearDuration?: number;
  disappearEase?: string;
  onComplete?: () => void;
  onDisappearanceComplete?: () => void;
}

const resolveScroller = (container: FadeContentProps["container"]): Element | Window => {
  if (typeof container === "string") return document.querySelector(container) ?? window;
  return container ?? window;
};

const FadeContent = ({
  children,
  container,
  blur = false,
  duration,
  ease = "power2.out",
  delay = 0,
  threshold = 0.1,
  initialOpacity = 0,
  disappearAfter = 0,
  disappearDuration = 0.5,
  disappearEase = "power2.in",
  onComplete,
  onDisappearanceComplete,
  className = "",
  ...props
}: FadeContentProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotionPreference();

  useEffect(() => {
    const element = ref.current;
    if (!element || reduceMotion) return undefined;

    const hiddenFilter = blur ? "blur(10px)" : "blur(0px)";
    gsap.set(element, { autoAlpha: initialOpacity, filter: hiddenFilter, willChange: "opacity, filter" });

    const timeline = gsap.timeline({
      paused: true,
      delay,
      onComplete: () => {
        gsap.set(element, { willChange: "auto" });
        onComplete?.();
        if (disappearAfter > 0) {
          gsap.to(element, {
            autoAlpha: initialOpacity,
            filter: hiddenFilter,
            delay: disappearAfter,
            duration: disappearDuration,
            ease: disappearEase,
            onComplete: () => onDisappearanceComplete?.()
          });
        }
      }
    });
    timeline.to(element, {
      autoAlpha: 1,
      filter: "blur(0px)",
      duration: duration ?? readDurationSeconds("--duration-slow", FALLBACK_DURATION_SECONDS),
      ease
    });

    const trigger = ScrollTrigger.create({
      trigger: element,
      scroller: resolveScroller(container),
      start: `top ${(1 - threshold) * 100}%`,
      once: true,
      onEnter: () => timeline.play()
    });

    return () => {
      trigger.kill();
      timeline.kill();
      gsap.killTweensOf(element);
      gsap.set(element, { clearProps: "all" });
    };
    // Deliberately runs once per mount like upstream (only the motion setting
    // re-runs it); remount with a React key to replay the fade.
  }, [reduceMotion]);

  return (
    <div ref={ref} className={className} {...props}>
      {children}
    </div>
  );
};

export default FadeContent;

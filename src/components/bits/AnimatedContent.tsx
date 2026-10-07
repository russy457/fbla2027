/**
 * AnimatedContent.tsx
 * Slides and fades its children into place when they scroll into view.
 * General purpose entrance animation; D15 limits where React Bits animation
 * appears, so check docs/SPEC.md before adding new uses.
 *
 * Source: https://reactbits.dev/r/AnimatedContent-TS-TW.json (React Bits, https://github.com/DavidHDev/react-bits)
 * Vendored: 2026-10-06
 * License: MIT + Commons Clause (React Bits). The components may not be sold on their own.
 * Local edits: removed "use client" and the demo-site "snap-main-container"
 * lookup; under reduced motion the content renders in place with no GSAP work;
 * default duration reads the --duration-slow token.
 */
import { useEffect, useRef, type HTMLAttributes, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { readDurationSeconds } from "@/lib/motionTokens";
import { cn } from "@/lib/cn";

gsap.registerPlugin(ScrollTrigger);

const FALLBACK_DURATION_SECONDS = 0.4;

interface AnimatedContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  container?: Element | string | null;
  distance?: number;
  direction?: "vertical" | "horizontal";
  reverse?: boolean;
  /** Seconds. Defaults to the --duration-slow token. */
  duration?: number;
  ease?: string;
  initialOpacity?: number;
  animateOpacity?: boolean;
  scale?: number;
  threshold?: number;
  delay?: number;
  disappearAfter?: number;
  disappearDuration?: number;
  disappearEase?: string;
  onComplete?: () => void;
  onDisappearanceComplete?: () => void;
}

const resolveScroller = (container: AnimatedContentProps["container"]): Element | Window => {
  if (typeof container === "string") return document.querySelector(container) ?? window;
  return container ?? window;
};

const AnimatedContent = ({
  children,
  container,
  distance = 100,
  direction = "vertical",
  reverse = false,
  duration,
  ease = "power3.out",
  initialOpacity = 0,
  animateOpacity = true,
  scale = 1,
  threshold = 0.1,
  delay = 0,
  disappearAfter = 0,
  disappearDuration = 0.5,
  disappearEase = "power3.in",
  onComplete,
  onDisappearanceComplete,
  className = "",
  ...props
}: AnimatedContentProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotionPreference();

  useEffect(() => {
    const element = ref.current;
    if (!element || reduceMotion) return undefined;

    const axis = direction === "horizontal" ? "x" : "y";
    const offset = reverse ? -distance : distance;
    const enterSeconds = duration ?? readDurationSeconds("--duration-slow", FALLBACK_DURATION_SECONDS);

    gsap.set(element, {
      [axis]: offset,
      scale,
      opacity: animateOpacity ? initialOpacity : 1,
      visibility: "visible"
    });

    const timeline = gsap.timeline({
      paused: true,
      delay,
      onComplete: () => {
        onComplete?.();
        if (disappearAfter > 0) {
          gsap.to(element, {
            [axis]: reverse ? distance : -distance,
            scale: 0.8,
            opacity: animateOpacity ? initialOpacity : 0,
            delay: disappearAfter,
            duration: disappearDuration,
            ease: disappearEase,
            onComplete: () => onDisappearanceComplete?.()
          });
        }
      }
    });
    timeline.to(element, { [axis]: 0, scale: 1, opacity: 1, duration: enterSeconds, ease });

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
    };
  }, [
    reduceMotion,
    container,
    distance,
    direction,
    reverse,
    duration,
    ease,
    initialOpacity,
    animateOpacity,
    scale,
    threshold,
    delay,
    disappearAfter,
    disappearDuration,
    disappearEase,
    onComplete,
    onDisappearanceComplete
  ]);

  return (
    <div ref={ref} className={cn(!reduceMotion && "invisible", className)} {...props}>
      {children}
    </div>
  );
};

export default AnimatedContent;

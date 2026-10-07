/**
 * CountUp.tsx
 * Animated number that counts from one value to another when it scrolls into
 * view. Plan D15: use only for the Impact hours total and the milestone moment.
 *
 * Source: https://reactbits.dev/r/CountUp-TS-TW.json (React Bits, https://github.com/DavidHDev/react-bits)
 * Vendored: 2026-10-06
 * License: MIT + Commons Clause (React Bits). The components may not be sold on their own.
 * Local edits: removed the Next.js "use client" directive; respects reduced
 * motion (shows the final value at once); strict index checks; no colors of its
 * own (inherits text color from tokens through className).
 */
import { useInView, useMotionValue, useSpring } from "motion/react";
import { useCallback, useEffect, useRef } from "react";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";

interface CountUpProps {
  to: number;
  from?: number;
  direction?: "up" | "down";
  delay?: number;
  duration?: number;
  className?: string;
  startWhen?: boolean;
  separator?: string;
  onStart?: () => void;
  onEnd?: () => void;
}

const getDecimalPlaces = (num: number): number => {
  const decimals = num.toString().split(".")[1];
  return decimals && parseInt(decimals, 10) !== 0 ? decimals.length : 0;
};

export default function CountUp({
  to,
  from = 0,
  direction = "up",
  delay = 0,
  duration = 2,
  className = "",
  startWhen = true,
  separator = "",
  onStart,
  onEnd
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduceMotion = useReducedMotionPreference();
  const startValue = direction === "down" ? to : from;
  const endValue = direction === "down" ? from : to;
  const motionValue = useMotionValue(startValue);

  const damping = 20 + 40 * (1 / duration);
  const stiffness = 100 * (1 / duration);
  const springValue = useSpring(motionValue, { damping, stiffness });
  const isInView = useInView(ref, { once: true, margin: "0px" });
  const maxDecimals = Math.max(getDecimalPlaces(from), getDecimalPlaces(to));

  const formatValue = useCallback(
    (latest: number) => {
      const options: Intl.NumberFormatOptions = {
        useGrouping: !!separator,
        minimumFractionDigits: maxDecimals,
        maximumFractionDigits: maxDecimals
      };
      const formatted = Intl.NumberFormat("en-US", options).format(latest);
      return separator ? formatted.replace(/,/g, separator) : formatted;
    },
    [maxDecimals, separator]
  );

  useEffect(() => {
    if (ref.current) ref.current.textContent = formatValue(startValue);
  }, [startValue, formatValue]);

  useEffect(() => {
    if (!isInView || !startWhen) return undefined;
    onStart?.();

    if (reduceMotion) {
      // No counting animation: show the final number immediately.
      if (ref.current) ref.current.textContent = formatValue(endValue);
      onEnd?.();
      return undefined;
    }

    const startTimer = setTimeout(() => motionValue.set(endValue), delay * 1000);
    const endTimer = setTimeout(() => onEnd?.(), delay * 1000 + duration * 1000);
    return () => {
      clearTimeout(startTimer);
      clearTimeout(endTimer);
    };
  }, [isInView, startWhen, reduceMotion, motionValue, endValue, delay, duration, formatValue, onStart, onEnd]);

  useEffect(() => {
    const unsubscribe = springValue.on("change", (latest: number) => {
      if (ref.current) ref.current.textContent = formatValue(latest);
    });
    return () => unsubscribe();
  }, [springValue, formatValue]);

  return <span className={className} ref={ref} />;
}

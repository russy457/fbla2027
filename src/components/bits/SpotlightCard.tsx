/**
 * SpotlightCard.tsx
 * Card whose surface lights up under the pointer (or when focused from the
 * keyboard). Plan D15: use only for recommended shift cards.
 *
 * Source: https://reactbits.dev/r/SpotlightCard-TS-TW.json (React Bits, https://github.com/DavidHDev/react-bits)
 * Vendored: 2026-10-06
 * License: MIT + Commons Clause (React Bits). The components may not be sold on their own.
 * Local edits: removed "use client"; colors, radius, and timing come from
 * tokens (the spotlight color defaults to the --spotlight token); the pointer
 * position is written to CSS variables on the element instead of React state,
 * so moving the mouse no longer re-renders the card; the fade uses the
 * --duration-slow token, which is zero under reduced motion.
 */
import { useRef, useState, type MouseEventHandler, type PropsWithChildren } from "react";
import { cn } from "@/lib/cn";

interface SpotlightCardProps extends PropsWithChildren {
  className?: string;
  /** Any CSS color. Defaults to the --spotlight design token. */
  spotlightColor?: string;
}

const VISIBLE_OPACITY = 1;

const SpotlightCard = ({ children, className = "", spotlightColor = "var(--spotlight)" }: SpotlightCardProps) => {
  const divRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove: MouseEventHandler<HTMLDivElement> = (event) => {
    const element = divRef.current;
    if (!element || isFocused) return;
    const rect = element.getBoundingClientRect();
    element.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
    element.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onFocus={() => {
        setIsFocused(true);
        setOpacity(VISIBLE_OPACITY);
      }}
      onBlur={() => {
        setIsFocused(false);
        setOpacity(0);
      }}
      onMouseEnter={() => setOpacity(VISIBLE_OPACITY)}
      onMouseLeave={() => setOpacity(0)}
      className={cn("relative overflow-hidden rounded-lg border border-border bg-surface p-6 shadow-sm", className)}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-(--duration-slow) ease-out"
        style={{
          opacity,
          background: `radial-gradient(circle at var(--spot-x, 50%) var(--spot-y, 50%), ${spotlightColor}, transparent 80%)`
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
};

export default SpotlightCard;

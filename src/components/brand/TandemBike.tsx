/** Original single-ink tandem bicycle used by the wordmark and loading states. */
import { useEffect, useRef, type ReactElement } from "react";
import type { MotionValue } from "motion/react";
import { cn } from "@/lib/cn";

interface TandemBikeProps {
  readonly className?: string;
  readonly animated?: boolean;
  readonly wheelTurn?: MotionValue<number>;
}

const Wheel = ({ x }: { readonly x: number }): ReactElement => (
  <g className="tandem-bike__wheel" style={{ transformOrigin: `${x}px 76px` }}>
    <circle cx={x} cy="76" r="22" stroke="currentColor" strokeWidth="10" />
    <path d={`M${x} 76v-14m0 14 12 8m-12-8-12 8`} stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
    <circle cx={x} cy="76" r="4" fill="currentColor" />
  </g>
);

export const TandemBike = ({ className, animated = false, wheelTurn }: TandemBikeProps): ReactElement => {
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = svgRef.current;
    if (!wheelTurn || !svg) return;
    const update = (angle: number): void => svg.style.setProperty("--bike-wheel-turn", `${angle}deg`);
    update(wheelTurn.get());
    return wheelTurn.on("change", update);
  }, [wheelTurn]);

  return <svg
    ref={svgRef}
    className={cn("tandem-bike", animated && "tandem-bike--moving", className)}
    viewBox="0 0 256 104"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
  >
    <Wheel x={30} />
    <Wheel x={225} />
    <g className="tandem-bike__frame" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M30 76 78 38l26 38H30M78 38h72l-46 38h59l-13-38h38l37 38M188 38l-25 38" />
      <path d="M78 38V28m72 10V28m-38 10V23h13m63 15V20h13" />
    </g>
    <path d="M64 26h28m45 0h28" stroke="currentColor" strokeWidth="9" strokeLinecap="round" />
  </svg>;
};

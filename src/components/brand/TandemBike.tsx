/** Original single-ink tandem bicycle used by the wordmark and loading states. */
import type { ReactElement, Ref } from "react";
import { cn } from "@/lib/cn";

interface TandemBikeProps {
  readonly className?: string;
  readonly animated?: boolean;
  readonly svgRef?: Ref<SVGSVGElement>;
}

const Wheel = ({ x }: { readonly x: number }): ReactElement => (
  <g className="tandem-bike__wheel" style={{ transformOrigin: `${x}px 76px` }}>
    <circle cx={x} cy="76" r="22" fill="none" stroke="currentColor" strokeWidth="7" />
    <path d={`M${x} 56v40 M${x - 20} 76h40 M${x - 14} 62l28 28 M${x + 14} 62l-28 28`} fill="none" stroke="currentColor" strokeWidth="2" opacity=".72" />
    <circle cx={x} cy="76" r="4" fill="currentColor" />
  </g>
);

export const TandemBike = ({ className, animated = false, svgRef }: TandemBikeProps): ReactElement => (
  <svg
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
    <g className="tandem-bike__frame" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M30 76 78 36 103 76 30 76M78 36h72l-47 40h60l-13-40h39l36 40M189 36l-26 40" />
      <path d="M78 36 75 29M150 36l-3-8M189 36l-3-15" />
      <path d="M111 37V22h13M186 21h14l-3 5" />
    </g>
    <path d="M62 26c0-2 2-3 4-3h26c1 0 2 1 2 2 0 3-4 5-8 5H65c-2 0-3-2-3-4Zm72 0c0-2 2-3 4-3h26c1 0 2 1 2 2 0 3-4 5-8 5h-21c-2 0-3-2-3-4Z" fill="currentColor" />
    <g className="tandem-bike__crank" style={{ transformOrigin: "103px 76px" }}>
      <circle cx="103" cy="76" r="3" fill="currentColor" />
      <path d="M103 76v-10m-4 0h8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </g>
    <g className="tandem-bike__crank" style={{ transformOrigin: "163px 76px" }}>
      <circle cx="163" cy="76" r="3" fill="currentColor" />
      <path d="M163 76v-10m-4 0h8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </g>
  </svg>
);

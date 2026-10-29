import { useEffect, useRef, useState, type ReactElement } from "react";
import { cn } from "@/lib/cn";
import { TandemBike } from "./TandemBike";

interface BikeLoaderProps {
  readonly className?: string;
}

/** Decorative motion only. The parent provides the loading announcement. */
export const BikeLoader = ({ className }: BikeLoaderProps): ReactElement => {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!ref.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry?.isIntersecting ?? true), { threshold: 0.1 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={cn("bike-loader", className)} data-visible={isVisible} aria-hidden="true">
      <TandemBike animated />
      <span className="bike-loader__road">
        <span />
        <span />
        <span />
      </span>
    </div>
  );
};

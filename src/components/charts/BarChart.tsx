/**
 * BarChart.tsx
 * A token-styled, accessible horizontal bar chart (Tier 2 lane B, SPEC 8.6
 * reliability charts; SPEC 9.16 accessibility). Hand-built SVG instead of a
 * chart library: one series, a few bars, and every color comes from tokens
 * (fill-accent, fill-surface-sunken, text-fg), so the design-doc reskin
 * restyles it with tokens.css alone.
 *
 * Accessibility:
 *   - <figure> + <figcaption> names the chart; the SVG is role="img" with
 *     <title> and <desc> (a one-sentence summary of every value),
 *   - each bar prints its value as text beside it and carries a native
 *     <title> tooltip, so nothing relies on bar length or color alone,
 *   - "Show data table" reveals the same numbers as a real table.
 * The same rows feed the PDF (functions/src/reports/pdf/sections) and CSV.
 */
import { useId, type ReactElement } from "react";

export interface BarDatum {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  /** Printed beside the bar and in the table, for example "3 volunteers". */
  readonly valueLabel: string;
}

interface BarChartProps {
  readonly title: string;
  /** One sentence for screen readers that states the takeaway or every value. */
  readonly description: string;
  readonly data: readonly BarDatum[];
  /** Header of the value column in the data table. */
  readonly valueHeader: string;
}

const ROW = 28;
const BAR = 14;
const LABEL_WIDTH = 180;
const VALUE_WIDTH = 110;
const TRACK_WIDTH = 320;
const WIDTH = LABEL_WIDTH + TRACK_WIDTH + VALUE_WIDTH;
/** Rounded data end (4px) per the chart mark spec; the baseline end stays square via the clip. */
const RADIUS = 4;

export const BarChart = ({ title, description, data, valueHeader }: BarChartProps): ReactElement => {
  const id = useId();
  const titleId = `${id}-title`;
  const descId = `${id}-desc`;
  const max = Math.max(1, ...data.map((datum) => datum.value));
  const height = data.length * ROW;

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="sr-only">{title}</figcaption>
      <svg role="img" aria-labelledby={`${titleId} ${descId}`} viewBox={`0 0 ${WIDTH} ${height}`} className="h-auto w-full max-w-2xl overflow-visible" preserveAspectRatio="xMinYMin meet">
        <title id={titleId}>{title}</title>
        <desc id={descId}>{description}</desc>
        {data.map((datum, index) => {
          const y = index * ROW;
          const width = (datum.value / max) * TRACK_WIDTH;
          return (
            <g key={datum.key}>
              <title>{`${datum.label}: ${datum.valueLabel}`}</title>
              <text x={0} y={y + ROW / 2} dominantBaseline="middle" className="fill-fg-muted text-[13px]">
                {datum.label}
              </text>
              <rect x={LABEL_WIDTH} y={y + (ROW - BAR) / 2} width={TRACK_WIDTH} height={BAR} rx={RADIUS} className="fill-surface-sunken" />
              {width > 0 ? <rect x={LABEL_WIDTH} y={y + (ROW - BAR) / 2} width={Math.max(width, RADIUS * 2)} height={BAR} rx={RADIUS} className="fill-accent" /> : null}
              <text x={WIDTH} y={y + ROW / 2} dominantBaseline="middle" textAnchor="end" className="fill-fg font-mono text-[13px] font-semibold">
                {datum.valueLabel}
              </text>
            </g>
          );
        })}
      </svg>
      <details className="text-sm">
        <summary className="w-fit cursor-pointer font-semibold text-accent underline-offset-2 hover:underline">Show data table</summary>
        <table className="mt-2 w-full max-w-md text-left">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr className="border-b border-border-strong text-fg-muted">
              <th scope="col" className="py-1.5 pr-3 font-semibold">Group</th>
              <th scope="col" className="py-1.5 pr-3 font-semibold">{valueHeader}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((datum) => (
              <tr key={datum.key}>
                <th scope="row" className="py-1.5 pr-3 font-normal text-fg">{datum.label}</th>
                <td className="py-1.5 pr-3 font-mono text-fg">{datum.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
};

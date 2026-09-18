import type { ReactNode } from "react";
import { formatNumber } from "@/lib/admin/format";

// ---------------------------------------------------------------------------
// Charts, hand-rolled as inline SVG.
//
// No charting dependency -- the brief said not to add unnecessary ones, and
// every chart the admin needs is a single-series magnitude or change-over-
// time plot, which is a few lines of SVG.
//
// Conventions held throughout (these are deliberate, not stylistic drift):
//   * ONE series per chart, so no legend is needed -- the panel title names
//     the measure. Never two y-scales on one plot.
//   * Orange (the brand accent) is the data color. emerald/amber/rose stay
//     reserved for STATUS and are never used as a series color.
//   * Grid and axes are recessive: one hairline, slate-800.
//   * Hover uses native SVG <title>, so tooltips work with zero JavaScript
//     and survive server rendering.
//   * Bars get rounded ends anchored to the baseline and a 2px gap so
//     adjacent bars never merge into one block.
//   * Empty data renders an explicit "no data" state rather than an axis
//     with nothing on it.
// ---------------------------------------------------------------------------

const SERIES = "#f97316"; // orange-500
const GRID = "#1e293b"; // slate-800
const INK_MUTED = "#64748b"; // slate-500

export interface SeriesPoint {
  label: string;
  value: number;
}

function NoData({ height, message = "No data in this period" }: { height: number; message?: string }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg border border-dashed border-slate-800"
      style={{ height }}
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-600">{message}</span>
    </div>
  );
}

/**
 * Compact trend line for a KPI. No axes, no labels -- it shows shape only,
 * with the exact numbers living in the KPI value beside it.
 */
export function Sparkline({
  data,
  height = 36,
  width = 120,
}: {
  data: number[];
  height?: number;
  width?: number;
}) {
  if (data.length < 2 || data.every((v) => v === 0)) {
    return <div style={{ height, width }} className="rounded bg-slate-900/40" aria-hidden />;
  }

  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const stepX = width / (data.length - 1);

  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - 2 - ((v - min) / span) * (height - 4);
    return [x, y] as const;
  });

  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Trend">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={SERIES} stopOpacity="0.28" />
          <stop offset="100%" stopColor={SERIES} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark-fill)" />
      <path d={line} fill="none" stroke={SERIES} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="2.5" fill={SERIES} />
    </svg>
  );
}

/**
 * Change-over-time column chart. Used for signups/day, events/day, revenue
 * per period. Bars rather than a line because these are counts of discrete
 * events in discrete buckets, not a continuous measurement.
 */
export function BarSeries({
  data,
  height = 160,
  valueFormatter = formatNumber,
  emptyMessage,
}: {
  data: SeriesPoint[];
  height?: number;
  valueFormatter?: (n: number) => string;
  emptyMessage?: string;
}) {
  if (data.length === 0) return <NoData height={height} message={emptyMessage} />;

  const max = Math.max(...data.map((d) => d.value));
  if (max === 0) return <NoData height={height} message={emptyMessage} />;

  const plotHeight = height - 22; // leave room for the x labels

  // Axis labels: first, middle and last only, laid out with space-between
  // rather than one label per column. A per-column label gets clipped as soon
  // as the series is more than a handful of buckets wide, which is how you end
  // up with an axis reading "8/ 8/ 9/".
  const axisLabels =
    data.length <= 2
      ? data.map((d) => d.label)
      : [data[0].label, data[Math.floor(data.length / 2)].label, data[data.length - 1].label];

  return (
    <div>
      <div className="flex items-end gap-[2px]" style={{ height: plotHeight }}>
        {data.map((d, i) => {
          const h = d.value === 0 ? 2 : Math.max(3, (d.value / max) * plotHeight);
          return (
            <div key={`${d.label}-${i}`} className="group relative flex flex-1 items-end justify-center">
              <div
                className="w-full rounded-t-[4px] bg-orange-500/70 transition-colors group-hover:bg-orange-400"
                style={{ height: h }}
                title={`${d.label}: ${valueFormatter(d.value)}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between border-t pt-1.5" style={{ borderColor: GRID }}>
        {axisLabels.map((label, i) => (
          <span key={`${label}-${i}`} className="font-mono text-[9px] whitespace-nowrap" style={{ color: INK_MUTED }}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Ranked horizontal bars -- "most common makes", "most viewed guides".
 * Horizontal because the category labels are words, and words read
 * horizontally; a vertical version would need rotated labels.
 */
export function RankedBars({
  data,
  max: providedMax,
  valueFormatter = formatNumber,
  emptyMessage = "No data yet",
  hrefFor,
}: {
  data: SeriesPoint[];
  max?: number;
  valueFormatter?: (n: number) => string;
  emptyMessage?: string;
  hrefFor?: (point: SeriesPoint) => string | undefined;
}) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-800 px-4 py-8 text-center">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-600">{emptyMessage}</span>
      </div>
    );
  }

  const max = providedMax ?? Math.max(...data.map((d) => d.value), 1);

  return (
    <ul className="space-y-2">
      {data.map((d, i) => {
        const pct = Math.max(2, (d.value / max) * 100);
        const href = hrefFor?.(d);
        const row = (
          <>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="truncate text-xs text-slate-300">{d.label}</span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-slate-400">
                {valueFormatter(d.value)}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800/70">
              <div className="h-full rounded-full bg-orange-500/80" style={{ width: `${pct}%` }} />
            </div>
          </>
        );
        return (
          <li key={`${d.label}-${i}`}>
            {href ? (
              <a href={href} className="block rounded transition-opacity hover:opacity-80">
                {row}
              </a>
            ) : (
              row
            )}
          </li>
        );
      })}
    </ul>
  );
}

export interface FunnelStage {
  label: string;
  value: number;
  hint?: string;
}

/**
 * Conversion funnel, drawn as ranked horizontal bars rather than a tapering
 * trapezoid. A real funnel shape distorts the comparison (area vs. length),
 * and the question being asked here -- "where do people drop out?" -- is a
 * magnitude comparison between adjacent stages, which bars answer directly.
 * Each stage shows both its share of the top of funnel and its step-to-step
 * conversion, because those answer different questions.
 */
export function Funnel({ stages }: { stages: FunnelStage[] }) {
  const top = stages[0]?.value ?? 0;

  if (top === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-800 px-4 py-10 text-center">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-600">
          Waiting for data — no activity recorded yet
        </span>
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {stages.map((stage, i) => {
        const shareOfTop = (stage.value / top) * 100;
        const prev = i > 0 ? stages[i - 1].value : null;
        const stepConversion = prev && prev > 0 ? (stage.value / prev) * 100 : null;
        const dropped = prev !== null ? prev - stage.value : 0;

        return (
          <li key={stage.label}>
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="text-xs font-medium text-slate-300">
                <span className="mr-2 font-mono text-[10px] text-slate-600">{String(i + 1).padStart(2, "0")}</span>
                {stage.label}
              </span>
              <span className="flex items-baseline gap-2 font-mono text-[11px] tabular-nums">
                <span className="text-slate-200">{formatNumber(stage.value)}</span>
                {stepConversion !== null && (
                  <span className={stepConversion >= 50 ? "text-emerald-400" : "text-amber-400"}>
                    {stepConversion.toFixed(0)}%
                  </span>
                )}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800/70">
              <div
                className="h-full rounded-full bg-orange-500/80"
                style={{ width: `${Math.max(shareOfTop, 0.5)}%` }}
              />
            </div>
            {prev !== null && dropped > 0 && (
              <div className="mt-1 font-mono text-[10px] text-slate-600">
                −{formatNumber(dropped)} dropped off here
              </div>
            )}
            {stage.hint && <div className="mt-1 text-[10px] text-slate-600">{stage.hint}</div>}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * A labelled progress meter -- guide completeness, coverage percentages.
 * Tone is chosen by the caller because "80%" is good for coverage and bad
 * for error rate; the component shouldn't guess.
 */
export function Meter({
  value,
  max = 100,
  tone = "accent",
  label,
  caption,
}: {
  value: number;
  max?: number;
  tone?: "accent" | "positive" | "warning" | "critical";
  label?: ReactNode;
  caption?: ReactNode;
}) {
  const pct = max === 0 ? 0 : Math.min(100, Math.max(0, (value / max) * 100));
  const fill = {
    accent: "bg-orange-500/80",
    positive: "bg-emerald-500/80",
    warning: "bg-amber-500/80",
    critical: "bg-rose-500/80",
  }[tone];

  return (
    <div>
      {(label || caption) && (
        <div className="mb-1 flex items-baseline justify-between gap-3">
          {label && <span className="truncate text-xs text-slate-300">{label}</span>}
          {caption && <span className="shrink-0 font-mono text-[11px] tabular-nums text-slate-400">{caption}</span>}
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800/70">
        <div className={`h-full rounded-full ${fill}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

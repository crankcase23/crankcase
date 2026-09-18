// Reporting-period handling, shared by every section that has a date filter.
// One definition so "30 days" means the same thing on the Command Center,
// Revenue and Analytics -- and so the previous-period comparison is always
// the immediately preceding window of the same length.

export const PERIODS = ["today", "7d", "30d", "90d", "all"] as const;
export type Period = (typeof PERIODS)[number];

export const PERIOD_LABELS: Record<Period, string> = {
  today: "Today",
  "7d": "7 Days",
  "30d": "30 Days",
  "90d": "90 Days",
  all: "All Time",
};

export function parsePeriod(value: string | undefined): Period {
  return (PERIODS as readonly string[]).includes(value ?? "") ? (value as Period) : "30d";
}

export interface PeriodRange {
  period: Period;
  label: string;
  /** null for "all time" -- callers omit the lower bound entirely. */
  start: Date | null;
  end: Date;
  /** Start of the immediately preceding window of equal length, for deltas. */
  previousStart: Date | null;
  previousEnd: Date | null;
  /** Number of day-buckets to draw in a time series for this period. */
  buckets: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function resolvePeriod(period: Period): PeriodRange {
  const end = new Date();

  if (period === "all") {
    return {
      period,
      label: PERIOD_LABELS[period],
      start: null,
      end,
      previousStart: null,
      previousEnd: null,
      buckets: 30,
    };
  }

  if (period === "today") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const previousStart = new Date(start.getTime() - DAY_MS);
    return {
      period,
      label: PERIOD_LABELS[period],
      start,
      end,
      previousStart,
      previousEnd: start,
      buckets: 1,
    };
  }

  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const start = new Date(end.getTime() - days * DAY_MS);
  return {
    period,
    label: PERIOD_LABELS[period],
    start,
    end,
    previousStart: new Date(start.getTime() - days * DAY_MS),
    previousEnd: start,
    buckets: days,
  };
}

/** Bucket boundaries for a daily time series covering the range. */
export function dayBuckets(range: PeriodRange, fallbackDays = 30): { start: Date; label: string }[] {
  const days = range.start ? Math.max(1, Math.round((range.end.getTime() - range.start.getTime()) / DAY_MS)) : fallbackDays;
  const capped = Math.min(days, 90);
  const out: { start: Date; label: string }[] = [];
  for (let i = capped - 1; i >= 0; i--) {
    const d = new Date(range.end.getTime() - i * DAY_MS);
    d.setHours(0, 0, 0, 0);
    out.push({ start: d, label: `${d.getMonth() + 1}/${d.getDate()}` });
  }
  return out;
}

/** Preserves the current period when building a link to another admin page. */
export function withPeriod(href: string, period: Period): string {
  if (period === "30d") return href;
  return href + (href.includes("?") ? "&" : "?") + `period=${period}`;
}

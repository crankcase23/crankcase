import Link from "next/link";
import { PERIODS, PERIOD_LABELS, type Period } from "@/lib/admin/periods";

// Reporting-period switch. Rendered as links rather than a client-side
// control so the selected period lives in the URL -- which means it can be
// bookmarked, shared, and survives a refresh, and the page stays a server
// component with no hydration cost.
export default function PeriodPicker({
  current,
  basePath,
  extraParams,
}: {
  current: Period;
  basePath: string;
  extraParams?: Record<string, string | undefined>;
}) {
  function hrefFor(period: Period) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(extraParams ?? {})) {
      if (v) params.set(k, v);
    }
    params.set("period", period);
    return `${basePath}?${params.toString()}`;
  }

  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-lg border border-slate-800 bg-slate-900/60 p-0.5"
      role="group"
      aria-label="Reporting period"
    >
      {PERIODS.map((p) => {
        const active = p === current;
        return (
          <Link
            key={p}
            href={hrefFor(p)}
            aria-current={active ? "true" : undefined}
            className={`rounded-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
              active ? "bg-orange-500 text-slate-950" : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            }`}
          >
            {PERIOD_LABELS[p]}
          </Link>
        );
      })}
    </div>
  );
}

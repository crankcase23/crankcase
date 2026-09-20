import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/rbac";
import {
  listCoverage,
  getCoverageSummary,
  applyFilters,
  getFilterOptions,
  JOB_CATALOG,
  type CoverageStatus,
} from "@/lib/admin/coverage";
import {
  PageHeader,
  Panel,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  Badge,
  EmptyState,
  KpiCard,
  MicroLabel,
} from "@/components/admin/ui";
import { Meter } from "@/components/admin/charts";

export const metadata = { title: "Guide Coverage" };

const STATUS_TONE: Record<CoverageStatus, "positive" | "warning" | "critical"> = {
  complete: "positive",
  "in-progress": "warning",
  "not-started": "critical",
};

const STATUS_LABEL: Record<CoverageStatus, string> = {
  complete: "Complete",
  "in-progress": "In progress",
  "not-started": "Not started",
};

const SELECT =
  "rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-sm text-slate-200 " +
  "focus:border-orange-500/60 focus:outline-none focus:ring-1 focus:ring-orange-500/40";

export default async function AdminCoveragePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; make?: string; model?: string; status?: string; job?: string }>;
}) {
  const ctx = await requireAdmin("guides.view");
  if (!ctx) redirect("/admin");

  const params = await searchParams;
  const filters = {
    year: params.year || undefined,
    make: params.make || undefined,
    model: params.model || undefined,
    status: params.status || undefined,
    job: params.job || undefined,
  };

  const all = listCoverage();
  // Tiles always describe the whole catalog, never the filtered view -- a
  // headline number that changes when you filter a table is a number nobody
  // can quote. The filtered count is shown on the table panel instead.
  const summary = getCoverageSummary(all);
  const rows = applyFilters(all, filters);
  const { years, makes, models } = getFilterOptions(all, filters);

  const filtersActive = Boolean(filters.year || filters.make || filters.model || filters.status || filters.job);

  // Which job is missing on the most vehicles, descending. This is the
  // "what should I build next" list, and it is the reason the report exists
  // rather than a per-vehicle checklist alone.
  const gaps = JOB_CATALOG.map((job) => {
    const applicable = all.filter((r) => job.appliesTo(r.vehicle));
    const missingOn = applicable.filter((r) => r.missing.some((m) => m.id === job.id));
    return { job, applicable: applicable.length, missingOn: missingOn.length };
  })
    .filter((g) => g.applicable > 0)
    .sort((a, b) => b.missingOn - a.missingOn || a.job.label.localeCompare(b.job.label));

  return (
    <>
      <PageHeader
        title="Guide Coverage"
        description="How many guides each vehicle should have, how many are written, and what is left. Targets are computed per vehicle — a front-wheel-drive car is not counted as missing a differential service, and an EV is not counted as missing an oil change."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Vehicles" value={summary.vehicles} hint={`${summary.vehiclesComplete} complete`} />
        <KpiCard label="Guides built" value={summary.builtGuides} tone="accent" />
        <KpiCard label="Target guides" value={summary.targetGuides} hint="Applicable jobs, all vehicles" />
        <KpiCard
          label="Remaining"
          value={summary.remainingGuides}
          tone={summary.remainingGuides > 0 ? "warning" : "positive"}
        />
        <KpiCard
          label="Coverage"
          value={`${summary.pct}%`}
          tone={summary.pct >= 80 ? "positive" : summary.pct >= 40 ? "warning" : "critical"}
          hint={`${summary.vehiclesNotStarted} not started · ${summary.vehiclesInProgress} in progress`}
        />
      </div>

      {summary.unclassifiedGuides.length > 0 && (
        <div className="mb-5 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
          <MicroLabel>Unclassified guides</MicroLabel>
          <p className="mt-1.5 text-sm text-slate-300">
            {summary.unclassifiedGuides.length} guide
            {summary.unclassifiedGuides.length === 1 ? " has" : "s have"} no job type set, so{" "}
            {summary.unclassifiedGuides.length === 1 ? "it counts" : "they count"} toward nothing on this page. Set{" "}
            <code className="rounded bg-slate-900 px-1 py-0.5 text-[11px] text-slate-400">jobType</code> in{" "}
            <code className="rounded bg-slate-900 px-1 py-0.5 text-[11px] text-slate-400">src/data/repairs.ts</code>.
          </p>
          <ul className="mt-2 space-y-0.5">
            {summary.unclassifiedGuides.slice(0, 8).map((g) => (
              <li key={g.id} className="text-[13px] text-slate-400">
                {g.title} <span className="text-slate-600">— {g.vehicleId}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Panel
        title="By vehicle"
        subtitle={filtersActive ? `${rows.length} of ${all.length} vehicles match` : `${all.length} vehicles`}
      >
        <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <MicroLabel>Year</MicroLabel>
            <select name="year" defaultValue={filters.year ?? ""} className={SELECT}>
              <option value="">All years</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <MicroLabel>Make</MicroLabel>
            <select name="make" defaultValue={filters.make ?? ""} className={SELECT}>
              <option value="">All makes</option>
              {makes.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <MicroLabel>Model</MicroLabel>
            <select name="model" defaultValue={filters.model ?? ""} className={SELECT}>
              <option value="">All models</option>
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <MicroLabel>Status</MicroLabel>
            <select name="status" defaultValue={filters.status ?? "all"} className={SELECT}>
              <option value="all">Any status</option>
              <option value="not-started">Not started</option>
              <option value="in-progress">In progress</option>
              <option value="complete">Complete</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <MicroLabel>Missing job</MicroLabel>
            <select name="job" defaultValue={filters.job ?? "all"} className={SELECT}>
              <option value="all">Any job</option>
              {JOB_CATALOG.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            className="rounded-lg border border-orange-500/40 bg-orange-500/10 px-3 py-1.5 text-sm font-medium text-orange-300 transition-colors hover:bg-orange-500/20"
          >
            Apply
          </button>
          {filtersActive && (
            <Link
              href="/admin/coverage"
              className="rounded-lg border border-slate-800 px-3 py-1.5 text-sm text-slate-400 transition-colors hover:border-slate-700 hover:text-slate-200"
            >
              Clear
            </Link>
          )}
        </form>

        {rows.length === 0 ? (
          <EmptyState
            title="No vehicles match"
            message="Nothing in the catalog fits that combination of filters. Clear them to see every vehicle."
          />
        ) : (
          <Table minWidth={920}>
            <THead>
              <TR>
                <TH>Vehicle</TH>
                <TH align="right">Target</TH>
                <TH align="right">Built</TH>
                <TH align="right">Remaining</TH>
                <TH>Progress</TH>
                <TH>Status</TH>
                <TH>Still needed</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.vehicle.id} href={`/admin/vehicles/${r.vehicle.id}`}>
                  <TD>
                    <div className="font-medium text-slate-200">{r.label}</div>
                    <div className="text-[11px] text-slate-600">
                      {r.vehicle.trim} · {r.vehicle.drivetrain} · {r.freeGuides} free / {r.premiumGuides} premium
                    </div>
                  </TD>
                  <TD align="right" mono>
                    {r.target}
                  </TD>
                  <TD align="right" mono>
                    {r.done}
                  </TD>
                  <TD align="right" mono>
                    {r.remaining > 0 ? (
                      <span className="text-amber-400">{r.remaining}</span>
                    ) : (
                      <span className="text-emerald-400">0</span>
                    )}
                  </TD>
                  <TD>
                    <div className="w-32">
                      <Meter
                        value={r.pct}
                        tone={r.status === "complete" ? "positive" : r.status === "not-started" ? "critical" : "accent"}
                        caption={`${r.pct}%`}
                      />
                    </div>
                  </TD>
                  <TD>
                    <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                  </TD>
                  <TD>
                    {r.missing.length === 0 ? (
                      <span className="text-[12px] text-slate-600">Nothing outstanding</span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {r.pending.length > 0 && (
                          <span className="text-[11px] text-amber-400">
                            {r.pending.length} of {r.missing.length} need numbers only &mdash;
                            procedure already written
                          </span>
                        )}
                        <div className="flex flex-wrap gap-1">
                        {[...r.missing]
                          .sort(
                            (a, b) =>
                              Number(r.pending.some((p) => p.job.id === b.id)) -
                              Number(r.pending.some((p) => p.job.id === a.id)),
                          )
                          .slice(0, 3)
                          .map((j) => (
                          <span
                            key={j.id}
                            title={
                              r.pending.some((p) => p.job.id === j.id)
                                ? "Procedure already written for this platform. Waiting on verified numbers for this vehicle."
                                : "No guide written for this job yet."
                            }
                            className={
                              r.pending.some((p) => p.job.id === j.id)
                                ? "rounded border border-amber-700/70 bg-amber-950/40 px-1.5 py-0.5 text-[11px] text-amber-300"
                                : "rounded border border-slate-800 bg-slate-900/60 px-1.5 py-0.5 text-[11px] text-slate-400"
                            }
                          >
                            {r.pending.some((p) => p.job.id === j.id) ? "\u25c6 " : ""}
                            {j.label}
                          </span>
                        ))}
                        {r.missing.length > 3 && (
                          <span className="px-1 py-0.5 text-[11px] text-slate-600">
                            +{r.missing.length - 3} more
                          </span>
                        )}
                        </div>
                      </div>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Panel>

      <div className="mt-5">
        <Panel
          title="Biggest gaps"
          subtitle="Which job is missing on the most vehicles — build order, highest leverage first"
        >
          <Table minWidth={620}>
            <THead>
              <TR>
                <TH>Job</TH>
                <TH align="right">Applies to</TH>
                <TH align="right">Missing on</TH>
                <TH>Coverage</TH>
                <TH>Notes</TH>
              </TR>
            </THead>
            <TBody>
              {gaps.map((g) => {
                const built = g.applicable - g.missingOn;
                const pct = g.applicable === 0 ? 0 : Math.round((built / g.applicable) * 100);
                return (
                  <TR key={g.job.id}>
                    <TD>
                      <Link href={`/admin/coverage?job=${g.job.id}`} className="text-slate-200 hover:text-orange-300">
                        {g.job.label}
                      </Link>
                    </TD>
                    <TD align="right" mono>
                      {g.applicable}
                    </TD>
                    <TD align="right" mono>
                      {g.missingOn > 0 ? (
                        <span className="text-amber-400">{g.missingOn}</span>
                      ) : (
                        <span className="text-emerald-400">0</span>
                      )}
                    </TD>
                    <TD>
                      <div className="w-28">
                        <Meter value={pct} tone={pct === 100 ? "positive" : "accent"} caption={`${built}/${g.applicable}`} />
                      </div>
                    </TD>
                    <TD>
                      <span className="text-[11px] text-slate-600">
                        {g.applicable < all.length && g.job.exclusionNote
                          ? g.job.exclusionNote
                          : ""}
                      </span>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </Panel>
      </div>
    </>
  );
}

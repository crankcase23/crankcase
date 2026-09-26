import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/rbac";
import { listGuideRecords, getGuideSummary } from "@/lib/admin/guides";
import { getTopEventObjects } from "@/lib/admin/metrics";
import { listAdminTestGuides } from "@/data/admin-test-guides/charger-2016-sxt-multi-job";
import { parsePeriod, resolvePeriod } from "@/lib/admin/periods";
import { formatNumber } from "@/lib/admin/format";
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
import { Meter, RankedBars } from "@/components/admin/charts";
import PeriodPicker from "@/components/admin/PeriodPicker";

export const metadata = { title: "Service Guides" };

export default async function AdminGuidesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; sort?: string; dir?: string; period?: string }>;
}) {
  const ctx = await requireAdmin("guides.view");
  if (!ctx) redirect("/admin");

  const params = await searchParams;
  const filter = params.filter;
  const sort = params.sort ?? "completeness";
  const dir = params.dir === "asc" ? "asc" : "desc";
  const period = parsePeriod(params.period);
  const range = resolvePeriod(period);

  const summary = getGuideSummary();
  let records = listGuideRecords();

  // Real view counts per guide, from the first-party event stream.
  const topViewed = await getTopEventObjects(range, "guide.viewed", 100);
  const viewsById = new Map(topViewed.map((r) => [r.objectId, r.n]));

  if (filter === "incomplete") records = records.filter((r) => r.requiredMissing > 0);
  if (filter === "free") records = records.filter((r) => r.guide.tier === "free");
  if (filter === "premium") records = records.filter((r) => r.guide.tier === "premium");

  records = [...records].sort((a, b) => {
    const mult = dir === "asc" ? 1 : -1;
    switch (sort) {
      case "title":
        return mult * a.guide.title.localeCompare(b.guide.title);
      case "vehicle":
        return mult * a.vehicleLabel.localeCompare(b.vehicleLabel);
      case "views":
        return mult * ((viewsById.get(a.guide.id) ?? 0) - (viewsById.get(b.guide.id) ?? 0));
      case "steps":
        return mult * (a.stepCount - b.stepCount);
      case "completeness":
      default:
        // Ascending completeness first by default: worst guides at the top,
        // because those are the ones needing work.
        return -mult * (a.completeness - b.completeness);
    }
  });

  function buildHref(overrides: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    const merged = { filter, sort, dir, period: period === "30d" ? undefined : period, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v);
    const qs = sp.toString();
    return `/admin/guides${qs ? `?${qs}` : ""}`;
  }
  function sortHref(column: string) {
    return buildHref({ sort: column, dir: sort === column && dir === "desc" ? "asc" : "desc" });
  }

  const viewList = topViewed
    .map((v) => {
      const rec = records.find((r) => r.guide.id === v.objectId);
      return { label: rec?.guide.title ?? v.objectId, value: v.n, id: v.objectId };
    })
    .slice(0, 8);

  return (
    <div>
      <PageHeader
        title="SERVICE GUIDES"
        description="Every repair guide in the catalog, scored against the publish checklist. Guide content lives in version control — this is the console over it."
        action={<PeriodPicker current={period} basePath="/admin/guides" extraParams={{ filter, sort, dir }} />}
      />

      {/* Unpublished, admin-only guides. Not part of the catalog counts below. */}
      <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-amber-300">Admin test guides</div>
        <ul className="mt-1.5 space-y-1">
          {listAdminTestGuides().map((t) => (
            <li key={t.slug}>
              <Link href={`/admin/guides/test/${t.slug}`} className="text-sm text-slate-200 hover:text-orange-300">
                {t.vehicle.year} {t.vehicle.make} {t.vehicle.model} {t.vehicle.trim} — {t.guide.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* --------------------------------------------------------------- KPIs */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Total Guides" value={summary.total} />
        <KpiCard label="Publish-ready" value={summary.complete} tone="positive" />
        <KpiCard
          label="Incomplete"
          value={summary.incomplete}
          tone={summary.incomplete > 0 ? "critical" : "default"}
          href="/admin/guides?filter=incomplete"
        />
        <KpiCard label="Free" value={summary.free} href="/admin/guides?filter=free" />
        <KpiCard label="Premium" value={summary.premium} href="/admin/guides?filter=premium" />
        <KpiCard
          label="Torque Specs"
          value={summary.totalTorqueSpecs}
          hint={`${summary.realDataSpecs} sourced`}
          tone="accent"
        />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <Panel title="Catalog coverage" eyebrow="Vehicles" accent className="lg:col-span-2">
          <div id="coverage" className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <Meter
                value={summary.vehiclesWithGuides}
                max={summary.vehiclesTotal}
                tone={summary.vehiclesWithGuides === summary.vehiclesTotal ? "positive" : "warning"}
                label="Vehicles with at least one guide"
                caption={`${summary.vehiclesWithGuides} / ${summary.vehiclesTotal}`}
              />
              <Meter
                value={summary.vehiclesTotal - summary.vehiclesWithoutFreeGuide.length}
                max={summary.vehiclesTotal}
                tone={summary.vehiclesWithoutFreeGuide.length === 0 ? "positive" : "critical"}
                label="Vehicles with a free hook guide"
                caption={`${summary.vehiclesTotal - summary.vehiclesWithoutFreeGuide.length} / ${summary.vehiclesTotal}`}
              />
              <Meter
                value={summary.averageCompleteness}
                tone={summary.averageCompleteness >= 80 ? "positive" : "warning"}
                label="Average guide completeness"
                caption={`${summary.averageCompleteness}%`}
              />
            </div>

            <div className="space-y-3">
              {summary.vehiclesWithoutGuides.length > 0 && (
                <div>
                  <MicroLabel>No guides at all</MicroLabel>
                  <ul className="mt-1.5 space-y-1">
                    {summary.vehiclesWithoutGuides.map((v) => (
                      <li key={v.id} className="text-xs text-slate-400">
                        {v.year} {v.make} {v.model}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {summary.vehiclesWithoutFreeGuide.length > 0 && (
                <div>
                  <MicroLabel>Missing the free hook guide</MicroLabel>
                  <ul className="mt-1.5 space-y-1">
                    {summary.vehiclesWithoutFreeGuide.map((v) => (
                      <li key={v.id} className="text-xs text-amber-400">
                        {v.year} {v.make} {v.model}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {summary.vehiclesWithoutGuides.length === 0 && summary.vehiclesWithoutFreeGuide.length === 0 && (
                <p className="text-xs text-emerald-400">
                  Every catalog vehicle has guides, including a free one.
                </p>
              )}
            </div>
          </div>
        </Panel>

        <Panel title="Most viewed" eyebrow={range.label} accent>
          {viewList.length === 0 ? (
            <EmptyState
              title="Waiting for data"
              message="Guide view tracking records every guide page load. Numbers appear here once the app is deployed and used."
            />
          ) : (
            <RankedBars data={viewList} hrefFor={(p) => `/admin/guides/${viewList.find((v) => v.label === p.label)?.id ?? ""}`} />
          )}
        </Panel>
      </div>

      {/* ------------------------------------------------------- guide table */}
      <Panel padded={false} accent>
        <div className="flex flex-wrap items-center gap-1 border-b border-slate-800/80 px-4 py-3">
          {[
            { label: "All", value: undefined },
            { label: "Incomplete", value: "incomplete" },
            { label: "Free", value: "free" },
            { label: "Premium", value: "premium" },
          ].map((f) => (
            <Link
              key={f.label}
              href={buildHref({ filter: f.value })}
              className={`rounded-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
                filter === f.value ? "bg-orange-500 text-slate-950" : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>

        {records.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No guides match" message="Try a different filter." />
          </div>
        ) : (
          <Table minWidth={940}>
            <THead>
              <tr>
                <TH sortHref={sortHref("title")} active={sort === "title"} direction={dir}>
                  Guide
                </TH>
                <TH sortHref={sortHref("vehicle")} active={sort === "vehicle"} direction={dir}>
                  Vehicle
                </TH>
                <TH>Status</TH>
                <TH align="right" sortHref={sortHref("views")} active={sort === "views"} direction={dir}>
                  Views
                </TH>
                <TH align="right">Purchases</TH>
                <TH align="right">Revenue</TH>
                <TH align="right" sortHref={sortHref("steps")} active={sort === "steps"} direction={dir}>
                  Steps
                </TH>
                <TH sortHref={sortHref("completeness")} active={sort === "completeness"} direction={dir}>
                  Completeness
                </TH>
              </tr>
            </THead>
            <TBody>
              {records.map((r) => (
                <TR key={r.guide.id}>
                  <TD>
                    <Link href={`/admin/guides/${r.guide.id}`} className="text-slate-100 hover:text-orange-300">
                      {r.guide.title}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      <Badge tone={r.guide.tier === "free" ? "positive" : "accent"}>{r.guide.tier}</Badge>
                      <Badge tone="muted">{r.guide.difficulty}</Badge>
                    </div>
                  </TD>
                  <TD muted>{r.vehicleLabel}</TD>
                  <TD>
                    {r.status === "incomplete" ? (
                      <Badge tone="critical">{r.requiredMissing} required missing</Badge>
                    ) : r.recommendedMissing > 0 ? (
                      <Badge tone="warning">{r.recommendedMissing} to improve</Badge>
                    ) : (
                      <Badge tone="positive">published</Badge>
                    )}
                  </TD>
                  <TD align="right" mono>
                    {viewsById.has(r.guide.id) ? (
                      formatNumber(viewsById.get(r.guide.id) ?? 0)
                    ) : (
                      <span className="text-slate-700">0</span>
                    )}
                  </TD>
                  <TD align="right" mono muted>
                    <span className="text-slate-700">—</span>
                  </TD>
                  <TD align="right" mono muted>
                    <span className="text-slate-700">—</span>
                  </TD>
                  <TD align="right" mono>
                    {r.stepCount}
                  </TD>
                  <TD>
                    <div className="w-28">
                      <Meter
                        value={r.completeness}
                        tone={r.completeness >= 90 ? "positive" : r.completeness >= 70 ? "warning" : "critical"}
                        caption={`${r.completeness}%`}
                      />
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Panel>

      <p className="mt-3 max-w-3xl text-[11px] leading-relaxed text-slate-600">
        Purchases and revenue per guide read as &quot;—&quot; because no checkout exists yet. The columns are wired to
        the real purchases table and will populate the day payments ship, with no change here. Guide content is edited
        in <span className="font-mono text-slate-500">src/data/repairs.ts</span> and published by committing — this
        console is the checklist to clear before you do.
      </p>
    </div>
  );
}

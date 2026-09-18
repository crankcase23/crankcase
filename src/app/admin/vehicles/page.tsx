import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/rbac";
import { listVehicleEntries, getFleetStats, getDemandReport, VEHICLE_SORTS, type VehicleSort } from "@/lib/admin/vehicles";
import { getCatalogDataIssues } from "@/lib/admin/guides";
import { formatDate, formatNumber, relativeTime } from "@/lib/admin/format";
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
  Pagination,
  KpiCard,
} from "@/components/admin/ui";
import { RankedBars } from "@/components/admin/charts";

export const metadata = { title: "Vehicles" };

const PAGE_SIZE = 25;

function parseSort(value: string | undefined): VehicleSort {
  return (VEHICLE_SORTS as readonly string[]).includes(value ?? "") ? (value as VehicleSort) : "created";
}

export default async function AdminVehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string; sort?: string; dir?: string; page?: string }>;
}) {
  const ctx = await requireAdmin("vehicles.view");
  if (!ctx) redirect("/admin");

  const params = await searchParams;
  const q = params.q?.trim() || undefined;
  const kind = params.kind === "catalog" || params.kind === "custom" ? params.kind : undefined;
  const sort = parseSort(params.sort);
  const dir = params.dir === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const [{ rows, total, pageCount }, stats, demand, catalogIssues] = await Promise.all([
    listVehicleEntries({ q, kind, sort, dir, page, pageSize: PAGE_SIZE }),
    getFleetStats(),
    getDemandReport(10),
    Promise.resolve(getCatalogDataIssues()),
  ]);

  function buildHref(overrides: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    const merged = { q, kind, sort, dir, page: String(page), ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v && !(k === "page" && v === "1") && !(k === "sort" && v === "created" && !overrides.sort)) sp.set(k, v);
    }
    const qs = sp.toString();
    return `/admin/vehicles${qs ? `?${qs}` : ""}`;
  }

  function sortHref(column: VehicleSort) {
    const nextDir = sort === column && dir === "desc" ? "asc" : "desc";
    return buildHref({ sort: column, dir: nextDir, page: undefined });
  }

  const label = (v: (typeof rows)[number]) =>
    [v.year, v.make, v.model].filter(Boolean).join(" ") || v.vehicleId || "Unnamed vehicle";

  return (
    <div>
      <PageHeader
        title="VEHICLES"
        description="Every vehicle in every user's garage. Custom entries are cars we have no curated data for — your content backlog, written by real demand."
        action={
          <a
            href="/api/admin/export/vehicles"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-orange-500/50 hover:text-orange-300"
          >
            Export CSV
          </a>
        }
      />

      {/* --------------------------------------------------------------- KPIs */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Total Vehicles" value={stats.total} />
        <KpiCard label="Catalog (curated)" value={stats.catalog} hint="have specs + guides" tone="positive" />
        <KpiCard
          label="Custom (no data)"
          value={stats.custom}
          hint="demand backlog"
          tone={stats.custom > 0 ? "warning" : "default"}
          href="/admin/vehicles?kind=custom"
        />
        <KpiCard label="With VIN stored" value={stats.withVin} />
      </div>

      {/* --------------------------------------------------------- breakdowns */}
      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <Panel title="Most common makes" eyebrow="Fleet" accent>
          <RankedBars data={stats.topMakes} emptyMessage="No vehicles yet" />
        </Panel>
        <Panel title="Most common models" eyebrow="Fleet" accent>
          <RankedBars data={stats.topModels} emptyMessage="No vehicles yet" />
        </Panel>
        <Panel title="Most common years" eyebrow="Fleet" accent>
          <RankedBars data={stats.topYears} emptyMessage="No vehicles yet" />
        </Panel>
      </div>

      {/* ------------------------------------------------------ demand report */}
      {demand.length > 0 && (
        <div className="mb-5">
          <Panel
            title="Demand backlog"
            eyebrow="Build this next"
            subtitle="Vehicles users added that have no curated specs, guides or torque data — ranked by how many people asked."
            accent
          >
            <RankedBars data={demand} emptyMessage="No custom vehicles yet" />
          </Panel>
        </div>
      )}

      {/* -------------------------------------------- catalog data integrity */}
      {catalogIssues.length > 0 && (
        <div className="mb-5">
          <Panel
            title="Catalog data problems"
            eyebrow={`${catalogIssues.length} vehicle${catalogIssues.length === 1 ? "" : "s"}`}
            subtitle="Curated vehicles in the data files that are missing something users will notice."
            padded={false}
          >
            <ul className="divide-y divide-slate-800/70">
              {catalogIssues.map((v) => (
                <li key={v.vehicleId} className="px-4 py-2.5">
                  <div className="text-sm text-slate-200">{v.label}</div>
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {v.issues.map((issue) => (
                      <li key={issue}>
                        <Badge tone="warning">{issue}</Badge>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}

      {/* --------------------------------------------------------------- list */}
      <Panel padded={false} accent>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-800/80 px-4 py-3">
          <form action="/admin/vehicles" method="get" className="flex min-w-0 flex-1 items-center gap-2">
            {kind && <input type="hidden" name="kind" value={kind} />}
            <input type="hidden" name="sort" value={sort} />
            <input type="hidden" name="dir" value={dir} />
            <input
              type="text"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search VIN, make, model, year or owner..."
              className="min-w-0 flex-1 rounded-md border border-slate-800 bg-slate-950 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-orange-500/50 focus:outline-none sm:max-w-sm"
            />
            <button
              type="submit"
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-orange-500/50 hover:text-orange-300"
            >
              Search
            </button>
            {q && (
              <Link href={buildHref({ q: undefined, page: undefined })} className="text-xs text-slate-500 hover:text-slate-300">
                Clear
              </Link>
            )}
          </form>

          <div className="flex items-center gap-1">
            {[
              { label: "All", value: undefined },
              { label: "Catalog", value: "catalog" as const },
              { label: "Custom", value: "custom" as const },
            ].map((f) => (
              <Link
                key={f.label}
                href={buildHref({ kind: f.value, page: undefined })}
                className={`rounded-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
                  kind === f.value
                    ? "bg-orange-500 text-slate-950"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                }`}
              >
                {f.label}
              </Link>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={q || kind ? "No matches" : "Waiting for data"}
              message={
                q || kind
                  ? "No vehicles match these filters."
                  : "No vehicles have been added to any garage yet."
              }
            />
          </div>
        ) : (
          <>
            <div className="hidden sm:block">
              <Table minWidth={900}>
                <THead>
                  <tr>
                    <TH sortHref={sortHref("year")} active={sort === "year"} direction={dir}>
                      Year
                    </TH>
                    <TH sortHref={sortHref("make")} active={sort === "make"} direction={dir}>
                      Vehicle
                    </TH>
                    <TH>VIN</TH>
                    <TH>Owner</TH>
                    <TH sortHref={sortHref("created")} active={sort === "created"} direction={dir}>
                      Added
                    </TH>
                    <TH align="right" sortHref={sortHref("services")} active={sort === "services"} direction={dir}>
                      Services
                    </TH>
                    <TH>Type</TH>
                  </tr>
                </THead>
                <TBody>
                  {rows.map((v) => (
                    <TR key={v.id}>
                      <TD mono muted>
                        {v.year ?? "—"}
                      </TD>
                      <TD>
                        <Link href={`/admin/vehicles/${v.id}`} className="text-slate-100 hover:text-orange-300">
                          {[v.make, v.model].filter(Boolean).join(" ") || v.vehicleId || "Unnamed"}
                        </Link>
                        {(v.trim || v.engine) && (
                          <div className="text-[11px] text-slate-500">
                            {[v.trim, v.engine].filter(Boolean).join(" · ")}
                          </div>
                        )}
                      </TD>
                      <TD mono muted>
                        {v.vin ? v.vin : <span className="text-slate-700">—</span>}
                      </TD>
                      <TD muted>
                        {v.ownerId ? (
                          <Link href={`/admin/users/${v.ownerId}`} className="hover:text-orange-300">
                            {v.ownerEmail}
                          </Link>
                        ) : (
                          <span className="text-slate-700">—</span>
                        )}
                      </TD>
                      <TD mono muted>
                        {formatDate(v.createdAt)}
                      </TD>
                      <TD align="right" mono>
                        {formatNumber(v.serviceCount)}
                      </TD>
                      <TD>
                        <span className="flex flex-wrap gap-1">
                          <Badge tone={v.kind === "catalog" ? "accent" : "muted"}>{v.kind}</Badge>
                          {v.unlocked && <Badge tone="positive">unlocked</Badge>}
                        </span>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>

            <ul className="divide-y divide-slate-800/70 sm:hidden">
              {rows.map((v) => (
                <li key={v.id}>
                  <Link href={`/admin/vehicles/${v.id}`} className="block px-4 py-3 hover:bg-slate-800/30">
                    <div className="flex items-start justify-between gap-2">
                      <span className="truncate text-sm text-slate-100">{label(v)}</span>
                      <Badge tone={v.kind === "catalog" ? "accent" : "muted"}>{v.kind}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-slate-500">
                      {v.ownerEmail && <span className="truncate">{v.ownerEmail}</span>}
                      <span>{formatNumber(v.serviceCount)} services</span>
                      <span>{relativeTime(v.createdAt)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        <Pagination page={page} pageCount={pageCount} total={total} hrefFor={(p) => buildHref({ page: String(p) })} />
      </Panel>
    </div>
  );
}

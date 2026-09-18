import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/rbac";
import { getVehicleDetail } from "@/lib/admin/vehicles";
import { findVehicle, listRepairsForVehicle } from "@/lib/data";
import { formatDate, formatDateTime, formatNumber, relativeTime } from "@/lib/admin/format";
import {
  Panel,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  Badge,
  EmptyState,
  FieldList,
  MicroLabel,
} from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";

export const metadata = { title: "Vehicle detail" };

export default async function AdminVehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin("vehicles.view");
  if (!ctx) redirect("/admin");

  const { id } = await params;
  const detail = await getVehicleDetail(id);
  if (!detail) notFound();

  const { vehicle, services, dataIssues } = detail;
  const catalog = vehicle.vehicleId ? findVehicle(vehicle.vehicleId) : undefined;
  const guides = catalog ? listRepairsForVehicle(catalog.id) : [];

  const title =
    [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") ||
    (catalog ? `${catalog.year} ${catalog.make} ${catalog.model}` : "Unnamed vehicle");

  return (
    <div>
      <div className="mb-4">
        <Link href="/admin/vehicles" className="text-xs text-slate-500 hover:text-orange-300">
          ← All vehicles
        </Link>
      </div>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-orange-400">
              <Icon name="vehicle" className="h-5 w-5" />
            </span>
            <MicroLabel>{vehicle.kind === "catalog" ? "Curated catalog vehicle" : "Custom user vehicle"}</MicroLabel>
          </div>
          <h1
            className="mt-1 text-2xl font-bold tracking-wide text-slate-50 sm:text-3xl"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "0.03em" }}
          >
            {title}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge tone={vehicle.kind === "catalog" ? "accent" : "muted"}>{vehicle.kind}</Badge>
            {vehicle.unlocked && <Badge tone="positive">unlocked</Badge>}
            {vehicle.ownerId && (
              <Link href={`/admin/users/${vehicle.ownerId}`} className="text-xs text-slate-500 hover:text-orange-300">
                {vehicle.ownerEmail}
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {/* --------------------------------------------------- data problems */}
          {dataIssues.length > 0 && (
            <Panel title="Data problems" eyebrow={`${dataIssues.length} found`} accent>
              <ul className="space-y-1.5">
                {dataIssues.map((issue) => (
                  <li key={issue} className="flex items-start gap-2 text-xs text-slate-400">
                    <span className="mt-0.5 shrink-0 text-amber-400">
                      <Icon name="alert" className="h-3.5 w-3.5" />
                    </span>
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {/* -------------------------------------------------- service history */}
          <Panel
            title="Service history"
            eyebrow={`${services.length} entr${services.length === 1 ? "y" : "ies"}`}
            padded={false}
          >
            {services.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No service history" message="Nothing has been logged against this vehicle." />
              </div>
            ) : (
              <Table minWidth={560}>
                <THead>
                  <tr>
                    <TH>Date</TH>
                    <TH>Service performed</TH>
                    <TH align="right">Mileage</TH>
                    <TH>Logged</TH>
                  </tr>
                </THead>
                <TBody>
                  {services.map((s) => (
                    <TR key={s.id}>
                      <TD mono>{s.date}</TD>
                      <TD>
                        {s.title}
                        {s.notes && <div className="mt-0.5 text-[11px] text-slate-500">{s.notes}</div>}
                      </TD>
                      <TD align="right" mono>
                        {formatNumber(s.mileage)}
                      </TD>
                      <TD mono muted>
                        {relativeTime(s.loggedAt)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Panel>

          {/* ----------------------------------------------- curated data view */}
          {catalog ? (
            <>
              <Panel title="Fluid capacities" eyebrow="Curated data" padded={false}>
                {catalog.fluids.length === 0 ? (
                  <div className="p-4">
                    <EmptyState title="No fluid data" message="This catalog vehicle has no fluid capacities recorded." />
                  </div>
                ) : (
                  <Table minWidth={560}>
                    <THead>
                      <tr>
                        <TH>Fluid</TH>
                        <TH>Capacity</TH>
                        <TH>Spec</TH>
                        <TH>Source</TH>
                      </tr>
                    </THead>
                    <TBody>
                      {catalog.fluids.map((f) => (
                        <TR key={f.name}>
                          <TD>{f.name}</TD>
                          <TD mono>{f.capacity}</TD>
                          <TD muted>{f.spec}</TD>
                          <TD>
                            <Badge tone={f.provenance?.source === "open-labor-project" ? "positive" : "muted"}>
                              {f.provenance?.source === "open-labor-project"
                                ? f.provenance.confidence ?? "sourced"
                                : "hand-typed"}
                            </Badge>
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                )}
              </Panel>

              <Panel title="Guides for this vehicle" eyebrow={`${guides.length}`} padded={false}>
                {guides.length === 0 ? (
                  <div className="p-4">
                    <EmptyState title="No guides" message="This vehicle has specs but nothing to repair yet." />
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-800/70">
                    {guides.map((g) => (
                      <li key={g.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <Link href={`/admin/guides/${g.id}`} className="truncate text-sm text-slate-200 hover:text-orange-300">
                          {g.title}
                        </Link>
                        <span className="flex shrink-0 items-center gap-2">
                          <Badge tone={g.tier === "free" ? "positive" : "accent"}>{g.tier}</Badge>
                          <span className="font-mono text-[10px] text-slate-600">{g.steps.length} steps</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </>
          ) : (
            <Panel title="Curated data" eyebrow="Not available">
              <EmptyState
                title="No catalog match"
                message="This is a custom vehicle — there are no curated specs, fluids, torque values or guides for it. It appears in the demand backlog on the Vehicles page."
              />
            </Panel>
          )}
        </div>

        {/* --------------------------------------------------------- side rail */}
        <div className="space-y-4">
          <Panel title="Record" eyebrow="Garage entry" accent>
            <FieldList
              rows={[
                { label: "Entry ID", value: <span className="font-mono text-[11px] text-slate-400">{vehicle.id}</span> },
                { label: "Type", value: vehicle.kind },
                {
                  label: "Catalog ID",
                  value: vehicle.vehicleId ? (
                    <span className="font-mono text-[11px] text-slate-400">{vehicle.vehicleId}</span>
                  ) : (
                    <span className="text-slate-600">—</span>
                  ),
                },
                { label: "Year", value: vehicle.year ?? catalog?.year ?? "—" },
                { label: "Make", value: vehicle.make ?? catalog?.make ?? "—" },
                { label: "Model", value: vehicle.model ?? catalog?.model ?? "—" },
                { label: "Trim", value: vehicle.trim ?? catalog?.trim ?? "—" },
                { label: "Engine", value: vehicle.engine ?? catalog?.engine ?? "—" },
                {
                  label: "VIN",
                  value: vehicle.vin ? (
                    <span className="font-mono text-[11px] text-slate-300">{vehicle.vin}</span>
                  ) : (
                    <span className="text-slate-600">not stored</span>
                  ),
                },
                {
                  label: "Odometer",
                  value:
                    vehicle.odometer !== null ? (
                      `${formatNumber(vehicle.odometer)} mi`
                    ) : (
                      <span className="text-slate-600">not set</span>
                    ),
                },
                { label: "Added", value: formatDateTime(vehicle.createdAt) },
              ]}
            />
          </Panel>

          <Panel title="Owner" eyebrow="Account">
            {vehicle.ownerId ? (
              <FieldList
                rows={[
                  {
                    label: "Email",
                    value: (
                      <Link href={`/admin/users/${vehicle.ownerId}`} className="hover:text-orange-300">
                        {vehicle.ownerEmail}
                      </Link>
                    ),
                  },
                  { label: "Service entries", value: formatNumber(vehicle.serviceCount) },
                  {
                    label: "Premium access",
                    value: vehicle.unlocked ? (
                      <span className="text-emerald-400">unlocked</span>
                    ) : (
                      <span className="text-slate-500">locked</span>
                    ),
                  },
                  {
                    label: "Last service",
                    value: services[0] ? formatDate(services[0].loggedAt) : <span className="text-slate-600">never</span>,
                  },
                ]}
              />
            ) : (
              <EmptyState title="Orphaned" message="This vehicle has no owner account attached." />
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { findVehicle, listRepairsForVehicle, listVehicles } from "@/lib/data";
import { SpecTable, FluidTable, TierBadge } from "@/components/tables";
import DataDisclaimer from "@/components/DataDisclaimer";
import ServiceHistory from "@/components/ServiceHistory";
import MaintenanceReminders from "@/components/MaintenanceReminders";
import GuideGroups from "@/components/GuideGroups";
import ServiceSchedule from "@/components/ServiceSchedule";
import ViewTracker from "@/components/ViewTracker";
import FeedbackWidget from "@/components/FeedbackWidget";
import { auth } from "@/auth";
import { listGarageEntries } from "@/lib/garageEntries";

export function generateStaticParams() {
  return listVehicles().map((v) => ({ id: v.id }));
}

export async function generateMetadata(
  props: PageProps<"/vehicles/[id]">
): Promise<Metadata> {
  const { id } = await props.params;
  const vehicle = findVehicle(id);
  if (!vehicle) return {};
  const label = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ""}`;
  return {
    title: label,
    description: `Fluid capacities, specs, torque values, and repair guides for the ${label}.`,
  };
}

export default async function VehiclePage(props: PageProps<"/vehicles/[id]">) {
  const { id } = await props.params;
  const vehicle = findVehicle(id);
  if (!vehicle) notFound();

  const repairGuides = listRepairsForVehicle(vehicle.id);

  // Per-user VIN, surfaced in Vehicle Specs below -- added 2026-09-19
  // alongside the cab/trim-mismatch fix so a catalog match's real-world
  // VIN is visible on the page, not just stored. This page is shared
  // across every user who has this catalog vehicle, so the VIN has to
  // come from THIS viewer's own garage entry, not the catalog record.
  const session = await auth();
  let vin: string | undefined;
  if (session?.user?.id) {
      const entries = await listGarageEntries(session.user.id);
      const entry = entries.find((e) => e.kind === "catalog" && e.id === vehicle.id);
      if (entry && entry.kind === "catalog") vin = entry.vin;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {/* Records the view for admin analytics. Renders nothing. */}
      <ViewTracker type="vehicle.viewed" objectId={vehicle.id} objectType="vehicle" />
      <Link href="/garage" className="text-sm text-slate-400 hover:text-slate-200">
        &larr; Back to garage
      </Link>

      <div className="mt-3 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-orange-400">
            {vehicle.year} {vehicle.make}
          </div>
          <h1 className="text-3xl font-bold text-slate-50">
            {vehicle.model} <span className="text-slate-400 font-normal">{vehicle.trim}</span>
          </h1>
          <p className="mt-1 text-slate-400">
            {vehicle.engine} &middot; {vehicle.drivetrain} &middot; {vehicle.transmission}
          </p>
        </div>
        <Link
          href={`/vehicles/${vehicle.id}/spec-sheet/print`}
          target="_blank"
          className="shrink-0 text-sm font-medium text-orange-400 hover:text-orange-300"
        >
          🖨 Print spec sheet &rarr;
        </Link>
      </div>

      <div className="mb-6">
        <DataDisclaimer />
      </div>

      <section className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-100">Vehicle Specs</h2>
          <TierBadge tier="free" />
        </div>
        <div className="max-w-xl">
<SpecTable specs={vin ? [{ label: "VIN", value: vin }, ...vehicle.specs] : vehicle.specs} />        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-100">Fluid Capacities</h2>
          <TierBadge tier="free" />
        </div>
        <FluidTable fluids={vehicle.fluids} />
      </section>

      <ServiceSchedule vehicle={vehicle} guides={repairGuides} />

      <MaintenanceReminders vehicleId={vehicle.id} />

      <GuideGroups vehicleId={vehicle.id} guides={repairGuides} />

      <ServiceHistory
        vehicleId={vehicle.id}
        vehicleLabel={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
        guideTitles={repairGuides.map((g) => g.title)}
      />

      {/* Fluid capacities and specs live on this page -- same reason the
          guides carry one. */}
      <FeedbackWidget vehicleId={vehicle.id} />
    </div>
  );
}

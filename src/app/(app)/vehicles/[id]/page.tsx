import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { findVehicle, listRepairsForVehicle, listVehicles } from "@/lib/data";
import { SpecTable, FluidTable, DifficultyBadge, TierBadge } from "@/components/tables";
import DataDisclaimer from "@/components/DataDisclaimer";
import ServiceHistory from "@/components/ServiceHistory";
import MaintenanceReminders from "@/components/MaintenanceReminders";
import ViewTracker from "@/components/ViewTracker";
import FeedbackWidget from "@/components/FeedbackWidget";

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
          <SpecTable specs={vehicle.specs} />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-100">Fluid Capacities</h2>
          <TierBadge tier="free" />
        </div>
        <FluidTable fluids={vehicle.fluids} />
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold text-slate-100">Repair Guides</h2>
        {repairGuides.length === 0 ? (
          <p className="text-sm text-slate-500">No repair guides for this vehicle yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {repairGuides.map((guide) => (
              <Link
                key={guide.id}
                href={`/vehicles/${vehicle.id}/repairs/${guide.id}`}
                className="group block rounded-xl border border-slate-800 bg-slate-900 p-5 transition hover:border-orange-500 hover:bg-slate-800/80"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-slate-100">{guide.title}</h3>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <TierBadge tier={guide.tier} />
                    <DifficultyBadge difficulty={guide.difficulty} />
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate-400">{guide.summary}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span>⏱ {guide.estTime}</span>
                  <span className="font-medium text-orange-400 group-hover:text-orange-300">
                    Open guide &rarr;
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <MaintenanceReminders vehicleId={vehicle.id} />

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

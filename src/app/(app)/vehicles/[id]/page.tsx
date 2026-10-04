import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { findVehicle, listRepairsForVehicle, listVehicles } from "@/lib/data";
import { SpecTable, FluidTable } from "@/components/tables";
import { CinematicScene } from "@/components/marketing/Cinematic";
import { Stamp, display, FOCUS } from "@/components/app/AppKit";
import { HubSidePanels, HubTiles, OdometerLine, type HubTile } from "@/components/app/VehicleHub";
import { FreeChip, KeysPanel } from "@/components/app/KeysUi";
import { IconChevronLeft, IconPrinter } from "@/components/app/AppIcons";
import DataDisclaimer from "@/components/DataDisclaimer";
import ServiceHistory from "@/components/ServiceHistory";
import MaintenanceReminders from "@/components/MaintenanceReminders";
import GuideGroups from "@/components/GuideGroups";
import ServiceSchedule from "@/components/ServiceSchedule";
import ViewTracker from "@/components/ViewTracker";
import FeedbackWidget from "@/components/FeedbackWidget";
import { maintenanceItemsFor } from "@/lib/reminders";
import { getServiceSchedule } from "@/data/service-schedules";
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

  const items = maintenanceItemsFor(vehicle);

  const tiles: HubTile[] = [
    { key: "maintain", title: "Maintain it", body: "Schedule, reminders, fluids and capacities.", href: "#maintenance", gate: "keys" },
    { key: "fix", title: "Fix something", body: "Step-by-step guides with tools, parts and torque specifications.", href: "#guides", gate: "keys" },
    { key: "history", title: "Service history", body: "Your log of jobs, mileage and notes. User-recorded Crankcase Service History.", href: "#history", gate: "keys" },
    { key: "info", title: "Vehicle info", body: "Specs, fluids and capacities.", href: "#info", gate: "free" },
  ];

  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-white/[0.06]">
        <CinematicScene variant="band" />
        <div className="mx-auto max-w-6xl px-4 pb-12 pt-8 sm:pb-16">
      {/* Records the view for admin analytics. Renders nothing. */}
      <ViewTracker type="vehicle.viewed" objectId={vehicle.id} objectType="vehicle" />

      <Link href="/garage" className={`inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 ${FOCUS}`}>
        <IconChevronLeft className="h-4 w-4" />
        Back to garage
      </Link>

      <div className="mt-4 flex flex-col items-start gap-y-5">
        <div className="min-w-0">
          <Stamp className="text-orange-400">
            {vehicle.year} · {vehicle.make}
          </Stamp>
          <h1 className="mt-2 text-5xl font-extrabold uppercase leading-[0.95] tracking-tight text-slate-50 sm:text-6xl" style={display}>
            {vehicle.model}
            {vehicle.trim ? <span className="text-slate-400"> {vehicle.trim}</span> : null}
          </h1>
          <p className="mt-3 text-slate-300">
            {vehicle.engine} &middot; {vehicle.drivetrain} &middot; {vehicle.transmission}
          </p>
          <div className="mt-2">
            <OdometerLine vehicleId={vehicle.id} href="#odo" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <FreeChip />
          <Link
            href={`/vehicles/${vehicle.id}/spec-sheet/print`}
            target="_blank"
            className={`inline-flex items-center gap-1.5 text-sm font-medium text-slate-200 hover:text-white ${FOCUS}`}
          >
            <IconPrinter className="h-4 w-4" />
            Print spec sheet <span aria-hidden>&rarr;</span>
          </Link>
        </div>
      </div>

        </div>
      </section>

    <div className="mx-auto max-w-6xl px-4 pb-12 pt-9 sm:pb-14">
      <div className="grid items-start gap-x-8 gap-y-8 lg:grid-cols-[minmax(0,1fr)_22.5rem]">
        <HubTiles tiles={tiles} />
        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <HubSidePanels vehicleId={vehicle.id} items={items} maintainHref="#maintenance" historyHref="#history" />
        </div>
        <div className="lg:col-start-1 lg:row-start-2">
          <KeysPanel vehicleName={`${vehicle.model}`} />
        </div>
      </div>

      <div className="mt-10">
        <DataDisclaimer />
      </div>

      <section id="info" className="mt-12 scroll-mt-24">
        <div className="mb-4 flex items-center gap-3">
          <h2 className="cg-section-title">Vehicle Specs</h2>
          <FreeChip />
        </div>
        <div className="max-w-xl">
          <SpecTable specs={vin ? [{ label: "VIN", value: vin }, ...vehicle.specs] : vehicle.specs} />
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-center gap-3">
          <h2 className="cg-section-title">Fluid Capacities</h2>
          <FreeChip />
        </div>
        <FluidTable fluids={vehicle.fluids} />
      </section>

      <div id="maintenance" className="scroll-mt-24">
        <ServiceSchedule vehicle={vehicle} guides={repairGuides} />

        {/* Reminders run on this vehicle's factory intervals wherever we hold
            its schedule -- otherwise the panel would contradict the Factory
            Service Schedule directly above it. */}
        <MaintenanceReminders
          vehicleId={vehicle.id}
          items={items}
          hasFactorySchedule={getServiceSchedule(vehicle) !== null}
        />
      </div>

      <div id="guides" className="scroll-mt-24">
        <GuideGroups vehicleId={vehicle.id} guides={repairGuides} />
      </div>

      <div id="history" className="scroll-mt-24">
        <ServiceHistory
          vehicleId={vehicle.id}
          vehicleLabel={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
          guideTitles={repairGuides.map((g) => g.title)}
        />
      </div>

      {/* Fluid capacities and specs live on this page -- same reason the
          guides carry one. */}
      <FeedbackWidget vehicleId={vehicle.id} />
    </div>
    </>
  );
}

import Section from "@/components/app/Section";
import StickyVehicleBar from "@/components/app/StickyVehicleBar";
import ManufacturerService from "@/components/ManufacturerService";
import { buildNextServiceData } from "@/lib/nextService";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { findVehicle, listRepairsForVehicle, listVehicles } from "@/lib/data";
import { SpecTable, FluidTable } from "@/components/tables";
import VehicleBackdrop from "@/components/app/VehicleBackdrop";
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

  const label = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ""}`;
  const schedule = getServiceSchedule(vehicle);
  const specRows = vin ? [{ label: "VIN", value: vin }, ...vehicle.specs] : vehicle.specs;
  const JUMPS = [
    { href: "#info", label: "Specs" },
    { href: "#fluids", label: "Fluids" },
    { href: "#maintenance", label: "Service" },
    { href: "#guides", label: "Guides" },
    { href: "#history", label: "History" },
  ];

  return (
    <div className="vh-page relative isolate overflow-x-clip">
      {/* Page-long environment: almost subliminal. Existing workshop photo only,
          blurred and masked into the dark; a couple of amber light blooms;
          shadow at the foot. Decorative, behind everything. */}
      <div aria-hidden className="vh-atmos absolute inset-0 z-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/garage/workshop-bench.jpg"
          alt=""
          loading="lazy"
          className="left-[-18%] top-[34%] h-[46rem] w-[78%] max-w-none object-cover opacity-[0.10] blur-[3px] [mask-image:radial-gradient(closest-side,black_20%,transparent_100%)]"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/garage/workshop-bench.jpg"
          alt=""
          loading="lazy"
          className="right-[-22%] top-[66%] h-[44rem] w-[80%] max-w-none -scale-x-100 object-cover opacity-[0.085] blur-[3px] [mask-image:radial-gradient(closest-side,black_20%,transparent_100%)]"
        />
        <div className="right-[-10%] top-[24%] h-[34rem] w-[46rem] bg-[radial-gradient(closest-side,rgba(234,138,40,0.13),transparent)]" />
        <div className="left-[-14%] top-[52%] h-[36rem] w-[44rem] bg-[radial-gradient(closest-side,rgba(200,110,40,0.12),transparent)]" />
        <div className="right-[-8%] top-[80%] h-[30rem] w-[40rem] bg-[radial-gradient(closest-side,rgba(234,138,40,0.10),transparent)]" />
        <div className="inset-x-0 bottom-0 h-[22rem] bg-gradient-to-b from-transparent to-black/60" />
      </div>
      <section className="relative isolate overflow-hidden lg:min-h-[20rem]">
        <VehicleBackdrop vehicleId={vehicle.id} />
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
        {/* seam: the photo header melts into the warm-black page */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-[#0b0908]" />
      </section>

      <StickyVehicleBar vehicleId={vehicle.id} label={label} />

    <div className="relative z-[1] mx-auto max-w-6xl px-4 pb-12 pt-5 sm:pb-14">
      <nav aria-label="Jump to section" className="-mx-4 mb-7 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {JUMPS.map((j) => (
          <a
            key={j.href}
            href={j.href}
            className={`inline-flex min-h-9 shrink-0 items-center rounded-full border border-white/12 bg-black/35 px-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300 backdrop-blur hover:border-white/35 hover:text-white ${FOCUS}`}
          >
            {j.label}
          </a>
        ))}
      </nav>

      <div className="grid items-start gap-x-8 gap-y-8 lg:grid-cols-[minmax(0,1fr)_22.5rem]">
        <HubTiles tiles={tiles} />
        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <HubSidePanels vehicleId={vehicle.id} items={items} maintainHref="#maintenance" historyHref="#history" />
        </div>
        <div className="lg:col-start-1 lg:row-start-2">
          <KeysPanel vehicleName={`${vehicle.model}`} backdrop={<VehicleBackdrop vehicleId={vehicle.id} />} />
        </div>
      </div>

      <Section
        id="info"
        vehicleId={vehicle.id}
        eyebrow="The numbers"
        title="Vehicle Specs"
        summary={`${specRows.length} specs available`}
        defaultOpen
        glow="left"
        chip={<FreeChip />}
      >
        <div className="grid gap-x-12 gap-y-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
          <div className="lg:pt-1">
            <DataDisclaimer compact />
          </div>
          <SpecTable specs={specRows} />
        </div>
      </Section>

      <Section
        id="fluids"
        vehicleId={vehicle.id}
        eyebrow="Before you pour"
        title="Fluid Capacities"
        summary={`${vehicle.fluids.length} ${vehicle.fluids.length === 1 ? "capacity" : "capacities"}`}
        glow="right"
        chip={<FreeChip />}
      >
        <FluidTable fluids={vehicle.fluids} />
      </Section>

      <div id="maintenance" className="scroll-mt-32">
        {schedule ? (
          <ManufacturerService
            vehicleId={vehicle.id}
            data={buildNextServiceData(schedule)}
            sourceLabel={schedule.sourceLabel}
            fullSchedule={<ServiceSchedule vehicle={vehicle} guides={repairGuides} />}
          />
        ) : null}

        {/* Reminders run on this vehicle's factory intervals wherever we hold
            its schedule -- otherwise the panel would contradict the Factory
            Service Schedule. */}
        <MaintenanceReminders
          vehicleId={vehicle.id}
          items={items}
          hasFactorySchedule={schedule !== null}
        />
      </div>

      <GuideGroups vehicleId={vehicle.id} guides={repairGuides} />

      <ServiceHistory
        vehicleId={vehicle.id}
        vehicleLabel={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
        guideTitles={repairGuides.map((g) => g.title)}
      />

      <FeedbackWidget vehicleId={vehicle.id} />
    </div>
    </div>
  );
}

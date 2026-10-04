"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useGarage } from "@/lib/garage";
import ServiceHistory from "@/components/ServiceHistory";
import ViewTracker from "@/components/ViewTracker";
import MaintenanceReminders from "@/components/MaintenanceReminders";
import DataDisclaimer from "@/components/DataDisclaimer";
import { FluidTable } from "@/components/tables";
import { FluidCapacity } from "@/types/vehicle";
import { BTN_SECONDARY, FOCUS, Eyebrow, Stamp, display } from "@/components/app/AppKit";
import { CinematicScene } from "@/components/marketing/Cinematic";
import { HubSidePanels, HubTiles, OdometerLine, type HubTile } from "@/components/app/VehicleHub";
import { FreeChip, KeysPanel } from "@/components/app/KeysUi";
import { IconChevronLeft } from "@/components/app/AppIcons";

// Auto-populate: as soon as this page mounts, ask the server whether we
// have real data for this exact make/model/year (curated catalog match,
// a cached Open Labor Project pull, or worth a fresh live pull). See
// src/lib/vehicleDataCache.ts for the three-tier lookup and the
// graceful-fallback policy when the shared daily API quota is tapped out.
type LookupState =
    | { status: "loading" }
  | { status: "catalog"; vehicleId: string }
  | { status: "ok"; fluids: FluidCapacity[]; source: string; confidence?: string }
  | { status: "pending" }
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "error" };

export default function CustomVehiclePage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const { findCustom, removeEntry, isLoading } = useGarage();
    const entry = findCustom(params.id);
    const custom = entry?.kind === "custom" ? entry.custom : undefined;
    const [lookup, setLookup] = useState<LookupState>({ status: "loading" });

  useEffect(() => {
        if (!custom || (!custom.make && !custom.model)) return;
        let cancelled = false;
        // No setLookup({status:"loading"}) here on purpose. The initial state
        // is already "loading", so this was redundant on mount -- and calling
        // setState synchronously inside an effect is the cascading-render
        // pattern React warns about (it was the one lint error left in this
        // file). The fetch below sets the real state when it resolves.
        fetch("/api/vehicle-data/lookup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                          make: custom.make,
                          model: custom.model,
                          year: custom.year,
                          engine: custom.engine,
                }),
        })
          .then((res) => (res.ok ? res.json() : Promise.reject()))
          .then((data: LookupState) => {
                    if (!cancelled) setLookup(data);
          })
          .catch(() => {
                    if (!cancelled) setLookup({ status: "error" });
          });
        return () => {
                cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [custom?.make, custom?.model, custom?.year, custom?.engine]);

  if (isLoading) return null;

  if (!entry || entry.kind !== "custom" || !custom) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <section className="cg-panel rounded-2xl p-8 text-center sm:p-10">
          <Eyebrow>Not in this garage</Eyebrow>
          <h1 className="mt-3 text-4xl font-extrabold uppercase leading-[0.95] text-slate-50" style={display}>
            Vehicle not found
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-400">
            This vehicle isn&apos;t in your garage on this browser — it may have been removed, or this link was opened
            somewhere else. Garage data lives only in the browser that added it, for now.
          </p>
          <Link href="/garage" className={`mt-6 ${BTN_SECONDARY}`}>
            &larr; Back to garage
          </Link>
        </section>
      </div>
    );
  }

  const label = [custom.year, custom.make, custom.model].filter(Boolean).join(" ") || "Your vehicle";

  async function handleRemove() {
    await removeEntry(entry!.id);
    router.push("/garage");
  }

  const tiles: HubTile[] = [
    { key: "maintain", title: "Maintain it", body: "Reminders based on what you've logged.", href: "#maintenance", gate: "keys" },
    { key: "history", title: "Service history", body: "Your log of jobs, mileage and notes. User-recorded Crankcase Service History.", href: "#history", gate: "keys" },
    { key: "info", title: "Vehicle info", body: "What we know about this vehicle so far.", href: "#info", gate: "free" },
  ];

  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-white/[0.06]">
        <CinematicScene variant="band" />
        <div className="mx-auto max-w-6xl px-4 pb-12 pt-8 sm:pb-16">
      {/* Custom vehicles are exactly the ones in the admin demand
          backlog, so their views are the most useful signal we have
          about what to build next. Renders nothing. */}
      <ViewTracker type="vehicle.viewed" objectId={entry.id} objectType="garage_entry" />

      <Link href="/garage" className={`inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 ${FOCUS}`}>
        <IconChevronLeft className="h-4 w-4" />
        Back to garage
      </Link>

      <div className="mt-4 flex flex-col items-start gap-y-5">
        <div className="min-w-0">
          <Stamp className="text-orange-400">
            {custom.year ?? "Year unknown"}
            {custom.make ? ` · ${custom.make}` : ""}
          </Stamp>
          <h1 className="mt-2 text-5xl font-extrabold uppercase leading-[0.95] tracking-tight text-slate-50 sm:text-6xl" style={display}>
            {custom.model ?? "Unnamed vehicle"}
            {custom.trim ? <span className="text-slate-400"> {custom.trim}</span> : null}
          </h1>
          {(custom.engine || custom.vin) && (
            <p className="mt-3 text-slate-300 [overflow-wrap:anywhere]">
              {[custom.engine, custom.vin && `VIN ${custom.vin}`].filter(Boolean).join(" · ")}
            </p>
          )}
          <div className="mt-2">
            <OdometerLine vehicleId={entry.id} href="#odo" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <FreeChip />
          <button
            type="button"
            onClick={handleRemove}
            className={`shrink-0 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-400 hover:border-rose-500/50 hover:text-rose-400 ${FOCUS}`}
          >
            Remove from garage
          </button>
        </div>
      </div>

        </div>
      </section>

    <div className="mx-auto max-w-6xl px-4 pb-12 pt-9 sm:pb-14">
      <div className="grid items-start gap-x-8 gap-y-8 lg:grid-cols-[minmax(0,1fr)_22.5rem]">
        <HubTiles tiles={tiles} />
        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <HubSidePanels vehicleId={entry.id} maintainHref="#maintenance" historyHref="#history" />
        </div>
        <div className="lg:col-start-1 lg:row-start-2">
          <KeysPanel vehicleName={custom.model ?? "vehicle"} />
        </div>
      </div>

      <div id="info" className="mt-12 scroll-mt-24">
        {lookup.status === "catalog" && (
          <div className="cg-well rounded-xl border-l-2 border-l-emerald-500/70 px-4 py-3 text-sm text-emerald-300">
            <span className="font-semibold">Good news — we have full curated data for this exact vehicle.</span>{" "}
            <Link href={`/vehicles/${lookup.vehicleId}`} className="font-medium underline hover:text-emerald-200">
              View its specs, fluids, and guides
            </Link>
            .
          </div>
        )}

        {lookup.status === "ok" && (
          <div className="space-y-4">
            <DataDisclaimer compact />
            <div>
              <div className="mb-4 flex items-center gap-3">
                <h2 className="cg-section-title">Fluid Capacities</h2>
                <FreeChip />
              </div>
              <FluidTable fluids={lookup.fluids} />
              <p className="mt-2 text-xs text-slate-500">
                Sourced from Open Labor Project{lookup.confidence ? ` · confidence: ${lookup.confidence}` : ""}. Torque
                specs for this vehicle aren&apos;t available yet — check back as our data coverage grows.
              </p>
            </div>
          </div>
        )}

        {lookup.status === "loading" && (
          <div className="cg-well rounded-xl px-4 py-3 text-sm text-slate-400" aria-busy="true">
            Checking what we have on this vehicle&hellip;
          </div>
        )}

        {(lookup.status === "pending" ||
          lookup.status === "not_found" ||
          lookup.status === "unavailable" ||
          lookup.status === "error") && (
          <div className="cg-well rounded-xl border-l-2 border-l-amber-500/70 px-4 py-3 text-sm leading-relaxed text-slate-300">
            <span className="font-semibold text-amber-300">We&apos;re working on getting full data for this car.</span>{" "}
            We don&apos;t have specs, fluid capacities, or torque values pulled in for this one yet — go by your
            owner&apos;s manual or factory service manual for now. You can still log service history and get generic
            maintenance-interval reminders below.
          </div>
        )}
      </div>

      <div id="maintenance" className="scroll-mt-24">
        <MaintenanceReminders vehicleId={entry.id} />
      </div>

      <div id="history" className="scroll-mt-24">
        <ServiceHistory
          vehicleId={entry.id}
          vehicleLabel={label}
          guideTitles={[]}
          printHref={`/garage/custom/${entry.id}/service-history/print`}
        />
      </div>
    </div>
    </>
  );
}

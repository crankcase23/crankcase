"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useGarage } from "@/lib/garage";
import ServiceHistory from "@/components/ServiceHistory";
import MaintenanceReminders from "@/components/MaintenanceReminders";
import DataDisclaimer from "@/components/DataDisclaimer";
import { FluidTable } from "@/components/tables";
import { FluidCapacity } from "@/types/vehicle";

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
        setLookup({ status: "loading" });
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
                <div className="mx-auto max-w-2xl px-4 py-16 text-center">
                        <h1 className="text-xl font-bold text-slate-50">Vehicle not found</h1>
                        <p className="mt-2 text-sm text-slate-400">
                                  This vehicle isn&apos;t in your garage on this browser — it may have
                                  been removed, or this link was opened somewhere else. Garage data
                                  lives only in the browser that added it, for now.
                        </p>
                        <Link href="/garage" className="mt-4 inline-block text-sm font-medium text-orange-400 hover:text-orange-300">
                                  &larr; Back to garage
                        </Link>
                </div>
              );
  }
  
    const label = [custom.year, custom.make, custom.model].filter(Boolean).join(" ") || "Your vehicle";
  
    async function handleRemove() {
          await removeEntry(entry!.id);
          router.push("/garage");
    }
  
    return (
          <div className="mx-auto max-w-5xl px-4 py-10">
                <Link href="/garage" className="text-sm text-slate-400 hover:text-slate-200">
                        &larr; Back to garage
                </Link>
          
                <div className="mt-3 mb-6 flex flex-wrap items-start justify-between gap-4">
                        <div>
                                  <div className="text-sm font-semibold uppercase tracking-wide text-orange-400">
                                    {custom.year ?? "Year unknown"} {custom.make ?? ""}
                                  </div>
                                  <h1 className="text-3xl font-bold text-slate-50">
                                    {custom.model ?? "Unnamed vehicle"}{" "}
                                              <span className="text-slate-400 font-normal">{custom.trim}</span>
                                  </h1>
                          {(custom.engine || custom.vin) && (
                        <p className="mt-1 text-slate-400">
                          {[custom.engine, custom.vin && `VIN ${custom.vin}`].filter(Boolean).join(" · ")}
                        </p>
                                  )}
                        </div>
                        <button
                                    type="button"
                                    onClick={handleRemove}
                                    className="shrink-0 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-400 hover:border-rose-500/50 hover:text-rose-400"
                                  >
                                  Remove from garage
                        </button>
                </div>
          
            {lookup.status === "catalog" && (
                    <div className="mb-8 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                              <span className="font-semibold">Good news — we have full curated data for this exact vehicle.</span>{" "}
                              <Link href={`/vehicles/${lookup.vehicleId}`} className="font-medium underline hover:text-emerald-200">
                                          View its specs, fluids, and guides
                              </Link>
                              .
                    </div>
                )}
          
            {lookup.status === "ok" && (
                    <div className="mb-8 space-y-4">
                              <DataDisclaimer compact />
                              <div>
                                          <h2 className="mb-2 text-lg font-semibold text-slate-100">Fluid Capacities</h2>
                                          <FluidTable fluids={lookup.fluids} />
                                          <p className="mt-2 text-xs text-slate-500">
                                                        Sourced from Open Labor Project{lookup.confidence ? ` · confidence: ${lookup.confidence}` : ""}. Torque
                                                        specs for this vehicle aren&apos;t available yet — check back as our data coverage grows.
                                          </p>
                              </div>
                    </div>
                )}
          
            {(lookup.status === "pending" ||
                      lookup.status === "not_found" ||
                      lookup.status === "unavailable" ||
                      lookup.status === "error") && (
                    <div className="mb-8 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                              <span className="font-semibold">We&apos;re working on getting full data for this car.</span>{" "}
                              We don&apos;t have specs, fluid capacities, or torque values pulled in for this one yet — go by your
                              owner&apos;s manual or factory service manual for now. You can still log service history and get generic
                              maintenance-interval reminders below.
                    </div>
                )}
          
                <MaintenanceReminders vehicleId={entry.id} />
          
                <ServiceHistory
                          vehicleId={entry.id}
                          vehicleLabel={label}
                          guideTitles={[]}
                          printHref={`/garage/custom/${entry.id}/service-history/print`}
                        />
          </div>
        );
}

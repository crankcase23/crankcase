"use client";

import Link from "next/link";
import { findVehicle } from "@/lib/data";
import { useGarage } from "@/lib/garage";
import VehicleCard from "@/components/VehicleCard";

export default function GaragePage() {
  const { entries, removeEntry } = useGarage();

  const catalogEntries = entries.filter((e) => e.kind === "catalog");
  const customEntries = entries.filter((e) => e.kind === "custom");

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <section className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-50">Your Garage</h1>
          <p className="mt-2 max-w-2xl text-slate-400">
            Pick a vehicle to see its fluid capacities, specs, and step-by-step
            repair guides with tools and torque values.
          </p>
        </div>
        <Link
          href="/garage/add"
          className="shrink-0 rounded-lg bg-orange-500 px-4 py-2.5 font-semibold text-slate-950 hover:bg-orange-400"
        >
          + Add a vehicle
        </Link>
      </section>

      {entries.length === 0 ? (
        <section className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center">
          <h2 className="font-semibold text-slate-100">Your garage is empty</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-400">
            Add a vehicle to start seeing its specs, fluid capacities, and repair
            guides — or to just track service history.
          </p>
          <Link
            href="/garage/add"
            className="mt-4 inline-flex items-center gap-1 rounded-lg bg-orange-500 px-4 py-2 font-semibold text-slate-950 hover:bg-orange-400"
          >
            + Add your first vehicle
          </Link>
        </section>
      ) : (
        <>
          {catalogEntries.length > 0 && (
            <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {catalogEntries.map((e) => {
                const vehicle = findVehicle(e.id);
                if (!vehicle) return null;
                return (
                  <div key={e.id} className="relative">
                    <VehicleCard vehicle={vehicle} />
                    <button
                      type="button"
                      onClick={() => removeEntry(e.id)}
                      aria-label={`Remove ${vehicle.year} ${vehicle.make} ${vehicle.model} from garage`}
                      title="Remove from garage"
                      className="absolute right-3 top-3 rounded-full bg-slate-950/80 px-2 py-1 text-xs text-slate-400 hover:text-rose-400"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </section>
          )}

          {customEntries.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Added, no guide data yet
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {customEntries.map((e) => (
                  <div key={e.id} className="relative">
                    <Link
                      href={`/garage/custom/${e.id}`}
                      className="group block rounded-xl border border-slate-800 bg-slate-900 p-5 transition hover:border-orange-500 hover:bg-slate-800/80"
                    >
                      <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
                        {e.kind === "custom" ? e.custom.year ?? "Year unknown" : ""}
                      </div>
                      <div className="mt-1 text-xl font-bold text-slate-100">
                        {e.kind === "custom"
                          ? [e.custom.make, e.custom.model].filter(Boolean).join(" ") || "Unnamed vehicle"
                          : ""}
                      </div>
                      <div className="text-sm text-slate-400">
                        {e.kind === "custom" ? e.custom.trim : ""}
                      </div>
                      <div className="mt-3 inline-block rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400">
                        No curated specs yet
                      </div>
                      <div className="mt-4 text-sm font-medium text-orange-400 group-hover:text-orange-300">
                        Open &rarr;
                      </div>
                    </Link>
                    <button
                      type="button"
                      onClick={() => removeEntry(e.id)}
                      aria-label="Remove vehicle from garage"
                      title="Remove from garage"
                      className="absolute right-3 top-3 rounded-full bg-slate-950/80 px-2 py-1 text-xs text-slate-400 hover:text-rose-400"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="font-semibold text-slate-100">Don&apos;t see your vehicle?</h2>
        <p className="mt-1 text-sm text-slate-400">
          This is an early build — full guides only exist for a handful of
          vehicles so far. You can still add any vehicle to log its service
          history, and decode a VIN for basic year/make/model info.
        </p>
        <div className="mt-3 flex flex-wrap gap-4">
          <Link
            href="/garage/add"
            className="inline-flex items-center gap-1 text-sm font-medium text-orange-400 hover:text-orange-300"
          >
            Add a vehicle &rarr;
          </Link>
          <Link
            href="/decode"
            className="inline-flex items-center gap-1 text-sm font-medium text-orange-400 hover:text-orange-300"
          >
            Try the VIN lookup &rarr;
          </Link>
        </div>
      </section>
    </div>
  );
}

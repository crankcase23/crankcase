"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useGarage } from "@/lib/garage";
import ServiceHistory from "@/components/ServiceHistory";
import MaintenanceReminders from "@/components/MaintenanceReminders";

export default function CustomVehiclePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { findCustom, removeEntry, isLoading } = useGarage();
  const entry = findCustom(params.id);

  if (isLoading) return null;

  if (!entry || entry.kind !== "custom") {
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

  const { custom } = entry;
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

      <div className="mb-8 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <span className="font-semibold">No curated data for this vehicle yet.</span>{" "}
        We don&apos;t have specs, fluid capacities, or torque values in our
        library for this one — go by your owner&apos;s manual or factory
        service manual. You can still log service history and get generic
        maintenance-interval reminders below.
      </div>

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

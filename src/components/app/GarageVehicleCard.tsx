"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { Vehicle } from "@/types/vehicle";
import type { CustomVehicleInfo } from "@/types/garage";
import { listRepairsForVehicle } from "@/lib/data";
import { useOdometer } from "@/lib/odometer";
import { useServiceHistory } from "@/lib/serviceHistory";
import { computeReminders, maintenanceItemsFor } from "@/lib/reminders";
import { summarizeGarageStatus } from "@/lib/garageStatus";
import { VehiclePlate } from "@/components/marketing/Cinematic";
import { FOCUS, StatusChip, Stamp, display } from "@/components/app/AppKit";

// One vehicle on My Garage. A graphite panel in the approved homepage system:
// stamped year/make, display-face model, the engine and odometer line, one
// recessed status line, one quiet action. The whole card is the link (a stretched
// anchor on the action), and the remove control sits above it as its own button
// so there is never an interactive element nested inside another.
//
// Every figure on it is something the app already knows: the vehicle's own
// catalog entry, the odometer reading, and the reminders computeReminders()
// already produces from the service log. Nothing here is invented, and a
// vehicle with nothing logged says so instead of showing a reassuring blank.

type Props =
  | { id: string; kind: "catalog"; vehicle: Vehicle; onRemove: () => void }
  | { id: string; kind: "custom"; custom: CustomVehicleInfo; onRemove: () => void };

export default function GarageVehicleCard(props: Props) {
  const { id, kind, onRemove } = props;
  const vehicle = kind === "catalog" ? props.vehicle : undefined;
  const custom = kind === "custom" ? props.custom : undefined;

  const { odometer } = useOdometer(id);
  const { entries } = useServiceHistory(id);

  const guideCount = useMemo(() => (vehicle ? listRepairsForVehicle(vehicle.id).length : 0), [vehicle]);

  const status = useMemo(() => {
    const items = maintenanceItemsFor(vehicle ?? null);
    return summarizeGarageStatus(computeReminders(entries, odometer, items));
  }, [entries, odometer, vehicle]);

  const year = vehicle ? String(vehicle.year) : custom?.year ?? "Year unknown";
  const make = vehicle ? vehicle.make : custom?.make ?? "";
  const model = vehicle
    ? vehicle.model
    : [custom?.model].filter(Boolean).join(" ") || (make ? "" : "Unnamed vehicle");
  const trim = vehicle ? vehicle.trim : custom?.trim;
  const engine = vehicle ? vehicle.engine : custom?.engine;
  const href = vehicle ? `/vehicles/${vehicle.id}` : `/garage/custom/${id}`;
  const label = [year, make, model].filter(Boolean).join(" ");

  // The line under the title. Neutral fallbacks say what is actually true.
  let statusLine: { tone: "overdue" | "due-soon" | "ok" | "neutral"; text: string };
  if (status) statusLine = status;
  else if (vehicle)
    statusLine = {
      tone: "neutral",
      text:
        guideCount > 0
          ? `Specs, fluids and ${guideCount} ${guideCount === 1 ? "guide" : "guides"} ready`
          : "Specs and fluids ready",
    };
  else statusLine = { tone: "neutral", text: "Service history and reminders only" };

  const tone = {
    overdue: { dot: "bg-orange-500" },
    "due-soon": { dot: "bg-orange-500" },
    ok: { dot: "bg-emerald-500" },
    neutral: { dot: "bg-slate-500" },
  }[statusLine.tone];

  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.95)] transition-colors hover:border-white/25 focus-within:border-white/25">
      <VehiclePlate className="h-32">
        <span className="absolute left-4 top-3">
          {vehicle ? <StatusChip tone="ready">Specs ready</StatusChip> : <StatusChip>No curated specs yet</StatusChip>}
        </span>
      </VehiclePlate>

      <div className="flex-1 px-5 pb-4 pt-4">
        <Stamp>
          {year}
          {make ? ` · ${make}` : ""}
        </Stamp>
        <h3 className="mt-2 text-[1.9rem] font-extrabold uppercase leading-[0.95] text-slate-50" style={display}>
          {model}
          {trim ? <span className="text-slate-400"> {trim}</span> : null}
        </h3>
        <p className="mt-2.5 text-sm text-slate-300">
          {engine ? <>{engine}</> : <span className="text-slate-500">Engine not set</span>}
        </p>
        <p className="mt-1 font-mono text-xs text-slate-400">
          {odometer != null ? `${odometer.toLocaleString("en-US")} mi` : "Mileage not set"}
        </p>

        <p className="mt-4 flex items-start gap-2.5 border-t border-white/[0.07] pt-3 text-sm leading-snug text-slate-100">
          <span className={`mt-[0.4rem] h-2 w-2 shrink-0 rounded-full ${tone.dot}`} aria-hidden />
          {statusLine.text}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 px-5 pb-4">
        <Link
          href={href}
          className={`text-sm font-semibold text-slate-50 hover:text-white after:absolute after:inset-0 after:content-[''] ${FOCUS}`}
        >
          {vehicle ? "Open vehicle" : "Open"} <span aria-hidden className="text-orange-400">&rarr;</span>
        </Link>
        <button
          type="button"
          onClick={onRemove}
          aria-label={vehicle ? `Remove ${label} from garage` : "Remove vehicle from garage"}
          title="Remove from garage"
          className={`relative z-10 rounded-md border border-transparent px-2 py-1 text-xs text-slate-500 hover:border-slate-700 hover:text-rose-400 ${FOCUS}`}
        >
          Remove
        </button>
      </div>
    </article>
  );
}

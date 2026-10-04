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
import { IconCar, IconClipboardCheck, IconClock, IconWrench } from "@/components/marketing/HomeVisuals";
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
    overdue: { icon: "text-orange-400", ring: "border-l-orange-500" },
    "due-soon": { icon: "text-orange-400", ring: "border-l-orange-500" },
    ok: { icon: "text-emerald-400", ring: "border-l-emerald-500/70" },
    neutral: { icon: "text-slate-400", ring: "border-l-slate-600" },
  }[statusLine.tone];

  return (
    <article className="cg-panel relative flex h-full flex-col overflow-hidden rounded-2xl transition-colors hover:border-orange-500/50 focus-within:border-orange-500/50">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/50 px-5 py-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-300">
          <IconCar className="h-5 w-5" />
        </span>
        {vehicle ? <StatusChip tone="ready">Specs ready</StatusChip> : <StatusChip>No curated specs yet</StatusChip>}
      </div>

      <div className="cg-grid-fine flex-1 px-5 pb-5 pt-5">
        <Stamp>
          {year}
          {make ? ` · ${make}` : ""}
        </Stamp>
        <h3 className="mt-1.5 text-3xl font-extrabold uppercase leading-none text-slate-50" style={display}>
          {model}
          {trim ? <span className="text-slate-400"> {trim}</span> : null}
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          {engine ? <>{engine}</> : <span className="text-slate-500">Engine not set</span>}
        </p>
        <p className="mt-1 flex items-center gap-1.5 font-mono text-xs text-slate-400">
          <IconClock className="h-3.5 w-3.5 shrink-0 text-slate-500" />
          {odometer != null ? `${odometer.toLocaleString("en-US")} mi` : "Mileage not set"}
        </p>

        <div className={`cg-well mt-4 flex items-start gap-2.5 rounded-lg border-l-2 p-3 ${tone.ring}`}>
          <span className={`mt-0.5 shrink-0 ${tone.icon}`}>
            {statusLine.tone === "ok" || statusLine.tone === "neutral" ? (
              vehicle ? <IconClipboardCheck className="h-4 w-4" /> : <IconWrench className="h-4 w-4" />
            ) : (
              <IconClock className="h-4 w-4" />
            )}
          </span>
          <span className="text-sm leading-snug text-slate-100">{statusLine.text}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-800 px-5 py-3">
        <Link
          href={href}
          className={`text-sm font-semibold text-orange-400 hover:text-orange-300 after:absolute after:inset-0 after:content-[''] ${FOCUS}`}
        >
          {vehicle ? "Open vehicle" : "Open"} <span aria-hidden>&rarr;</span>
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

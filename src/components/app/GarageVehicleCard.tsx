"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Vehicle } from "@/types/vehicle";
import type { CustomVehicleInfo } from "@/types/garage";
import { listRepairsForVehicle } from "@/lib/data";
import { useOdometer } from "@/lib/odometer";
import { useServiceHistory } from "@/lib/serviceHistory";
import { computeReminders, maintenanceItemsFor } from "@/lib/reminders";
import { summarizeGarageStatus } from "@/lib/garageStatus";
import { FOCUS, display } from "@/components/app/AppKit";

// One vehicle on My Garage, laid out per the approved Garage mockup: a large
// photograph, year / make+model, the trim-engine-transmission-drivetrain line,
// one owner-facing status line, a full-width action, and quick links.
//
// Photography: public/images/vehicles/<catalog-id>.jpg when the file exists
// (the <img> hides itself if it does not). Anything without a photo gets a
// restrained workshop fallback with the make set large and faint. Nothing here
// is a generated picture passed off as the owner's own vehicle.
//
// Every figure is something the app already knows: the catalog entry, the
// odometer, and reminders computeReminders() already produces. No invented
// averages, no invented capability. Quick links go to sections the vehicle page
// really has (#info, #guides, #history, #maintenance), catalog vehicles only.

type Props =
  | { id: string; kind: "catalog"; vehicle: Vehicle; onRemove: () => void }
  | { id: string; kind: "custom"; custom: CustomVehicleInfo; onRemove: () => void };

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <circle cx="10" cy="10" r="9" fill="currentColor" opacity="0.18" />
      <path d="M6 10.2l2.7 2.7L14 7.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlusDot({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <circle cx="10" cy="10" r="9" fill="currentColor" opacity="0.2" />
      <path d="M10 6v8M6 10h8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const QUICK = [
  { label: "Specs", hash: "info" },
  { label: "Guides", hash: "guides" },
  { label: "History", hash: "history" },
  { label: "Reminders", hash: "maintenance" },
] as const;

export default function GarageVehicleCard(props: Props) {
  const { id, kind, onRemove } = props;
  const vehicle = kind === "catalog" ? props.vehicle : undefined;
  const custom = kind === "custom" ? props.custom : undefined;

  const { odometer } = useOdometer(id);
  const { entries } = useServiceHistory(id);
  const [photoFailed, setPhotoFailed] = useState(false);

  const guideCount = useMemo(() => (vehicle ? listRepairsForVehicle(vehicle.id).length : 0), [vehicle]);

  const reminder = useMemo(() => {
    const items = maintenanceItemsFor(vehicle ?? null);
    return summarizeGarageStatus(computeReminders(entries, odometer, items));
  }, [entries, odometer, vehicle]);

  const year = vehicle ? String(vehicle.year) : custom?.year ?? "Year unknown";
  const make = vehicle ? vehicle.make : custom?.make ?? "";
  const model = vehicle ? vehicle.model : [custom?.model].filter(Boolean).join(" ") || (make ? "" : "Unnamed vehicle");
  const trim = vehicle ? vehicle.trim : custom?.trim;
  const engine = vehicle ? vehicle.engine : custom?.engine;
  const href = vehicle ? `/vehicles/${vehicle.id}` : `/garage/custom/${id}`;
  const label = [year, make, model].filter(Boolean).join(" ");

  // Presentation photography: a catalog vehicle's own file, or a stock-style
  // image for the make/model of a custom entry. Missing files fall back (onError).
  const slug = (t?: string) => (t ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const photoSrc = vehicle
    ? `/images/vehicles/${vehicle.id}.jpg`
    : custom?.make && custom?.model
      ? `/images/vehicles/model-${slug(custom.make)}-${slug(custom.model)}.jpg`
      : null;

  const specParts = vehicle ? [trim, engine, vehicle.transmission, vehicle.drivetrain] : [trim, engine];
  const specLine = specParts.filter(Boolean).join(" • ");

  const supported = Boolean(vehicle) && guideCount > 0;
  const statusTitle = supported ? "Guides available" : vehicle ? "Specs available" : "Added to your garage";
  const statusSub = supported ? null : vehicle ? "Guides coming soon" : "Specs & guides coming soon";

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-[#080d15]/80 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:border-white/25 focus-within:border-white/25">
      <div className="relative h-48 overflow-hidden bg-[#0a0f18] sm:h-52">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(90%_120%_at_70%_0%,#2a2118_0%,#120f0d_55%,#07090d_100%)]">
          <div className="absolute inset-0 opacity-[0.06] [background:repeating-linear-gradient(90deg,#fff_0_1px,transparent_1px_5px)]" />
          <span
            className="absolute inset-x-0 top-1/2 -translate-y-1/2 truncate px-4 text-center text-[4.5rem] font-extrabold uppercase leading-none tracking-wide text-white/[0.07]"
            style={display}
          >
            {make || "Vehicle"}
          </span>
        </div>
        {photoSrc && !photoFailed && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoSrc}
            alt=""
            className="absolute inset-0 h-full w-full object-cover [object-position:42%_58%]"
            loading="lazy"
            onError={() => setPhotoFailed(true)}
          />
        )}
        {photoSrc && !photoFailed && (
          <span className="absolute bottom-2 left-3 text-[0.65rem] uppercase tracking-wider text-white/75 [text-shadow:0_1px_6px_rgba(0,0,0,0.9)]">Illustrative image</span>
        )}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#080d15] via-[#080d15]/10 to-transparent" />
        <button
          type="button"
          onClick={onRemove}
          aria-label={vehicle ? `Remove ${label} from garage` : "Remove vehicle from garage"}
          title="Remove from garage"
          className={`absolute right-3 top-3 z-10 rounded-md bg-black/45 px-2.5 py-1 text-xs text-slate-200 backdrop-blur hover:bg-black/70 hover:text-rose-300 ${FOCUS}`}
        >
          Remove
        </button>
      </div>

      <div className="flex flex-1 flex-col px-5 pb-5 pt-1">
        <p className="font-mono text-sm text-slate-300">{year}</p>
        <h3 className="mt-0.5 text-[2rem] font-extrabold leading-[0.98] text-slate-50" style={display}>
          {[make, model].filter(Boolean).join(" ")}
        </h3>
        {specLine ? (
          <p className="mt-2 text-sm leading-snug text-slate-300">{specLine}</p>
        ) : (
          <p className="mt-2 text-sm text-slate-500">Engine not set</p>
        )}

        <div className="mt-4 flex items-start gap-2.5 text-sm">
          {vehicle ? (
            <CheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
          ) : (
            <PlusDot className="mt-0.5 h-5 w-5 shrink-0 text-orange-400" />
          )}
          <div className="min-w-0 leading-snug">
            <p className="font-medium text-slate-100">{statusTitle}</p>
            {statusSub && <p className="text-[0.8rem] text-slate-400">{statusSub}</p>}
          </div>
          {odometer != null && (
            <span className="ml-auto shrink-0 font-mono text-xs text-slate-400">{odometer.toLocaleString("en-US")} mi</span>
          )}
        </div>

        {reminder && (
          <p className="mt-2 flex items-start gap-2.5 text-[0.8rem] leading-snug text-slate-300">
            <span className={`mt-[0.35rem] h-2 w-2 shrink-0 rounded-full ${reminder.tone === "ok" ? "bg-emerald-500" : "bg-orange-500"}`} aria-hidden />
            {reminder.text}
          </p>
        )}

        <Link
          href={href}
          className={`mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-5 py-3 font-semibold text-slate-950 shadow-lg shadow-black/40 hover:bg-orange-400 after:absolute after:inset-0 after:content-[''] ${FOCUS}`}
        >
          {vehicle ? "Open vehicle" : "View details"} <span aria-hidden>&rarr;</span>
        </Link>

        {vehicle && (
          <ul className="relative z-10 mt-4 grid grid-cols-4 border-t border-white/[0.08] pt-3 text-center">
            {QUICK.map((q) => (
              <li key={q.hash}>
                <Link href={`${href}#${q.hash}`} className={`block rounded px-1 py-1 text-xs text-slate-300 hover:text-white ${FOCUS}`}>
                  {q.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

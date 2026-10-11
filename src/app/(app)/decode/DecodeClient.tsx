"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { decodeVin, DecodedVin } from "@/lib/vpic";
import { matchCatalogVehicles, catalogMatchLooksExact, findVehicle } from "@/lib/data";
import { useGarage, type ConfigChoice } from "@/lib/garage";
import type { Vehicle } from "@/types/vehicle";
import type { CustomVehicleInfo } from "@/types/garage";
import ConfirmYourRide from "@/components/config/ConfirmYourRide";
import VinField from "@/components/vin/VinField";

export default function DecodePage() {
  const router = useRouter();
  const { addCustomVehicle, addCatalogVehicle } = useGarage();
  const [result, setResult] = useState<DecodedVin | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickedMatchId, setPickedMatchId] = useState<string | null>(null);

// Checked against the real catalog as of 2026-09-19 (see
// claude/crankcase-v1-build-notes.md) -- previously a decode always became a
// bare "custom" entry even when it matched a vehicle we already have full
  // specs/torque/guides for. `/garage/add` got the fuller VIN-decode-led
// redesign; this standalone page gets the same underlying fix so it doesn't
// route people to a dead-end custom entry either.
const matches = result ? matchCatalogVehicles(result) : [];

// Added 2026-09-19 alongside the cab/trim-mismatch fix -- an engine match
// doesn't confirm the catalog vehicle's stored trim/cab is actually what
// the VIN decoded to, so this decides whether it's honest to keep saying
// "this exact vehicle" or whether to show the decoded trim/cab with a
// caveat instead. See catalogMatchLooksExact() in src/lib/data.ts.
const exactMatch =
  result && matches.length === 1 ? catalogMatchLooksExact(result, matches[0]) : true;

// Nothing is saved from the buttons below: they open Confirm Your Ride, and the vehicle is added only when the
// customer confirms transmission and drivetrain there (or says Not sure).
type Confirming =
  | { kind: "catalog"; vehicle: Vehicle; vin: string; label: string }
  | { kind: "custom"; info: CustomVehicleInfo & { vin: string }; label: string };
const [confirming, setConfirming] = useState<Confirming | null>(null);

function handleAddMatch() {
  if (!pickedMatchId || !result) return;
  const vehicle = findVehicle(pickedMatchId);
  if (!vehicle) return;
  setConfirming({ kind: "catalog", vehicle, vin: result.vin, label: `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? " " + vehicle.trim : ""}` });
}

async function confirmAdd(choice: ConfigChoice) {
  if (!confirming) throw new Error("Nothing to add.");
  return confirming.kind === "catalog"
    ? addCatalogVehicle(confirming.vehicle.id, confirming.vin, choice)
    : addCustomVehicle(confirming.info, choice);
}

function doneAdding(outcome: { id: string }) {
  if (!confirming) return;
  router.push(confirming.kind === "catalog" ? `/vehicles/${confirming.vehicle.id}` : `/garage/custom/${outcome.id}`);
}

function handleAddToGarage() {
  if (!result) return;
  const engine = [
    result.displacementL ? `${result.displacementL}L` : null,
    result.engineCylinders ? `${result.engineCylinders}-cyl` : null,
    ]
  .filter(Boolean)
  .join(" ");
  setConfirming({
    kind: "custom",
    label: [result.year, result.make, result.model, result.trim].filter(Boolean).join(" "),
    info: { vin: result.vin, year: result.year, make: result.make, model: result.model, trim: result.trim, engine: engine || undefined },
  });
}

async function handleSubmit(vin: string) {
  setError(null);
  setResult(null);
  setPickedMatchId(null);
  setLoading(true);
  try {
    // `vin` already passed the format and check-digit rules and, if it came from a photo, the customer confirmed it.
    const decoded = { ...(await decodeVin(vin)), vin };
    setResult(decoded);
    const found = matchCatalogVehicles(decoded);
    if (found.length === 1) { setPickedMatchId(found[0].id); } else if (found.length > 1) { const exact = found.filter((v) => catalogMatchLooksExact(decoded, v)); if (exact.length === 1) setPickedMatchId(exact[0].id); }
  } catch {
    setError("Couldn't reach the NHTSA VIN decoder right now. Try again in a moment.");
  } finally {
    setLoading(false);
  }
}

if (confirming) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-bold text-slate-50">VIN Lookup</h1>
      <ConfirmYourRide
        label={confirming.label}
        make={confirming.kind === "catalog" ? confirming.vehicle.make : confirming.info.make}
        vehicle={confirming.kind === "catalog" ? confirming.vehicle : undefined}
        decoded={result}
        onConfirm={confirmAdd}
        onDone={doneAdding}
        onCancel={() => setConfirming(null)}
      />
    </div>
  );
}

return (
  <div className="mx-auto max-w-2xl px-4 py-10">
  <Link href="/garage" className="text-sm text-slate-400 hover:text-slate-200">
  &larr; Back to garage
  </Link>
  
  <h1 className="mt-3 text-3xl font-bold text-slate-50">VIN Lookup</h1>
  <p className="mt-2 text-slate-400">
  Free basic decode via the NHTSA vPIC public database -- good for
  confirming year/make/model/engine. If it matches a vehicle we have full
  guides for, we&apos;ll offer that instead of a bare lookup.
  </p>
  
  <VinField onLookup={handleSubmit} busy={loading} busyLabel="Decoding…" buttonLabel="Decode" />
  
    {error && (
    <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
      {error}
    </div>
  )}
  
    {result && matches.length > 0 && (
    <div className="mt-6 rounded-xl border border-emerald-500/30 bg-slate-900 p-5">
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
      {matches.length === 1
        ? exactMatch
        ? "We have full specs, fluid capacities, and repair guides for this exact vehicle."
        : "Same engine as a vehicle we have full guides for -- fluid and torque data below should apply, but see the note below on trim/cab."
        : "We have full guides for more than one build of this vehicle. Pick the one that matches yours:"}
    </div>
      {matches.length === 1 && !exactMatch && (
      <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-300">
      Your VIN decoded as {[result.trim, result.bodyCabType].filter(Boolean).join(", ")}
        {result.trim || result.bodyCabType ? " -- " : ""}
      the trim/cab shown below ({matches[0].trim}) is what we have modeled for this
      engine and may not be an exact match for your specific truck.
      </div>
    )}
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {matches.map((v) => (
      <button
        key={v.id}
        type="button"
        onClick={() => setPickedMatchId(v.id)}
        className={`rounded-xl border p-4 text-left transition ${
          pickedMatchId === v.id
          ? "border-orange-500 bg-slate-800"
          : "border-slate-800 bg-slate-950 hover:border-orange-500/50"
        }`}
        >
      <div className="text-xs uppercase tracking-wide text-orange-400 font-semibold">
      {v.year}
      </div>
      <div className="mt-0.5 font-bold text-slate-100">
        {v.make} {v.model}
        {v.trim ? " " + v.trim : ""}
      </div>
      <div className="mt-1 text-xs text-slate-500">
        {v.engine}
        {v.drivetrain ? " \u00b7 " + v.drivetrain : ""}
      </div>
      </button>
      ))}
    </div>
    {matches.length > 1 && pickedMatchId && (
    <p className="mt-2 text-xs text-slate-500">
      Selected from what your VIN decoded to. Tap another card if that is not your truck.
    </p>
    )}
    <button
      type="button"
      onClick={handleAddMatch}
      disabled={!pickedMatchId}
      className="mt-4 w-full rounded-lg bg-orange-500 px-4 py-2.5 font-semibold text-slate-950 hover:bg-orange-400 disabled:opacity-50"
      >
    + Add to garage
    </button>
    </div>
  )}
  
    {result && (
    <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900 p-5">
      {result.errorText && !result.make && (
      <p className="text-sm text-amber-400">{result.errorText}</p>
    )}
    <dl className="divide-y divide-slate-800">
      {[
      ["VIN", result.vin],
      ["Year", result.year],
      ["Make", result.make],
      ["Model", result.model],
      ["Trim", result.trim],
      ["Body Class", result.bodyClass],
      ["Cab Type", result.bodyCabType],
      ["Cylinders", result.engineCylinders],
      ["Displacement (L)", result.displacementL],
      ["Fuel Type", result.fuelType],
      ["Drive Type", result.driveType],
      ["Transmission", result.transmissionStyle],
      ]
        .filter(([, v]) => v)
        .map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 py-2 text-sm">
          <dt className="text-slate-400">{label}</dt>
          <dd className="text-right font-medium text-slate-100">{value}</dd>
          </div>
          ))}
    </dl>
      {result.make && matches.length === 0 && (
      <button
        type="button"
        onClick={handleAddToGarage}
        className="mt-4 w-full rounded-lg bg-orange-500 px-4 py-2.5 font-semibold text-slate-950 hover:bg-orange-400"
        >
      + Add this vehicle to my garage
      </button>
    )}
    </div>
  )}
  </div>
  );
}

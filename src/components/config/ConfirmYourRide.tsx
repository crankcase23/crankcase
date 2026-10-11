"use client";

import { useMemo, useState } from "react";
import type { Vehicle } from "@/types/vehicle";
import type { DecodedVin } from "@/lib/vpic";
import type { AddOutcome, ConfigChoice } from "@/lib/garage";
import { choiceLabel, configOptionsFor, type AxisChoice } from "@/lib/vehicleConfig";
import ConfigChoices, { type ConfigValue } from "@/components/config/ConfigChoices";

/**
 * Confirm Your Ride: the step between a VIN lookup (or a manual pick) and the vehicle being saved.
 *
 * The vehicle is NOT added until the customer presses the confirm button, and the button stays disabled until BOTH
 * transmission and drivetrain have an explicit answer ("Not sure" is an answer). A VIN decode may preselect a choice
 * when it names one, and the customer still has to press the button. Nothing here writes to the garage on its own.
 */
export default function ConfirmYourRide({
  label,
  make,
  vehicle,
  decoded,
  onConfirm,
  onDone,
  onCancel,
}: {
  /** "2010 BMW 328i Sedan (E90)" */
  label: string;
  make?: string;
  vehicle?: Vehicle;
  decoded?: DecodedVin | null;
  /** Adds the vehicle with the confirmed choices. */
  onConfirm: (choice: ConfigChoice) => Promise<AddOutcome>;
  /** Called after a vehicle that was really added. */
  onDone: (outcome: AddOutcome) => void;
  onCancel: () => void;
}) {
  const options = useMemo(() => configOptionsFor({ make: make ?? vehicle?.make, vehicle, decoded: decoded ?? undefined }), [make, vehicle, decoded]);
  const [value, setValue] = useState<ConfigValue>(() => ({
    transmission: options.transmission.preselect ?? null,
    drivetrain: options.drivetrain.preselect ?? null,
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<AddOutcome | null>(null);

  const ready = value.transmission !== null && value.drivetrain !== null;
  const mk = make ?? vehicle?.make;

  async function confirm() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const outcome = await onConfirm({ transmission: value.transmission as ConfigChoice["transmission"], drivetrain: value.drivetrain as ConfigChoice["drivetrain"] });
      if (outcome.created) onDone(outcome);
      else setExisting(outcome);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add that vehicle to your garage.");
    } finally {
      setBusy(false);
    }
  }

  if (existing) {
    return (
      <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-sm text-emerald-200" role="status" data-testid="already-in-garage">
        <p className="font-semibold">This vehicle is already in your garage.</p>
        <p className="mt-1">
          Nothing was duplicated.
          {existing.configKept ? " Your saved transmission and drivetrain were kept; use Edit Configuration on the vehicle page to change them." : ""}
        </p>
        <button type="button" onClick={() => onDone(existing)} className="mt-3 rounded-lg bg-orange-500 px-4 py-2 font-semibold text-slate-950 hover:bg-orange-400">
          Open vehicle
        </button>
      </div>
    );
  }

  const basis = {
    transmission: options.transmission.preselect ? options.transmission.preselectBasis : undefined,
    drivetrain: options.drivetrain.preselect ? options.drivetrain.preselectBasis : undefined,
  };
  const summary = ready
    ? `${choiceLabel("transmission", value.transmission as AxisChoice, mk)} · ${choiceLabel("drivetrain", value.drivetrain as AxisChoice, mk)}`
    : null;

  return (
    <section className="mt-5 rounded-xl border border-orange-500/40 bg-slate-900 p-5" aria-labelledby="confirm-ride-title" data-testid="confirm-your-ride">
      <p className="text-xs font-semibold uppercase tracking-wide text-orange-400">Step 2 of 2</p>
      <h2 id="confirm-ride-title" className="mt-1 text-xl font-bold text-slate-50">Confirm your ride</h2>
      <p className="mt-1 text-sm text-slate-300">{label}</p>
      <p className="mt-2 text-sm text-slate-400">
        These two choices decide which steps, parts, fluids and torque figures Crankcase shows for your vehicle. Pick what your
        vehicle actually has. If you are not sure, say so and we will not guess.
      </p>
      {options.transmission.source === "generic" || options.drivetrain.source === "generic" ? (
        <p className="mt-2 text-xs text-slate-500">We do not have a model-specific list for this vehicle, so choose the one that matches yours.</p>
      ) : null}

      <div className="mt-4">
        <ConfigChoices make={mk} options={options} value={value} onChange={(axis, v) => setValue((s) => ({ ...s, [axis]: v }))} basis={basis} disabled={busy} />
      </div>

      {error && (
        <div role="alert" className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={confirm}
          disabled={!ready || busy}
          className="rounded-lg bg-orange-500 px-5 py-2.5 font-semibold text-slate-950 hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Adding…" : summary ? `Confirm ${summary} and add to garage` : "Confirm and add to garage"}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className="rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:border-slate-400 disabled:opacity-40">
          Back
        </button>
        {!ready && <span className="text-xs text-slate-500">Choose a transmission and a drivetrain (or Not sure) to continue.</span>}
      </div>
      <p className="mt-3 text-xs text-slate-500">You can change either one later with Edit Configuration on the vehicle page.</p>
    </section>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Vehicle } from "@/types/vehicle";
import { useGarage } from "@/lib/garage";
import {
  choiceLabel,
  configOptionsFor,
  configState,
  confirmedValue,
  normalizeConfig,
  UNKNOWN,
  type AxisChoice,
  type VehicleConfig,
} from "@/lib/vehicleConfig";
import ConfigChoices, { type ConfigValue } from "@/components/config/ConfigChoices";

/**
 * "Your configuration" on a vehicle: what the customer confirmed, an Edit Configuration button, and a plain prompt while
 * anything is still unconfirmed. Saving goes through PATCH /api/garage/[id] (the one explicit way a choice changes) and
 * then refreshes the server-rendered page, so the header, specs, fluids and every guide re-resolve to the new answer.
 *
 * `vehicle` is the catalog vehicle when there is one (its model list decides the options); a custom vehicle has none and
 * gets the generic family. `initial` is what the server rendered, so there is no flash while the garage loads.
 */
export default function VehicleConfigPanel({
  vehicleId,
  make,
  vehicle,
  initial,
}: {
  vehicleId: string;
  make?: string;
  vehicle?: Vehicle;
  initial: VehicleConfig | null;
}) {
  const router = useRouter();
  const { updateConfig, entries } = useGarage();
  // The client copy wins once the garage has loaded (it reflects an edit made a moment ago); until then show the server's.
  const live = entries.find((e) => e.id === vehicleId)?.config;
  const config = useMemo(() => normalizeConfig(live ?? initial ?? {}), [live, initial]);
  const state = configState(config);
  const options = useMemo(() => configOptionsFor({ make, vehicle }), [make, vehicle]);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ConfigValue>({ transmission: null, drivetrain: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open() {
    setDraft({ transmission: config.transmission, drivetrain: config.drivetrain });
    setError(null);
    setEditing(true);
  }

  async function save() {
    const change: { transmission?: AxisChoice; drivetrain?: AxisChoice } = {};
    if (draft.transmission && draft.transmission !== config.transmission) change.transmission = draft.transmission;
    if (draft.drivetrain && draft.drivetrain !== config.drivetrain) change.drivetrain = draft.drivetrain;
    if (Object.keys(change).length === 0) {
      setEditing(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateConfig(vehicleId, change);
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your configuration.");
    } finally {
      setBusy(false);
    }
  }

  const t = confirmedValue(config, "transmission");
  const d = confirmedValue(config, "drivetrain");
  const line =
    state === "confirmed"
      ? `${choiceLabel("transmission", t!, make)} · ${choiceLabel("drivetrain", d!, make)}`
      : state === "unset"
        ? "Not confirmed yet"
        : [
            t ? choiceLabel("transmission", t, make) : config.transmission === UNKNOWN ? "Transmission: not sure" : "Transmission: not confirmed",
            d ? choiceLabel("drivetrain", d, make) : config.drivetrain === UNKNOWN ? "Drivetrain: not sure" : "Drivetrain: not confirmed",
          ].join(" · ");
  const ready = draft.transmission !== null && draft.drivetrain !== null;

  return (
    <section id="vehicle-config" className="mt-4 scroll-mt-28 max-w-xl rounded-xl border border-white/10 bg-black/35 p-4 backdrop-blur" aria-label="Vehicle configuration" data-testid="vehicle-config-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Your configuration</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-100" data-testid="config-line">{line}</p>
        </div>
        {!editing && (
          <button type="button" onClick={open} className="rounded-lg border border-slate-500 px-3 py-1.5 text-sm font-semibold text-slate-100 hover:border-slate-300">
            {state === "confirmed" ? "Edit configuration" : "Confirm configuration"}
          </button>
        )}
      </div>
      {state !== "confirmed" && !editing && (
        <p className="mt-2 text-xs text-amber-300">
          Steps, parts and torque figures that depend on your transmission or drivetrain stay restricted until you confirm them.
        </p>
      )}
      {editing && (
        <div className="mt-4">
          <ConfigChoices make={make} options={options} value={draft} onChange={(axis, v) => setDraft((s) => ({ ...s, [axis]: v }))} disabled={busy} />
          <p className="mt-3 text-xs text-slate-400">
            Changing this updates the guides for this vehicle. Your service history is not touched, and a Wrench Mode session in progress ends so you never continue with steps for the old build.
          </p>
          {error && (
            <div role="alert" className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {error}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={save} disabled={!ready || busy} className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-orange-400 disabled:opacity-40">
              {busy ? "Saving…" : "Save configuration"}
            </button>
            <button type="button" onClick={() => setEditing(false)} disabled={busy} className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-400 disabled:opacity-40">
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

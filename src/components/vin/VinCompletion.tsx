"use client";

import { useState } from "react";
import { useGarage } from "@/lib/garage";
import { isValidVin } from "@/lib/vin";
import VinField from "@/components/vin/VinField";

/**
 * Older garage records were added before a VIN was required. They are kept exactly as they are; this panel is how one gets
 * its VIN. It appears only for the customer's OWN entry that has no valid VIN, and it only ever attaches a VIN to that
 * entry. A VIN typed or scanned here is never proof of ownership: if it is not available to this account the server says
 * so generically and nothing is shared.
 */
export default function VinCompletion({ vehicleId, serverHasVin }: { vehicleId: string; serverHasVin: boolean }) {
  const { entries, completeVin } = useGarage();
  const entry = entries.find((e) => e.id === vehicleId);
  const entryVin = entry ? (entry.kind === "catalog" ? entry.vin : entry.custom.vin) : undefined;
  const hasVin = entry ? isValidVin(entryVin) : serverHasVin;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (saved) {
    return (
      <p role="status" data-testid="vin-saved" className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
        VIN saved to this vehicle.
      </p>
    );
  }
  if (hasVin) return null;

  async function save(vin: string) {
    setBusy(true);
    setError(null);
    try {
      await completeVin(vehicleId, vin);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save that VIN.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="vin-completion" data-testid="vin-completion" className="mt-4 rounded-xl border border-amber-500/40 bg-slate-900 p-4">
      <h2 className="text-base font-semibold text-slate-100">Add your VIN</h2>
      <p className="mt-1 text-sm text-slate-400">
        This vehicle was added before we asked for a VIN. Everything you&apos;ve saved stays. Adding the VIN completes the record.
      </p>
      <VinField onLookup={save} busy={busy} busyLabel="Saving…" buttonLabel="Save VIN" />
      {error ? (
        <p role="alert" data-testid="vin-completion-error" className="mt-2 text-sm text-rose-300">{error}</p>
      ) : null}
    </section>
  );
}

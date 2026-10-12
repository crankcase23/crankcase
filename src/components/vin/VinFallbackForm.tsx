"use client";

import { useState } from "react";
import { parseFallbackDetails, type TypedDetails } from "@/lib/vinFallback";

// Offered ONLY after the browser could not reach the NHTSA decoder, and only when the server has the fallback switched on.
// The VIN is the one already typed above (it passed the VIN rules); this collects what the customer knows about the vehicle.
// Nothing is saved here: Continue opens Confirm Your Ride, and the SERVER still decides (it asks NHTSA itself) whether the
// vehicle is added as unverified, verified, or refused.
export default function VinFallbackForm({ vin, onContinue }: { vin: string; onContinue: (details: TypedDetails) => void }) {
  const [f, setF] = useState({ year: "", make: "", model: "", trim: "", engine: "" });
  const [ack, setAck] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-orange-500 focus:outline-none";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFallbackDetails(f);
    if (!parsed.ok) return setError(parsed.error);
    if (!ack) return setError("Tick the box to confirm you typed these yourself.");
    setError(null);
    onContinue(parsed.value);
  }

  return (
    <form data-testid="vin-fallback-form" onSubmit={submit} className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-slate-300">
      <h3 className="font-semibold text-amber-300">Add it by hand while the decoder is down</h3>
      <p className="mt-1">
        Your VIN (<span className="font-mono">{vin}</span>) is still required. Type what you know about the vehicle. It will be marked{" "}
        <strong>UNVERIFIED</strong> until we can check it against NHTSA, and it gets Service History and reminders only: no specs, fluids or guides.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-slate-400">Year<input aria-label="Year" className={field} value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} inputMode="numeric" maxLength={4} /></label>
        <label className="text-xs text-slate-400">Make<input aria-label="Make" className={field} value={f.make} onChange={(e) => setF({ ...f, make: e.target.value })} maxLength={40} /></label>
        <label className="text-xs text-slate-400">Model<input aria-label="Model" className={field} value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} maxLength={60} /></label>
        <label className="text-xs text-slate-400">Trim (optional)<input aria-label="Trim" className={field} value={f.trim} onChange={(e) => setF({ ...f, trim: e.target.value })} maxLength={60} /></label>
        <label className="text-xs text-slate-400 sm:col-span-2">Engine (optional)<input aria-label="Engine" className={field} value={f.engine} onChange={(e) => setF({ ...f, engine: e.target.value })} maxLength={60} /></label>
      </div>
      <label className="mt-3 flex items-start gap-2 text-slate-300">
        <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-1" />
        <span>I typed these details myself. They haven&apos;t been checked against NHTSA.</span>
      </label>
      {error && <p role="alert" className="mt-3 text-rose-300">{error}</p>}
      <button type="submit" className="mt-3 rounded-lg bg-orange-500 px-4 py-2 font-semibold text-slate-950 hover:bg-orange-400">
        Continue
      </button>
    </form>
  );
}

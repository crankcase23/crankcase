"use client";

import { useState } from "react";
import { useGarage } from "@/lib/garage";
import type { CustomVehicleInfo } from "@/types/garage";
import UnverifiedBadge from "@/components/vin/UnverifiedBadge";

// Shown on the vehicle page of an UNVERIFIED vehicle (added by typed details while NHTSA was down). It says plainly what
// that means, lets the customer ask us to check it now (the SERVER asks NHTSA), and lets them correct what they typed.
// The VIN itself is never editable here.
export default function UnverifiedPanel({ id, custom }: { id: string; custom: CustomVehicleInfo }) {
  const { verifyVehicle, editUnverifiedDetails } = useGarage();
  const [busy, setBusy] = useState<"check" | "save" | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({ year: custom.year ?? "", make: custom.make ?? "", model: custom.model ?? "", trim: custom.trim ?? "", engine: custom.engine ?? "" });
  const field = "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-orange-500 focus:outline-none";

  async function check() {
    setBusy("check");
    setMessage(null);
    try {
      await verifyVehicle(id);
      setMessage({ kind: "ok", text: "Checked with NHTSA. These details now match and the vehicle is verified." });
    } catch (e) {
      setMessage({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy("save");
    setMessage(null);
    try {
      await editUnverifiedDetails(id, { year: f.year, make: f.make, model: f.model, ...(f.trim ? { trim: f.trim } : {}), ...(f.engine ? { engine: f.engine } : {}) });
      setEditing(false);
      setMessage({ kind: "ok", text: "Details saved. They're still unverified until we check them with NHTSA." });
    } catch (err) {
      setMessage({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section data-testid="unverified-panel" className="cg-well rounded-xl border-l-2 border-l-amber-500/70 px-4 py-4 text-sm leading-relaxed text-slate-300">
      <p>
        <UnverifiedBadge className="mr-2" />
        <span className="font-semibold text-amber-300">You typed these details yourself.</span> We added this vehicle while the NHTSA VIN decoder
        was down and haven&apos;t checked them yet. You can log service history and get generic reminders. Specs, fluids and guides stay off for
        this vehicle until the details are checked.
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" onClick={check} disabled={busy !== null} className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-orange-400 disabled:opacity-50">
          {busy === "check" ? "Checking…" : "Check with NHTSA now"}
        </button>
        <button type="button" onClick={() => setEditing((v) => !v)} className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-slate-500">
          {editing ? "Cancel" : "Correct the details"}
        </button>
      </div>
      {message && (
        <p role="status" className={`mt-3 ${message.kind === "ok" ? "text-emerald-300" : "text-rose-300"}`}>
          {message.text}
        </p>
      )}
      {editing && (
        <form onSubmit={save} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-slate-400">Year<input aria-label="Year" className={field} value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} inputMode="numeric" maxLength={4} /></label>
          <label className="text-xs text-slate-400">Make<input aria-label="Make" className={field} value={f.make} onChange={(e) => setF({ ...f, make: e.target.value })} maxLength={40} /></label>
          <label className="text-xs text-slate-400">Model<input aria-label="Model" className={field} value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} maxLength={60} /></label>
          <label className="text-xs text-slate-400">Trim (optional)<input aria-label="Trim" className={field} value={f.trim} onChange={(e) => setF({ ...f, trim: e.target.value })} maxLength={60} /></label>
          <label className="text-xs text-slate-400 sm:col-span-2">Engine (optional)<input aria-label="Engine" className={field} value={f.engine} onChange={(e) => setF({ ...f, engine: e.target.value })} maxLength={60} /></label>
          <div className="sm:col-span-2">
            <button type="submit" disabled={busy !== null} className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-orange-400 disabled:opacity-50">
              {busy === "save" ? "Saving…" : "Save details"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

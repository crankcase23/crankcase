"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { decodeVin, DecodedVin } from "@/lib/vpic";
import { useGarage } from "@/lib/garage";

export default function DecodePage() {
  const router = useRouter();
  const { addCustomVehicle } = useGarage();
  const [vin, setVin] = useState("");
  const [result, setResult] = useState<DecodedVin | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAddToGarage() {
    if (!result) return;
    const engine = [
      result.displacementL ? `${result.displacementL}L` : null,
      result.engineCylinders ? `${result.engineCylinders}-cyl` : null,
    ]
      .filter(Boolean)
      .join(" ");
    const id = await addCustomVehicle({
      vin: result.vin,
      year: result.year,
      make: result.make,
      model: result.model,
      trim: result.trim,
      engine: engine || undefined,
    });
    router.push(`/garage/custom/${id}`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (vin.trim().length !== 17) {
      setError("VINs are 17 characters — double-check and try again.");
      return;
    }
    setLoading(true);
    try {
      const decoded = await decodeVin(vin);
      setResult(decoded);
    } catch {
      setError("Couldn't reach the NHTSA VIN decoder right now. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/garage" className="text-sm text-slate-400 hover:text-slate-200">
        &larr; Back to garage
      </Link>

      <h1 className="mt-3 text-3xl font-bold text-slate-50">VIN Lookup</h1>
      <p className="mt-2 text-slate-400">
        Free basic decode via the NHTSA vPIC public database — good for
        confirming year/make/model/engine. It doesn&apos;t include fluid
        capacities, torque specs, or repair steps; those live in the curated
        vehicle guides on the home page.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex gap-2">
        <input
          value={vin}
          onChange={(e) => setVin(e.target.value)}
          placeholder="Enter 17-character VIN"
          maxLength={17}
          className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-slate-100 placeholder:text-slate-500 focus:border-orange-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-orange-500 px-5 py-2 font-semibold text-slate-950 hover:bg-orange-400 disabled:opacity-50"
        >
          {loading ? "Decoding…" : "Decode"}
        </button>
      </form>

      {error && (
        <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
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
          {result.make && (
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

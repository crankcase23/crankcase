"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listVehicles } from "@/lib/data";
import { useGarage } from "@/lib/garage";

export default function AddVehiclePage() {
  const router = useRouter();
  const { entries, addCatalogVehicle, addCustomVehicle } = useGarage();
  const catalog = listVehicles();
  const inGarage = new Set(entries.filter((e) => e.kind === "catalog").map((e) => e.id));

  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [trim, setTrim] = useState("");
  const [engine, setEngine] = useState("");

  async function handleAddCatalog(id: string) {
    await addCatalogVehicle(id);
    router.push(`/vehicles/${id}`);
  }

  async function handleAddCustom(e: React.FormEvent) {
    e.preventDefault();
    if (!year.trim() && !make.trim() && !model.trim()) return;
    const id = await addCustomVehicle({
      year: year.trim() || undefined,
      make: make.trim() || undefined,
      model: model.trim() || undefined,
      trim: trim.trim() || undefined,
      engine: engine.trim() || undefined,
    });
    router.push(`/garage/custom/${id}`);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/garage" className="text-sm text-slate-400 hover:text-slate-200">
        &larr; Back to garage
      </Link>

      <h1 className="mt-3 text-3xl font-bold text-slate-50">Add a vehicle</h1>
      <p className="mt-2 text-slate-400">
        Pick from the vehicles we have full specs and guides for, or add your
        own — you can still track service history and see maintenance
        reminders on any vehicle, guides or not.
      </p>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-slate-100">
          Vehicles with full guides
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {catalog.map((v) => {
            const already = inGarage.has(v.id);
            return (
              <button
                key={v.id}
                type="button"
                disabled={already}
                onClick={() => handleAddCatalog(v.id)}
                className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-left transition enabled:hover:border-orange-500 enabled:hover:bg-slate-800/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="text-xs uppercase tracking-wide text-orange-400 font-semibold">
                  {v.year}
                </div>
                <div className="mt-0.5 font-bold text-slate-100">
                  {v.make} {v.model} {v.trim}
                </div>
                <div className="mt-1 text-xs text-slate-500">{v.engine}</div>
                <div className="mt-2 text-xs font-medium text-orange-400">
                  {already ? "Already in your garage" : "+ Add to garage"}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-10 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-lg font-semibold text-slate-100">Don&apos;t see your vehicle?</h2>
        <p className="mt-1 text-sm text-slate-400">
          Add it anyway. We won&apos;t have curated specs or torque data for it
          yet, but you can still log service history and get maintenance
          reminders.{" "}
          <Link href="/decode" className="font-medium text-orange-400 hover:text-orange-300">
            Decode a VIN first
          </Link>{" "}
          if you want help filling this in.
        </p>
        <form onSubmit={handleAddCustom} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="year" className="mb-1 block text-xs text-slate-400">Year</label>
            <input
              id="year"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="2016"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-orange-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="make" className="mb-1 block text-xs text-slate-400">Make</label>
            <input
              id="make"
              value={make}
              onChange={(e) => setMake(e.target.value)}
              placeholder="Toyota"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-orange-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="model" className="mb-1 block text-xs text-slate-400">Model</label>
            <input
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Tacoma"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-orange-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="trim" className="mb-1 block text-xs text-slate-400">Trim (optional)</label>
            <input
              id="trim"
              value={trim}
              onChange={(e) => setTrim(e.target.value)}
              placeholder="TRD Off-Road"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-orange-500 focus:outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="engine" className="mb-1 block text-xs text-slate-400">Engine (optional)</label>
            <input
              id="engine"
              value={engine}
              onChange={(e) => setEngine(e.target.value)}
              placeholder="3.5L V6"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-orange-500 focus:outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-orange-500 px-5 py-2.5 font-semibold text-slate-950 hover:bg-orange-400"
            >
              Add to garage
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

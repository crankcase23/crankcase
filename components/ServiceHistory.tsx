"use client";

import { useState } from "react";
import Link from "next/link";
import { useServiceHistory } from "@/lib/serviceHistory";
import { TierBadge } from "@/components/tables";

const GENERIC_JOBS = [
  "Tire Rotation",
  "Battery Replacement",
  "Air Filter Replacement",
  "Cabin Air Filter Replacement",
  "Wiper Blade Replacement",
  "Coolant Flush",
  "Transmission Fluid Service",
  "Brake Fluid Flush",
];
const CUSTOM_LABEL = "Custom / Other…";

export default function ServiceHistory({
  vehicleId,
  vehicleLabel,
  guideTitles,
  printHref,
}: {
  vehicleId: string;
  vehicleLabel: string;
  guideTitles: string[];
  printHref?: string;
}) {
  const { entries, addEntry, deleteEntry } = useServiceHistory(vehicleId);

  const jobOptions = [...guideTitles, ...GENERIC_JOBS];

  const [date, setDate] = useState("");
  const [mileage, setMileage] = useState("");
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [customChecked, setCustomChecked] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [notes, setNotes] = useState("");

  function toggleJob(option: string) {
    setSelectedJobs((prev) =>
      prev.includes(option) ? prev.filter((j) => j !== option) : [...prev, option]
    );
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const orderedJobs = jobOptions.filter((opt) => selectedJobs.includes(opt));
    const custom = customChecked ? customTitle.trim() : "";
    const services = custom ? [...orderedJobs, custom] : orderedJobs;
    const title = services.join(", ");
    if (!date || !mileage || !title) return;
    addEntry({
      date,
      mileage: Number(mileage),
      title,
      notes: notes.trim() || undefined,
    });
    setDate("");
    setMileage("");
    setSelectedJobs([]);
    setCustomChecked(false);
    setCustomTitle("");
    setNotes("");
  }

  function handleDelete(id: string) {
    deleteEntry(id);
  }

  return (
    <section className="mt-10">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-slate-100">Service History</h2>
        <TierBadge tier="premium" />
      </div>

      <div className="mb-4 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-200">
        🔒 <span className="font-semibold">Premium feature.</span> Fully usable for now while
        we&apos;re still building — once accounts and per-vehicle unlocks ship, this will require
        unlocking this vehicle. Entries save to <em>this browser only</em> for the moment (no
        accounts yet), so they won&apos;t follow you to another device until we add real storage.
      </div>

      {entries.length === 0 ? (
        <p className="mb-4 text-sm text-slate-500">No service logged yet — add the first entry below.</p>
      ) : (
        <div className="mb-4 overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full min-w-[560px] table-fixed divide-y divide-slate-800 text-sm">
            <colgroup>
              <col className="w-[16%]" />
              <col className="w-[16%]" />
              <col className="w-[34%]" />
              <col className="w-[26%]" />
              <col className="w-[8%]" />
            </colgroup>
            <thead className="bg-slate-900">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-300">Date</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-300">Mileage</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-300">Service</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-300">Notes</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950">
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-3 text-slate-200">{e.date}</td>
                  <td className="px-4 py-3 text-slate-200">{e.mileage.toLocaleString()} mi</td>
                  <td className="px-4 py-3 font-medium text-slate-100 break-words">{e.title}</td>
                  <td className="px-4 py-3 text-slate-400 break-words">{e.notes ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(e.id)}
                      aria-label={`Delete ${e.title} entry`}
                      className="text-slate-500 hover:text-rose-400"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form
        onSubmit={handleAdd}
        className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:grid-cols-2"
      >
        <div>
          <label htmlFor="sh-date" className="mb-1 block text-xs text-slate-400">
            Date
          </label>
          <input
            id="sh-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-orange-500 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="sh-mileage" className="mb-1 block text-xs text-slate-400">
            Mileage
          </label>
          <input
            id="sh-mileage"
            type="number"
            min={0}
            inputMode="numeric"
            value={mileage}
            onChange={(e) => setMileage(e.target.value)}
            placeholder="e.g. 142500"
            required
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-orange-500 focus:outline-none"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-2 block text-xs text-slate-400">
            Service(s) performed <span className="text-slate-600">(pick as many as apply)</span>
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            {jobOptions.map((opt) => (
              <label
                key={opt}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 hover:border-slate-600"
              >
                <input
                  type="checkbox"
                  checked={selectedJobs.includes(opt)}
                  onChange={() => toggleJob(opt)}
                  className="h-4 w-4 shrink-0 rounded border-slate-600 bg-slate-900 text-orange-500 focus:ring-orange-500 focus:ring-offset-slate-950"
                />
                <span>{opt}</span>
              </label>
            ))}
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 hover:border-slate-600">
              <input
                type="checkbox"
                checked={customChecked}
                onChange={(e) => setCustomChecked(e.target.checked)}
                className="h-4 w-4 shrink-0 rounded border-slate-600 bg-slate-900 text-orange-500 focus:ring-orange-500 focus:ring-offset-slate-950"
              />
              <span>{CUSTOM_LABEL}</span>
            </label>
          </div>
        </div>
        {customChecked && (
          <div className="sm:col-span-2">
            <label htmlFor="sh-custom" className="mb-1 block text-xs text-slate-400">
              Describe the additional service
            </label>
            <input
              id="sh-custom"
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="e.g. Replaced serpentine belt"
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-orange-500 focus:outline-none"
            />
          </div>
        )}
        <div className="sm:col-span-2">
          <label htmlFor="sh-notes" className="mb-1 block text-xs text-slate-400">
            Notes <span className="text-slate-600">(optional)</span>
          </label>
          <input
            id="sh-notes"
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Parts used, shop, anything worth remembering"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-orange-500 focus:outline-none"
          />
        </div>
        <div className="flex items-center justify-between gap-3 sm:col-span-2">
          <Link
            href={printHref ?? `/vehicles/${vehicleId}/service-history/print`}
            target="_blank"
            className="text-sm font-medium text-orange-400 hover:text-orange-300"
          >
            🖨 Print service record &rarr;
          </Link>
          <button
            type="submit"
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-orange-400"
          >
            Add entry
          </button>
        </div>
      </form>
      <p className="mt-2 text-xs text-slate-600">Logging for: {vehicleLabel}</p>
    </section>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useServiceHistory } from "@/lib/serviceHistory";
import { TierBadge } from "@/components/tables";
import Section from "@/components/app/Section";
import { PANEL } from "@/components/app/Chapter";
import { IconPrinter } from "@/components/app/AppIcons";

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

  // De-duplicated: a guide called "Tire Rotation" and the generic "Tire Rotation"
  // are one job, one chip, one React key.
  const jobOptions = [...new Set([...guideTitles, ...GENERIC_JOBS])];

  const [date, setDate] = useState("");
  const [mileage, setMileage] = useState("");
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [customChecked, setCustomChecked] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [notes, setNotes] = useState("");
  // Phones: the form stays tucked behind one obvious button. md+ shows it open.
  const [formOpen, setFormOpen] = useState(false);

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
    setFormOpen(false);
  }

  function handleDelete(id: string) {
    deleteEntry(id);
  }

  const guideOpts = guideTitles;
  const otherOpts = jobOptions.filter((j) => !guideTitles.includes(j));

  return (
    <Section
      id="history"
      vehicleId={vehicleId}
      eyebrow="Your record"
      title="Service History"
      summary={entries.length === 0 ? "No records yet" : `${entries.length} ${entries.length === 1 ? "record" : "records"}`}
      chip={<TierBadge tier="premium" />}
      glow="left"
    >
      <p className="mb-5 max-w-2xl text-[0.95rem] leading-relaxed text-slate-400">
        Log what you&apos;ve done, in your own words and miles. It saves to your account and follows you across devices.
        Keys checkout isn&apos;t open yet, so nothing here is locked.
      </p>
      {entries.length === 0 ? (
        <p className={`${PANEL} mb-6 px-5 py-6 text-sm text-slate-400`}>
          No service logged yet — add the first entry below.
        </p>
      ) : (
        <ul className={`${PANEL} mb-6 divide-y divide-white/[0.07] overflow-hidden`}>
          {entries.map((e) => (
            <li key={e.id} className="flex items-start gap-3 px-4 py-4 sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="break-words text-[0.95rem] font-semibold text-slate-100">{e.title}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {e.date} <span className="mx-1 text-slate-600">·</span>
                  <span className="font-mono">{e.mileage.toLocaleString()} mi</span>
                </p>
                {e.notes ? <p className="mt-1.5 break-words text-sm text-slate-400">{e.notes}</p> : null}
              </div>
              <button
                onClick={() => handleDelete(e.id)}
                aria-label={`Delete ${e.title} entry`}
                className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:text-rose-400"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        aria-expanded={formOpen}
        aria-controls="sh-form"
        onClick={() => setFormOpen((v) => !v)}
        className="h-12 w-full rounded-lg bg-orange-500 px-6 text-base font-semibold text-slate-950 hover:bg-orange-400 md:hidden"
      >
        {formOpen ? "Close" : "Log a job"}
      </button>
      <form
        id="sh-form"
        onSubmit={handleAdd}
        className={`${PANEL} mt-4 gap-5 p-5 sm:grid-cols-2 sm:p-6 md:mt-0 ${formOpen ? "grid" : "hidden md:grid"}`}
      >
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-400 sm:col-span-2">
          Log a job
        </h3>
        <div>
          <label htmlFor="sh-date" className="mb-1.5 block text-sm text-slate-300">
            Date
          </label>
          <input id="sh-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="h-12 w-full rounded-lg border border-white/10 bg-black/40 px-4 text-base text-slate-100 placeholder:text-slate-600 focus:border-orange-500 focus:outline-none" />
        </div>
        <div>
          <label htmlFor="sh-mileage" className="mb-1.5 block text-sm text-slate-300">
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
            className="h-12 w-full rounded-lg border border-white/10 bg-black/40 px-4 text-base text-slate-100 placeholder:text-slate-600 focus:border-orange-500 focus:outline-none"
          />
        </div>

        <fieldset className="sm:col-span-2">
          <legend className="mb-1 text-sm text-slate-300">
            Service(s) performed <span className="text-slate-500">(pick as many as apply)</span>
          </legend>
          {guideOpts.length > 0 && (
            <div className="mt-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                From this vehicle&apos;s guides
              </p>
              <div className="flex flex-wrap gap-2">
                {guideOpts.map((opt) => (
                  <label key={opt} className="cursor-pointer">
                    <input type="checkbox" checked={selectedJobs.includes(opt)} onChange={() => toggleJob(opt)} className="peer sr-only" />
                    <span className="flex min-h-11 items-center rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-300 transition hover:border-white/25 peer-checked:border-orange-500/70 peer-checked:bg-orange-500/15 peer-checked:text-orange-100 peer-focus-visible:ring-2 peer-focus-visible:ring-orange-400">
                      {opt}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="mt-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Other common jobs
            </p>
            <div className="flex flex-wrap gap-2">
              {otherOpts.map((opt) => (
                <label key={opt} className="cursor-pointer">
                    <input type="checkbox" checked={selectedJobs.includes(opt)} onChange={() => toggleJob(opt)} className="peer sr-only" />
                    <span className="flex min-h-11 items-center rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-300 transition hover:border-white/25 peer-checked:border-orange-500/70 peer-checked:bg-orange-500/15 peer-checked:text-orange-100 peer-focus-visible:ring-2 peer-focus-visible:ring-orange-400">
                      {opt}
                    </span>
                  </label>
              ))}
              <label key={CUSTOM_LABEL} className="cursor-pointer">
                    <input type="checkbox" checked={customChecked} onChange={(e) => setCustomChecked(e.target.checked)} className="peer sr-only" />
                    <span className="flex min-h-11 items-center rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-300 transition hover:border-white/25 peer-checked:border-orange-500/70 peer-checked:bg-orange-500/15 peer-checked:text-orange-100 peer-focus-visible:ring-2 peer-focus-visible:ring-orange-400">
                      {CUSTOM_LABEL}
                    </span>
                  </label>
            </div>
          </div>
        </fieldset>

        {customChecked && (
          <div className="sm:col-span-2">
            <label htmlFor="sh-custom" className="mb-1.5 block text-sm text-slate-300">
              Describe the additional service
            </label>
            <input
              id="sh-custom"
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="e.g. Replaced serpentine belt"
              required
              className="h-12 w-full rounded-lg border border-white/10 bg-black/40 px-4 text-base text-slate-100 placeholder:text-slate-600 focus:border-orange-500 focus:outline-none"
            />
          </div>
        )}
        <div className="sm:col-span-2">
          <label htmlFor="sh-notes" className="mb-1.5 block text-sm text-slate-300">
            Notes <span className="text-slate-500">(optional)</span>
          </label>
          <input
            id="sh-notes"
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Parts used, shop, anything worth remembering"
            className="h-12 w-full rounded-lg border border-white/10 bg-black/40 px-4 text-base text-slate-100 placeholder:text-slate-600 focus:border-orange-500 focus:outline-none"
          />
        </div>
        <div className="flex flex-col-reverse items-stretch gap-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={printHref ?? `/vehicles/${vehicleId}/service-history/print`}
            target="_blank"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-orange-400 hover:text-orange-300"
          >
            <IconPrinter className="h-4 w-4" />
            Print service record &rarr;
          </Link>
          <button
            type="submit"
            className="h-12 rounded-lg bg-orange-500 px-8 text-base font-semibold text-slate-950 hover:bg-orange-400"
          >
            Add entry
          </button>
        </div>
      </form>
      <p className="mt-3 text-xs text-slate-500">Logging for: {vehicleLabel}</p>
    </Section>
  );
}

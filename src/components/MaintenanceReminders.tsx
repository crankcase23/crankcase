"use client";

import { useState } from "react";
import { useServiceHistory } from "@/lib/serviceHistory";
import { useOdometer } from "@/lib/odometer";
import { computeReminders, ReminderResult, ReminderStatus } from "@/lib/reminders";

const STATUS_STYLES: Record<ReminderStatus, string> = {
  overdue: "bg-rose-500/15 text-rose-300",
  "due-soon": "bg-amber-500/15 text-amber-300",
  ok: "bg-emerald-500/15 text-emerald-300",
  unknown: "bg-slate-800 text-slate-400",
  "never-logged": "bg-slate-800 text-slate-500",
};

const STATUS_ORDER: Record<ReminderStatus, number> = {
  overdue: 0,
  "due-soon": 1,
  unknown: 2,
  ok: 3,
  "never-logged": 4,
};

function statusLabel(r: ReminderResult): string {
  switch (r.status) {
    case "overdue":
      return r.dueMilesRemaining != null
        ? `Overdue by ${Math.abs(r.dueMilesRemaining).toLocaleString()} mi`
        : "Overdue";
    case "due-soon":
      return r.dueMilesRemaining != null
        ? `Due in ${Math.max(r.dueMilesRemaining, 0).toLocaleString()} mi`
        : r.dueDate
          ? `Due ${r.dueDate}`
          : "Due soon";
    case "ok":
      return r.dueMilesRemaining != null
        ? `OK — due in ${r.dueMilesRemaining.toLocaleString()} mi`
        : r.dueDate
          ? `OK — due ${r.dueDate}`
          : "OK";
    case "unknown":
      return r.dueAtMiles ? `Next due around ${r.dueAtMiles.toLocaleString()} mi` : "Logged, no odometer set";
    case "never-logged":
      return "Not logged yet";
  }
}

export default function MaintenanceReminders({ vehicleId }: { vehicleId: string }) {
  const { entries } = useServiceHistory(vehicleId);
  const { odometer, setOdometer } = useOdometer(vehicleId);
  const [odoInput, setOdoInput] = useState("");
  const [showAll, setShowAll] = useState(false);

  const results = computeReminders(entries, odometer)
    .slice()
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  const attention = results.filter((r) => r.status === "overdue" || r.status === "due-soon");
  const rest = results.filter((r) => r.status !== "overdue" && r.status !== "due-soon");
  const visible = showAll ? results : attention;

  function handleOdoSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(odoInput);
    if (Number.isFinite(n) && n > 0) {
      setOdometer(n);
      setOdoInput("");
    }
  }

  return (
    <section className="mt-10">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-slate-100">Maintenance Reminders</h2>
      </div>
      <p className="mb-4 text-sm text-slate-500">
        Rule-of-thumb intervals based on your logged Service History — not a
        substitute for your owner&apos;s manual&apos;s actual schedule.
      </p>

      <form onSubmit={handleOdoSubmit} className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="odo" className="mb-1 block text-xs text-slate-400">
            Current odometer (optional, sharpens the estimates)
          </label>
          <input
            id="odo"
            type="number"
            min={0}
            inputMode="numeric"
            value={odoInput}
            onChange={(e) => setOdoInput(e.target.value)}
            placeholder={odometer != null ? `Saved: ${odometer.toLocaleString()} mi` : "e.g. 118500"}
            className="w-52 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-orange-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:border-orange-500"
        >
          Save
        </button>
      </form>

      {attention.length === 0 && !showAll ? (
        <p className="mb-3 text-sm text-emerald-400">Nothing needs attention right now, based on what&apos;s logged.</p>
      ) : null}

      {visible.length > 0 && (
        <ul className="mb-3 divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800">
          {visible.map((r) => (
            <li key={r.item.key} className="flex items-center justify-between gap-3 bg-slate-900 px-4 py-3 text-sm">
              <span className="text-slate-200">{r.item.label}</span>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[r.status]}`}>
                {statusLabel(r)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {rest.length > 0 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="text-sm font-medium text-orange-400 hover:text-orange-300"
        >
          {showAll ? "Show only what needs attention" : `Show all ${results.length} tracked intervals`}
        </button>
      )}
    </section>
  );
}

"use client";

import { useState } from "react";
import { useServiceHistory } from "@/lib/serviceHistory";
import { useOdometer } from "@/lib/odometer";
import Section from "@/components/app/Section";
import { PANEL } from "@/components/app/Chapter";
import {
  computeReminders,
  type MaintenanceItem,
  type ReminderResult,
  type ReminderStatus,
} from "@/lib/reminders";

const STATUS_STYLES: Record<ReminderStatus, string> = {
  overdue: "border-rose-400/30 bg-rose-500/15 text-rose-200",
  "due-soon": "border-amber-400/30 bg-amber-500/15 text-amber-200",
  ok: "border-emerald-400/25 bg-emerald-500/10 text-emerald-300",
  unknown: "border-white/10 bg-white/5 text-slate-300",
  "never-logged": "border-white/10 bg-white/[0.03] text-slate-400",
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

// `items` comes from the server as maintenanceItemsFor(vehicle), so a vehicle
// whose factory schedule we hold is reminded on the manufacturer's own
// intervals instead of the generic table. Left undefined (a custom garage
// vehicle, which has no catalog entry), computeReminders falls back to the
// generic rule-of-thumb set.
export default function MaintenanceReminders({
  vehicleId,
  items,
  hasFactorySchedule,
}: {
  vehicleId: string;
  items?: MaintenanceItem[];
  hasFactorySchedule?: boolean;
}) {
  const { entries } = useServiceHistory(vehicleId);
  const { odometer, setOdometer } = useOdometer(vehicleId);
  const [odoInput, setOdoInput] = useState("");
  const [showAll, setShowAll] = useState(false);

  const results = computeReminders(entries, odometer, items)
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
    <Section
      id="reminders"
      vehicleId={vehicleId}
      eyebrow="Keep ahead of it"
      title="Maintenance Reminders"
      summary={
        entries.length === 0
          ? "Log a service to start tracking"
          : attention.length === 0
            ? "Nothing due right now"
            : `${attention.length} ${attention.length === 1 ? "item needs" : "items need"} attention`
      }
      attention={attention.length > 0}
      defaultOpen
      glow="left"
      opensOn={["odo", "maintenance"]}
    >
      <p className="mb-5 max-w-2xl text-[0.95rem] leading-relaxed text-slate-400">
        {hasFactorySchedule ? (
          <>
            Tracked against your logged Service History. Where the Factory Service
            Schedule publishes an interval, these use the manufacturer&apos;s own
            figure; the rest are rule-of-thumb.
          </>
        ) : (
          <>
            Rule-of-thumb intervals based on your logged Service History — not a
            substitute for your owner&apos;s manual&apos;s actual schedule.
          </>
        )}
      </p>
      <form
        onSubmit={handleOdoSubmit}
        className={`${PANEL} p-4 sm:p-5`}
      >
        <label htmlFor="odo" className="mb-2 block text-sm text-slate-300">
          Current odometer{" "}
          <span className="text-slate-500">(optional, sharpens the estimates)</span>
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="odo"
            type="number"
            min={0}
            inputMode="numeric"
            value={odoInput}
            onChange={(e) => setOdoInput(e.target.value)}
            placeholder={odometer != null ? `Saved: ${odometer.toLocaleString()} mi` : "e.g. 118500"}
            className="h-12 w-full rounded-lg border border-white/10 bg-black/40 px-4 text-base text-slate-100 placeholder:text-slate-600 focus:border-orange-500 focus:outline-none sm:max-w-xs"
          />
          <button
            type="submit"
            className="h-12 rounded-lg border border-white/15 bg-white/[0.04] px-6 text-sm font-semibold text-slate-100 hover:border-orange-500 sm:w-auto"
          >
            Save
          </button>
        </div>
      </form>

      {attention.length === 0 && !showAll ? (
        <p className="mt-5 flex items-center gap-2.5 text-sm text-slate-300">
          <span aria-hidden className="h-2 w-2 rounded-full bg-emerald-400" />
          Nothing needs attention right now, based on what&apos;s logged.
        </p>
      ) : null}

      {visible.length > 0 && (
        <ul className={`${PANEL} mt-5 divide-y divide-white/[0.07] overflow-hidden`}>
          {visible.map((r) => (
            <li key={r.item.key} className="px-4 py-3.5 sm:px-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <span className="text-[0.95rem] font-medium text-slate-100">{r.item.label}</span>
                <span className={`w-fit shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${STATUS_STYLES[r.status]}`}>
                  {statusLabel(r)}
                </span>
              </div>
              {/* Only set where we are showing a generic figure for a vehicle
                  whose own row we could not source. Saying so beside the
                  number is the whole point - an uncaptioned rule of thumb on a
                  page that otherwise prints factory figures reads as factory. */}
              {r.item.sourceNote ? (
                <p className="mt-2 max-w-prose text-xs leading-relaxed text-amber-300/80">{r.item.sourceNote}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {rest.length > 0 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-orange-400 hover:text-orange-300"
        >
          {showAll ? "Show only what needs attention" : `Show all ${results.length} tracked intervals`}
        </button>
      )}
    </Section>
  );
}

// Maintenance-interval reminders. MAINTENANCE_ITEMS below is the generic
// rule-of-thumb table, used for any vehicle whose real schedule we do not
// hold. Where we DO hold one, maintenanceItemsFor() swaps in the
// manufacturer's own intervals from src/data/service-schedules.ts and drops
// the rows the manufacturer never scheduled — both the vehicle page and the
// reminder-email cron go through it, so neither can contradict the Factory
// Service Schedule the vehicle page prints. Matches
// against Service History entry titles by keyword, so it works whether the
// entry came from a curated guide title or the generic job checklist in
// src/components/ServiceHistory.tsx.

import { ServiceEntry } from "@/types/service";
import { Vehicle } from "@/types/vehicle";
import { getServiceSchedule, IntervalRule } from "@/data/service-schedules";

export interface MaintenanceItem {
  key: string;
  label: string;
  intervalMiles?: number;
  intervalMonths?: number;
  matchKeywords: string[];
  excludeKeywords?: string[];
  /**
   * Set only when the interval above is NOT the manufacturer's. A vehicle
   * whose schedule we hold but whose row for this job we could not source
   * keeps the generic rule-of-thumb figure and carries this line alongside
   * it, so the reader is never shown a number that looks factory when it
   * isn't. Undefined means the figure needs no caveat.
   */
  sourceNote?: string;
}

export const MAINTENANCE_ITEMS: MaintenanceItem[] = [
  {
    key: "oil",
    label: "Engine Oil & Filter Change",
    intervalMiles: 5000,
    intervalMonths: 6,
    matchKeywords: ["oil"],
  },
  {
    key: "tire-rotation",
    label: "Tire Rotation",
    intervalMiles: 6000,
    matchKeywords: ["tire rotation"],
  },
  {
    key: "engine-air-filter",
    label: "Engine Air Filter",
    intervalMiles: 15000,
    matchKeywords: ["air filter"],
    excludeKeywords: ["cabin"],
  },
  {
    key: "cabin-air-filter",
    label: "Cabin Air Filter",
    intervalMiles: 15000,
    intervalMonths: 12,
    matchKeywords: ["cabin air filter", "cabin filter"],
  },
  {
    key: "brake-service",
    label: "Brake Service",
    intervalMiles: 12000,
    matchKeywords: ["brake"],
  },
  {
    key: "coolant-flush",
    label: "Coolant Flush",
    intervalMiles: 30000,
    intervalMonths: 60,
    matchKeywords: ["coolant"],
  },
  {
    key: "transmission-fluid",
    label: "Transmission Fluid Service",
    intervalMiles: 60000,
    matchKeywords: ["transmission fluid"],
  },
  {
    key: "wiper-blades",
    label: "Wiper Blades",
    intervalMonths: 12,
    matchKeywords: ["wiper"],
  },
  {
    key: "battery",
    label: "Battery",
    intervalMonths: 48,
    matchKeywords: ["battery"],
  },
];

export type ReminderStatus = "overdue" | "due-soon" | "ok" | "unknown" | "never-logged";

export interface ReminderResult {
  item: MaintenanceItem;
  status: ReminderStatus;
  lastEntry?: ServiceEntry;
  dueAtMiles?: number;
  dueMilesRemaining?: number;
  dueDate?: string;
}

function matchesItem(item: MaintenanceItem, title: string): boolean {
  const t = title.toLowerCase();
  if (!item.matchKeywords.some((k) => t.includes(k))) return false;
  if (item.excludeKeywords?.some((k) => t.includes(k))) return false;
  return true;
}

/**
 * Which schedule row, if any, governs each generic reminder. Only the rows we
 * have actually sourced appear here - everything else keeps the generic
 * interval, which is a reasonable default for a vehicle whose real schedule we
 * do not hold.
 */
const OVERRIDE_BY_KEY: Record<string, (labelOrJob: string) => boolean> = {
  oil: (k) => k === "oil-change",
  "tire-rotation": (k) => k === "tire-rotation",
  "engine-air-filter": (k) => k === "engine-air-filter",
  "cabin-air-filter": (k) => k === "cabin-air-filter",
  "coolant-flush": (k) => k === "coolant",
  // GM labels this row "...and filter"; Jeep just "Automatic transmission
  // fluid". Matching only GM's wording meant the Jeep row was never found and
  // the generic 60,000 miles was shown as if nobody had ever checked.
  "transmission-fluid": (k) =>
    k === "Automatic transmission fluid and filter" || k === "Automatic transmission fluid",
};

function intervalToItemFields(rule: IntervalRule): Pick<MaintenanceItem, "intervalMiles" | "intervalMonths"> | null {
  switch (rule.kind) {
    case "miles":
      return { intervalMiles: rule.miles, intervalMonths: rule.months };
    case "months":
      return { intervalMonths: rule.months };
    // A monitor-governed job still deserves a nudge, but only at the OUTER
    // limit the manual actually states. Anything tighter would be us inventing
    // a mileage the manufacturer deliberately did not publish.
    case "monitor":
      return rule.outerMiles === undefined && rule.outerMonths === undefined
        ? null
        : { intervalMiles: rule.outerMiles, intervalMonths: rule.outerMonths };
    // No published interval, unknown, or inspect-only: do not nag. Telling
    // someone a service is overdue when the manufacturer never scheduled it is
    // the quick-lube behaviour this product exists to be the opposite of.
    default:
      return null;
  }
}

/**
 * The caveat shown against a generic figure we are keeping for want of a
 * sourced one. Short on purpose - this sits under a row on a phone. The
 * schedule row's own note carries the detail when it has one.
 */
function unsourcedNote(make: string, rowNote?: string): string {
  const head = `${make} publishes no interval for this that we could source, so this is a rule of thumb, not a factory figure.`;
  return rowNote ? `${head} ${rowNote}` : head;
}

/**
 * The reminder set for one vehicle: the generic table, with real factory
 * intervals substituted in wherever we hold that vehicle's schedule, rows
 * dropped entirely where the manufacturer publishes no interval at all, and
 * the generic figure kept but plainly captioned where we simply could not
 * source that vehicle's row.
 */
export function maintenanceItemsFor(vehicle: Vehicle | null | undefined): MaintenanceItem[] {
  const schedule = vehicle ? getServiceSchedule(vehicle) : null;
  if (!schedule) return MAINTENANCE_ITEMS;

  const out: MaintenanceItem[] = [];
  for (const item of MAINTENANCE_ITEMS) {
    const match = OVERRIDE_BY_KEY[item.key];
    if (!match) {
      out.push(item);
      continue;
    }
    const row = schedule.items.find((r) => match(r.jobType ?? r.label));
    if (!row) {
      out.push(item);
      continue;
    }
    // "unknown" is not "the manufacturer says nothing" - it is "we could not
    // read it". Dropping the reminder would silently remove a service people
    // genuinely ask about, so the generic figure stays and says what it is.
    // "none" is different: that IS a sourced fact, and it keeps dropping the
    // row rather than nagging about a service the manufacturer never
    // scheduled.
    if (row.normal.kind === "unknown") {
      out.push({ ...item, sourceNote: unsourcedNote(vehicle?.make ?? "The manufacturer", row.note) });
      continue;
    }
    const fields = intervalToItemFields(row.normal);
    if (!fields) continue; // deliberately no reminder for this job on this vehicle
    out.push({
      key: item.key,
      label: item.label,
      matchKeywords: item.matchKeywords,
      excludeKeywords: item.excludeKeywords,
      intervalMiles: fields.intervalMiles,
      intervalMonths: fields.intervalMonths,
    });
  }
  return out;
}

export function computeReminders(
  entries: ServiceEntry[],
  odometer: number | null,
  items: MaintenanceItem[] = MAINTENANCE_ITEMS,
): ReminderResult[] {
  return items.map((item) => {
    const matches = entries.filter((e) => matchesItem(item, e.title));
    if (matches.length === 0) {
      return { item, status: "never-logged" as const };
    }
    const last = matches.reduce((a, b) => (a.date >= b.date ? a : b));

    let dueAtMiles: number | undefined;
    let dueMilesRemaining: number | undefined;
    let dueDate: string | undefined;

    if (item.intervalMiles) {
      dueAtMiles = last.mileage + item.intervalMiles;
      if (odometer != null) dueMilesRemaining = dueAtMiles - odometer;
    }
    if (item.intervalMonths) {
      const d = new Date(`${last.date}T00:00:00`);
      d.setMonth(d.getMonth() + item.intervalMonths);
      dueDate = d.toISOString().slice(0, 10);
    }

    let status: ReminderStatus = "unknown";
    if (dueMilesRemaining != null) {
      status = dueMilesRemaining <= 0 ? "overdue" : dueMilesRemaining <= 500 ? "due-soon" : "ok";
    } else if (dueDate) {
      const daysRemaining = (new Date(`${dueDate}T00:00:00`).getTime() - Date.now()) / 86_400_000;
      status = daysRemaining <= 0 ? "overdue" : daysRemaining <= 30 ? "due-soon" : "ok";
    }

    return { item, status, lastEntry: last, dueAtMiles, dueMilesRemaining, dueDate };
  });
}

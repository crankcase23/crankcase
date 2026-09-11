// Generic maintenance-interval reminders. Deliberately not vehicle-specific
// (real per-vehicle intervals live in a factory service manual) — these are
// common rule-of-thumb intervals so a Service History log can tell you
// roughly when something's due, on any vehicle, guides or not. Matches
// against Service History entry titles by keyword, so it works whether the
// entry came from a curated guide title or the generic job checklist in
// src/components/ServiceHistory.tsx.

import { ServiceEntry } from "@/types/service";

export interface MaintenanceItem {
  key: string;
  label: string;
  intervalMiles?: number;
  intervalMonths?: number;
  matchKeywords: string[];
  excludeKeywords?: string[];
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

export function computeReminders(entries: ServiceEntry[], odometer: number | null): ReminderResult[] {
  return MAINTENANCE_ITEMS.map((item) => {
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

import {
  describeInterval,
  type IntervalRule,
  type ServiceSchedule,
} from "@/data/service-schedules";

// Pure helpers for the "Next manufacturer service" tile. Reads ONLY the real
// factory schedule in src/data/service-schedules.ts; it adds no intervals of its
// own. Plain serializable data so a server component can compute it and a
// client component can pick the stop that matches the owner's mileage.

export interface ServiceStop {
  miles: number;
  /** Jobs the manufacturer puts on this mileage, in schedule order. */
  labels: string[];
}

export interface NextServiceData {
  stops: ServiceStop[];
  /** Jobs the manufacturer governs by something other than mileage, in words. */
  notes: string[];
}

const dueAt = (rule: IntervalRule, miles: number) => rule.kind === "miles" && miles % rule.miles === 0;

export function buildNextServiceData(schedule: ServiceSchedule): NextServiceData {
  const stops: ServiceStop[] = [];
  for (let m = schedule.gridStep; m <= schedule.gridTo; m += schedule.gridStep) {
    const labels = schedule.items.filter((i) => dueAt(i.normal, m)).map((i) => i.label);
    if (labels.length > 0) stops.push({ miles: m, labels });
  }
  // A monitor-governed job (engine oil on these vehicles) never gets a mileage.
  // Say so in the manufacturer's words so the tile cannot be read as "no oil change".
  const notes = schedule.items
    .filter((i) => i.normal.kind === "monitor")
    .map((i) => `${i.label}: ${describeInterval(i.normal)}`);
  return { stops, notes };
}

/** First stop at or beyond the current mileage, or null when past the last published one. */
export function nextStop(stops: ServiceStop[], mileage: number): ServiceStop | null {
  return stops.find((s) => s.miles >= mileage) ?? null;
}

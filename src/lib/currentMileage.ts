"use client";

import { useOdometer } from "@/lib/odometer";
import { useServiceHistory } from "@/lib/serviceHistory";

// The mileage Vehicle Home works from: the saved odometer reading when there is
// one, otherwise the highest mileage on a logged service entry. Read-only; it
// writes nothing and adds no storage.
export function useCurrentMileage(vehicleId: string): {
  miles: number | null;
  source: "odometer" | "service" | null;
} {
  const { odometer } = useOdometer(vehicleId);
  const { entries } = useServiceHistory(vehicleId);
  if (odometer != null) return { miles: odometer, source: "odometer" };
  const fromLog = entries.reduce<number | null>((m, e) => (m == null || e.mileage > m ? e.mileage : m), null);
  return fromLog != null ? { miles: fromLog, source: "service" } : { miles: null, source: null };
}

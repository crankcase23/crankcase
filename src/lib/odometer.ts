"use client";

import { useCallback } from "react";
import useSWR, { mutate as globalMutate } from "swr";

// Server-backed odometer reading, synced across devices via
// /api/garage/[id]/odometer. Same vehicleId-or-custom-entry-id key as
// useServiceHistory. Call signature unchanged from the localStorage
// version except setOdometer is now async (callers don't need to await it
// unless they want to know it saved — see MaintenanceReminders).

const keyFor = (vehicleId: string) => `/api/garage/${encodeURIComponent(vehicleId)}/odometer`;

async function fetcher(url: string): Promise<number | null> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not load the odometer reading.");
  const data = await res.json();
  return data.odometer as number | null;
}

export function useOdometer(vehicleId: string) {
  const key = keyFor(vehicleId);
  const { data, error, isLoading } = useSWR<number | null>(key, fetcher);
  const odometer = data ?? null;

  const setOdometer = useCallback(
    async (next: number | null) => {
      await globalMutate(key, next, { revalidate: false });
      const res = await fetch(key, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: next }),
      });
      if (!res.ok) throw new Error("Could not save the odometer reading.");
    },
    [key],
  );

  return { odometer, setOdometer, isLoading, error };
}

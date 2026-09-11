"use client";

import { useCallback } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { ServiceEntry } from "@/types/service";

// Server-backed service history, synced across devices via
// /api/garage/[id]/service (see src/lib/serviceEntriesDb.ts). `vehicleId`
// here is the same overloaded id the old localStorage version used — either
// a catalog vehicle's static id or a custom garage entry's id — the API
// resolves either into the right garage_entries row (auto-provisioning a
// catalog row on first log, same as the old "no accounts, just a
// localStorage key" behavior). Call signature is unchanged from the
// localStorage version except addEntry/deleteEntry are now async.

const keyFor = (vehicleId: string) => `/api/garage/${encodeURIComponent(vehicleId)}/service`;

async function fetcher(url: string): Promise<ServiceEntry[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not load service history.");
  const data = await res.json();
  return data.entries as ServiceEntry[];
}

export function useServiceHistory(vehicleId: string) {
  const key = keyFor(vehicleId);
  const { data, error, isLoading } = useSWR<ServiceEntry[]>(key, fetcher);
  const entries = data ?? [];

  const addEntry = useCallback(
    async (entry: Omit<ServiceEntry, "id" | "loggedAt">) => {
      const res = await fetch(key, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
      if (!res.ok) throw new Error("Could not save that service entry.");
      const { entry: created } = await res.json();
      await globalMutate(
        key,
        (current: ServiceEntry[] = []) =>
          [...current, created].sort((a, b) => (a.date < b.date ? 1 : -1)),
        { revalidate: false },
      );
    },
    [key],
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      await globalMutate(key, (current: ServiceEntry[] = []) => current.filter((e) => e.id !== id), {
        revalidate: false,
      });
      const res = await fetch(`/api/garage/${encodeURIComponent(vehicleId)}/service/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Could not delete that service entry.");
    },
    [key, vehicleId],
  );

  return { entries, addEntry, deleteEntry, isLoading, error };
}

"use client";

import { useCallback, useMemo } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { GarageEntry, CustomVehicleInfo } from "@/types/garage";

const EMPTY_ENTRIES: GarageEntry[] = [];

// Server-backed garage — the list of vehicles a user has added, synced
// across every device they log into via /api/garage (see src/db/schema.ts
// and src/lib/garageEntries.ts). Replaces the old localStorage +
// useSyncExternalStore version; call signatures are unchanged so
// GarageClient, AddVehicleClient, CustomVehicleClient, and DecodeClient
// didn't need to change how they call this hook, only that adding a
// vehicle is now async.

const KEY = "/api/garage";

async function fetcher(url: string): Promise<GarageEntry[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not load your garage.");
  const data = await res.json();
  return data.entries as GarageEntry[];
}

export function useGarage() {
  const { data, error, isLoading } = useSWR<GarageEntry[]>(KEY, fetcher);
  const entries = useMemo(() => data ?? EMPTY_ENTRIES, [data]);

  const addCatalogVehicle = useCallback(async (vehicleId: string) => {
    const res = await fetch("/api/garage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "catalog", vehicleId }),
    });
    if (!res.ok) throw new Error("Could not add that vehicle to your garage.");
    const { entry } = await res.json();
    await globalMutate(KEY, (current: GarageEntry[] = []) =>
      current.some((e) => e.id === entry.id) ? current : [...current, entry],
    { revalidate: false });
    return entry.id as string;
  }, []);

  const addCustomVehicle = useCallback(async (info: CustomVehicleInfo): Promise<string> => {
    const res = await fetch("/api/garage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "custom", custom: info }),
    });
    if (!res.ok) throw new Error("Could not add that vehicle to your garage.");
    const { entry } = await res.json();
    await globalMutate(KEY, (current: GarageEntry[] = []) => [...current, entry], { revalidate: false });
    return entry.id as string;
  }, []);

  const removeEntry = useCallback(async (id: string) => {
    await globalMutate(KEY, (current: GarageEntry[] = []) => current.filter((e) => e.id !== id), {
      revalidate: false,
    });
    const res = await fetch(`/api/garage/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Could not remove that vehicle.");
  }, []);

  const findCustom = useCallback(
    (id: string) => entries.find((e) => e.kind === "custom" && e.id === id),
    [entries],
  );

  return { entries, addCatalogVehicle, addCustomVehicle, removeEntry, findCustom, isLoading, error };
}

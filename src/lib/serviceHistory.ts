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

/** The server's own message when it sent one (a 400 says exactly what is wrong), else a plain fallback. */
async function messageFrom(res: Response, fallback: string): Promise<string> {
  if (res.status === 401) return "You were signed out. Sign in again, then try again.";
  try {
    const j = await res.json();
    if (res.status < 500 && typeof j?.error === "string" && j.error) return j.error;
  } catch {
    /* not JSON: use the fallback */
  }
  return fallback;
}

export function useServiceHistory(vehicleId: string) {
  const key = keyFor(vehicleId);
  const { data, error, isLoading } = useSWR<ServiceEntry[]>(key, fetcher);
  const entries = data ?? [];

  const addEntry = useCallback(
    async (entry: Omit<ServiceEntry, "id" | "loggedAt">) => {
      // A network failure (fetch itself rejecting) and a non-2xx are both "not saved": the caller keeps the form as it was.
      let res: Response;
      try {
        res = await fetch(key, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry),
        });
      } catch {
        throw new Error("Couldn't reach the server, so nothing was saved. Check your connection and try again.");
      }
      if (!res.ok) throw new Error(await messageFrom(res, "Couldn't save that entry. Nothing was lost; try again."));
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
      // Server first, screen second. The row leaves the list only once the server has confirmed the delete, so a failed
      // delete can never look like it worked (the old optimistic remove did, until the next reload brought the row back).
      let res: Response;
      try {
        res = await fetch(`/api/garage/${encodeURIComponent(vehicleId)}/service/${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
      } catch {
        throw new Error("Couldn't reach the server, so nothing was deleted. Check your connection and try again.");
      }
      if (!res.ok) throw new Error(await messageFrom(res, "Couldn't delete that entry. It is still in your history; try again."));
      await globalMutate(key, (current: ServiceEntry[] = []) => current.filter((e) => e.id !== id), {
        revalidate: false,
      });
    },
    [key, vehicleId],
  );

  return { entries, addEntry, deleteEntry, isLoading, error };
}

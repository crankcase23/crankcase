"use client";

import { useCallback, useMemo } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { GarageEntry, CustomVehicleInfo } from "@/types/garage";
import { EMPTY_CONFIG, normalizeConfig, type AxisChoice, type DrivetrainChoice, type TransmissionChoice, type VehicleConfig } from "@/lib/vehicleConfig";

/** What the customer confirmed on the Confirm Your Ride screen. Both axes are required: "unknown" is the Not sure answer. */
export interface ConfigChoice {
  transmission: TransmissionChoice;
  drivetrain: DrivetrainChoice;
}

/** The outcome of an add, so the screen can tell the customer the truth about a vehicle that was already theirs. */
export interface AddOutcome {
  id: string;
  created: boolean;
  configKept: boolean;
}

const EMPTY_ENTRIES: GarageEntry[] = [];

// Server-backed garage -- the list of vehicles a user has added, synced
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

// vin is optional and set only when this catalog match came from a VIN
// decode (DecodeClient / AddVehicleClient's VIN path) -- added 2026-09-19
// alongside the fix for VINs silently matching the wrong cab/trim. It's
// never asked for from the manual dropdown "add a vehicle" flow, which has
// no VIN to give.
const addCatalogVehicle = useCallback(async (vehicleId: string, vin: string, config: ConfigChoice): Promise<AddOutcome> => {
  const res = await fetch("/api/garage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "catalog", vehicleId, vin, config }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Could not add that vehicle to your garage.");
  const { entry, created, configKept } = await res.json();
  await globalMutate(KEY, (current: GarageEntry[] = []) =>
    current.some((e) => e.id === entry.id) ? current.map((e) => (e.id === entry.id ? entry : e)) : [...current, entry],
                     { revalidate: false });
  return { id: entry.id as string, created: Boolean(created), configKept: Boolean(configKept) };
}, []);

const addCustomVehicle = useCallback(async (info: CustomVehicleInfo & { vin: string }, config: ConfigChoice): Promise<AddOutcome> => {
  const res = await fetch("/api/garage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "custom", custom: info, config }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Could not add that vehicle to your garage.");
  const { entry, created, configKept } = await res.json();
  await globalMutate(KEY, (current: GarageEntry[] = []) =>
    current.some((e) => e.id === entry.id) ? current.map((e) => (e.id === entry.id ? entry : e)) : [...current, entry],
    { revalidate: false });
  return { id: entry.id as string, created: Boolean(created), configKept: Boolean(configKept) };
}, []);

// NHTSA-outage fallback (off unless the server says so): add by typed details. The SERVER checks NHTSA itself and decides
// whether this becomes an UNVERIFIED vehicle, a VERIFIED one, or a refusal; the message of a refusal is shown as is.
const addUnverifiedVehicle = useCallback(async (info: { vin: string; year: string; make: string; model: string; trim?: string; engine?: string }, config: ConfigChoice): Promise<AddOutcome> => {
  const res = await fetch("/api/garage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "custom-unverified", custom: info, config }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Could not add that vehicle to your garage.");
  const { entry, created, configKept } = await res.json();
  await globalMutate(KEY, (current: GarageEntry[] = []) =>
    current.some((e) => e.id === entry.id) ? current.map((e) => (e.id === entry.id ? entry : e)) : [...current, entry],
    { revalidate: false });
  return { id: entry.id as string, created: Boolean(created), configKept: Boolean(configKept) };
}, []);

// Re-check an unverified vehicle (server asks NHTSA). Resolves with the verified entry, or throws the server's plain message.
const verifyVehicle = useCallback(async (id: string) => {
  const res = await fetch(`/api/garage/${encodeURIComponent(id)}/verify`, { method: "POST" });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? "Could not check that vehicle.");
  await globalMutate(KEY, (current: GarageEntry[] = []) => current.map((e) => (e.id === body.entry.id ? body.entry : e)), { revalidate: false });
  return body.entry as GarageEntry;
}, []);

// Correct the typed details of an unverified vehicle. The VIN is never editable.
const editUnverifiedDetails = useCallback(async (id: string, details: { year: string; make: string; model: string; trim?: string; engine?: string }) => {
  const res = await fetch(`/api/garage/${encodeURIComponent(id)}/details`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(details),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? "Could not save those details.");
  await globalMutate(KEY, (current: GarageEntry[] = []) => current.map((e) => (e.id === body.entry.id ? body.entry : e)), { revalidate: false });
  return body.entry as GarageEntry;
}, []);

// VIN completion for an older record that has none. Only ever attaches a VIN to this customer's own entry.
const completeVin = useCallback(async (id: string, vin: string) => {
  const res = await fetch(`/api/garage/${encodeURIComponent(id)}/vin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vin }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Could not save that VIN.");
  const { entry } = await res.json();
  await globalMutate(KEY, (current: GarageEntry[] = []) => current.map((e) => (e.id === entry.id ? entry : e)), { revalidate: false });
  return entry as GarageEntry;
}, []);

// Edit Configuration. Only the axes given change; the server touches nothing else on the vehicle.
const updateConfig = useCallback(async (id: string, change: { transmission?: AxisChoice; drivetrain?: AxisChoice }) => {
  const res = await fetch(`/api/garage/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(change),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Could not save your configuration.");
  const { entry } = await res.json();
  await globalMutate(KEY, (current: GarageEntry[] = []) => current.map((e) => (e.id === entry.id ? entry : e)), { revalidate: false });
  return entry as GarageEntry;
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

  return { entries, addCatalogVehicle, addCustomVehicle, addUnverifiedVehicle, verifyVehicle, editUnverifiedDetails, completeVin, updateConfig, removeEntry, findCustom, isLoading, error };
}


/**
 * The saved configuration of one of the customer's vehicles (a catalog vehicleId or a custom entry's id).
 *   config   null until loaded, and null when it cannot be known (signed out, or the vehicle is not in this garage):
 *            guides then treat every axis as unconfirmed and restrict build-dependent content.
 *   ready    false only while the first load is in flight.
 */
export function useVehicleConfig(id: string): { config: VehicleConfig | null; entry: GarageEntry | undefined; ready: boolean } {
  const { entries, isLoading, error } = useGarage();
  const entry = useMemo(() => entries.find((e) => e.id === id), [entries, id]);
  const config = useMemo(() => (entry ? normalizeConfig(entry.config ?? EMPTY_CONFIG) : null), [entry]);
  return { config, entry, ready: !isLoading || Boolean(error) };
}

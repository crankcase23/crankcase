// Thin data-access layer. Pages/components should import from here rather
// than from src/data/*.ts directly — swapping this file's internals for a
// real database or an external API later won't require touching any UI code.

import { vehicles, getVehicleById } from "@/data/vehicles";
import { repairs, getRepairsForVehicle, getRepairById } from "@/data/repairs";
import { Vehicle, RepairGuide } from "@/types/vehicle";

export function listVehicles(): Vehicle[] {
return vehicles;
}

export function findVehicle(id: string): Vehicle | undefined {
return getVehicleById(id);
}

export function listRepairsForVehicle(vehicleId: string): RepairGuide[] {
return getRepairsForVehicle(vehicleId);
}

export function findRepair(id: string): RepairGuide | undefined {
return getRepairById(id);
}

export function allRepairs(): RepairGuide[] {
return repairs;
}

export function searchVehicles(query: string): Vehicle[] {
const q = query.trim().toLowerCase();
if (!q) return vehicles;
return vehicles.filter((v) =>
`${v.year} ${v.make} ${v.model} ${v.trim ?? ""} ${v.engine}`.toLowerCase().includes(q)
);
}

// Added 2026-09-19 as part of the VIN-decode-led "Add a vehicle" redesign
// (see claude/crankcase-v1-build-notes.md) — a decoded VIN previously always
// became a bare "custom" garage entry with no specs/torque/guides, even when
// the decoded year/make/model matched a vehicle we already have full curated
// data for. This checks the decode result against the real catalog first so
// a match routes to the real vehicle page instead of a dead-end custom entry.
//
// Matching is intentionally loose on model (substring both directions) since
// NHTSA vPIC's "Model" field doesn't always match our own model string
// exactly (e.g. "Silverado 1500" vs a decode that just says "Silverado"),
// and exact on year + make since those rarely disagree in a real decode.
// Can return more than one match if the catalog ever has two trims/engines
// for the same year+make+model — the UI should let the person pick.
export function matchCatalogVehicles(decoded: {
year?: string;
make?: string;
model?: string;
}): Vehicle[] {
const year = decoded.year?.trim();
const make = decoded.make?.trim().toLowerCase();
const model = decoded.model?.trim().toLowerCase();
if (!year || !make || !model) return [];

return vehicles.filter((v) => {
const yearMatch = String(v.year) === year;
const makeMatch = v.make.trim().toLowerCase() === make;
const catalogModel = v.model.trim().toLowerCase();
const modelMatch = catalogModel.includes(model) || model.includes(catalogModel);
return yearMatch && makeMatch && modelMatch;
});
}

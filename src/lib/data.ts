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

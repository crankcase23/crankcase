// A user's own garage -- which vehicles they've added. No accounts yet, so
// this lives in the browser's localStorage (see src/lib/garage.ts), scoped
// per browser like Service History. "catalog" entries point at a vehicle we
// have full curated data for (src/data/vehicles.ts, via Vehicle.id);
// "custom" entries are vehicles a user added that we don't have guides for
// yet (manual entry or a VIN decode) -- they still get Service History and
// maintenance reminders, just no specs/torque/guides until we add real data
// for that vehicle.

import type { VehicleConfig } from "@/lib/vehicleConfig";

export interface CustomVehicleInfo {
  vin?: string;
  year?: string;
  make?: string;
  model?: string;
  trim?: string;
  engine?: string;
}

export type GarageEntry =
  // vin here is set only when this catalog match came from a VIN decode
// (added 2026-09-19 alongside the VIN cab/trim-mismatch fix) -- lets a
// future audit see which real-world VIN a catalog match was derived from,
// which the app previously threw away entirely.
//
// config is the customer's confirmed transmission and drivetrain (see src/lib/vehicleConfig.ts). Always present:
// an entry that predates the feature, or one never confirmed, simply has null axes ("never asked").
| { id: string; kind: "catalog"; addedAt: string; vin?: string; config: VehicleConfig }
// vinStatus (migrations/2026-10-12-vin-status.sql): "unverified" = typed by the customer while NHTSA was down, not yet checked;
// "verified" = the server checked the VIN at NHTSA and the identity matched; absent/null = a record from before this existed.
| { id: string; kind: "custom"; addedAt: string; custom: CustomVehicleInfo; config: VehicleConfig; vinStatus?: "verified" | "unverified" | null };

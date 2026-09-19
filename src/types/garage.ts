// A user's own garage -- which vehicles they've added. No accounts yet, so
// this lives in the browser's localStorage (see src/lib/garage.ts), scoped
// per browser like Service History. "catalog" entries point at a vehicle we
// have full curated data for (src/data/vehicles.ts, via Vehicle.id);
// "custom" entries are vehicles a user added that we don't have guides for
// yet (manual entry or a VIN decode) -- they still get Service History and
// maintenance reminders, just no specs/torque/guides until we add real data
// for that vehicle.

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
| { id: string; kind: "catalog"; addedAt: string; vin?: string }
| { id: string; kind: "custom"; addedAt: string; custom: CustomVehicleInfo };

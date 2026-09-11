// A user's own garage — which vehicles they've added. No accounts yet, so
// this lives in the browser's localStorage (see src/lib/garage.ts), scoped
// per browser like Service History. "catalog" entries point at a vehicle we
// have full curated data for (src/data/vehicles.ts, via Vehicle.id);
// "custom" entries are vehicles a user added that we don't have guides for
// yet (manual entry or a VIN decode) — they still get Service History and
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
  | { id: string; kind: "catalog"; addedAt: string }
  | { id: string; kind: "custom"; addedAt: string; custom: CustomVehicleInfo };

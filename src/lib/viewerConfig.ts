import { auth } from "@/auth";
import { listGarageEntries } from "@/lib/garageEntries";
import type { VehicleConfig } from "@/lib/vehicleConfig";

// Server side: the saved configuration of one of THIS viewer's vehicles, for pages that resolve guides, specs and fluids
// against it. Catalog pages are shared by every customer, so the answer has to come from the viewer's own garage entry,
// never from the catalog. Returns null when it cannot be known (signed out, or the vehicle is not in this garage);
// callers treat null as "nothing confirmed", which restricts build-dependent content instead of guessing.
export async function getViewerVehicle(vehicleId: string): Promise<{ config: VehicleConfig | null; vin?: string; inGarage: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { config: null, inGarage: false };
  const entries = await listGarageEntries(session.user.id);
  const entry = entries.find((e) => e.kind === "catalog" && e.id === vehicleId);
  if (!entry || entry.kind !== "catalog") return { config: null, inGarage: false };
  return { config: entry.config, vin: entry.vin, inGarage: true };
}

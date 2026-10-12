import { auth } from "@/auth";
import { listGarageEntries } from "@/lib/garageEntries";
import { catalogIdOf } from "@/lib/garageId";
import type { VehicleConfig } from "@/lib/vehicleConfig";

/** One of the viewer's cars of a model, enough to let them pick the right one. */
export interface CarChoice {
  garageId: string;
  vin?: string;
  addedAt: string;
}

export interface ViewerVehicle {
  config: VehicleConfig | null;
  vin?: string;
  inGarage: boolean;
  /** The permanent garage id of this viewer's car, when the page's id names (or resolves to) one of their cars. */
  garageId?: string;
  /** `id` was a legacy bare catalog id and the viewer owns exactly one car of that model: callers redirect to this id. */
  redirectTo?: string;
  /** `id` was a legacy bare catalog id and the viewer owns SEVERAL cars of that model: callers must ask which one. */
  choose?: CarChoice[];
}

// Server side: the saved configuration of one of THIS viewer's vehicles, for pages that resolve guides, specs and fluids
// against it. Catalog pages are shared by every customer, so the answer has to come from the viewer's own garage entry,
// never from the catalog. Returns null config when it cannot be known (signed out, or the vehicle is not in this garage);
// callers treat null as "nothing confirmed", which restricts build-dependent content instead of guessing.
//
// A bare catalog id (an old link or bookmark) is never guessed: one car of that model -> redirect to its permanent id;
// several -> `choose`, with no config, so nothing is resolved against the wrong car's build.
export async function getViewerVehicle(vehicleId: string): Promise<ViewerVehicle> {
  const session = await auth();
  if (!session?.user?.id) return { config: null, inGarage: false };
  const entries = (await listGarageEntries(session.user.id)).filter((e) => e.kind === "catalog");
  const exact = entries.find((e) => e.id === vehicleId);
  if (exact && exact.kind === "catalog") return { config: exact.config, vin: exact.vin, inGarage: true, garageId: exact.id };
  if (catalogIdOf(vehicleId) !== vehicleId) return { config: null, inGarage: false }; // a permanent id that is not this viewer's
  const ofModel = entries.filter((e) => catalogIdOf(e.id) === vehicleId);
  if (ofModel.length === 1) return { config: null, inGarage: false, redirectTo: ofModel[0].id };
  if (ofModel.length > 1) {
    return {
      config: null,
      inGarage: false,
      choose: ofModel.map((e) => ({ garageId: e.id, vin: e.kind === "catalog" ? e.vin : undefined, addedAt: e.addedAt })),
    };
  }
  return { config: null, inGarage: false };
}

// Thin data-access layer. Pages/components should import from here rather
// than from src/data/*.ts directly -- swapping this file's internals for a
// real database or an external API later won't require touching any UI code.

import { vehicles, getVehicleById } from "@/data/vehicles";
import {
  resolvedRepairs,
  getRepairsForVehicle,
  getRepairById,
  getPendingFitment,
} from "@/data/repairs";
import { Vehicle, ResolvedGuide } from "@/types/vehicle";
import { DecodedVin } from "@/lib/vpic";

export function listVehicles(): Vehicle[] {
  return vehicles;
}

export function findVehicle(id: string): Vehicle | undefined {
  return getVehicleById(id);
}

export function listRepairsForVehicle(vehicleId: string): ResolvedGuide[] {
  return getRepairsForVehicle(vehicleId);
}

export function findRepair(id: string): ResolvedGuide | undefined {
  return getRepairById(id);
}

// The RESOLVED set, not the authored one. A shared guide is authored once and
// appears here once per vehicle it was actually verified for, which is what
// makes the admin counts reflect what a reader can really open.
export function allRepairs(): ResolvedGuide[] {
  return resolvedRepairs;
}

// Shared procedures that fit a vehicle but are still waiting on its numbers.
export { getPendingFitment };

export function searchVehicles(query: string): Vehicle[] {
  const q = query.trim().toLowerCase();
  if (!q) return vehicles;
  return vehicles.filter((v) =>
    `${v.year} ${v.make} ${v.model} ${v.trim ?? ""} ${v.engine}`.toLowerCase().includes(q)
                         );
}

// Pulls a displacement (in liters) and a cylinder count out of a catalog
// vehicle's free-text engine string, e.g. "5.3L EcoTec3 V8 (L83)" ->
// { displacement: 5.3, cylinders: 8 }. Best-effort only -- returns undefined
// for whatever it can't parse, which callers treat as "unknown," never as
// a mismatch.
function parseEngineSpec(engine: string): { displacement?: number; cylinders?: number } {
  const displacementMatch = engine.match(/(\d+(?:\.\d+)?)\s*L\b/i);
  const displacement = displacementMatch ? Number(displacementMatch[1]) : undefined;
  const cylMatch = engine.match(/\b[VIH](\d{1,2})\b/i);
  const cylinders = cylMatch ? Number(cylMatch[1]) : undefined;
  return { displacement, cylinders };
}

// Added 2026-09-19 as part of the VIN-decode-led "Add a vehicle" redesign
// (see claude/crankcase-v1-build-notes.md) -- a decoded VIN previously always
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
// for the same year+make+model -- the UI should let the person pick.
//
// NOTE (2026-09-19): also requires the decoded engine to match, when the
// decode has engine data. This closed a real bug: once the catalog held a
// second 2018 Chevrolet Silverado 1500 (a different cab/trim than an
// earlier one), ANY 2018 Silverado VIN -- any cab, any trim, any engine --
// silently matched that one catalog vehicle and the app told the user
// "we have full specs for this exact vehicle" even when it wasn't. A
// Regular Cab Work Truck VIN got shown as a Crew Cab LT. Engine is what
// actually determines the fluid/torque data (see the "Why engine and not
// just trim" note in AddVehicleClient.tsx), so requiring it to match closes
// the dangerous half of this bug -- a VIN can no longer be routed to a
// different engine's data. See catalogMatchLooksExact() below for the
// cosmetic half (trim/cab display honesty).
export function matchCatalogVehicles(decoded: {
  year?: string;
  make?: string;
  model?: string;
  displacementL?: string;
  engineCylinders?: string;
}): Vehicle[] {
  const year = decoded.year?.trim();
  const make = decoded.make?.trim().toLowerCase();
  const model = decoded.model?.trim().toLowerCase();
  if (!year || !make || !model) return [];

const decodedDisplacement = decoded.displacementL ? Number(decoded.displacementL) : undefined;
  const decodedCylinders = decoded.engineCylinders ? Number(decoded.engineCylinders) : undefined;

return vehicles.filter((v) => {
  const yearMatch = String(v.year) === year;
  const makeMatch = v.make.trim().toLowerCase() === make;
  const catalogModel = v.model.trim().toLowerCase();
  const modelMatch = catalogModel.includes(model) || model.includes(catalogModel);
  if (!yearMatch || !makeMatch || !modelMatch) return false;

                       if (decodedDisplacement !== undefined || decodedCylinders !== undefined) {
                         const parsed = parseEngineSpec(v.engine);
                         if (
                           decodedDisplacement !== undefined &&
                           parsed.displacement !== undefined &&
                           Math.abs(parsed.displacement - decodedDisplacement) > 0.15
                           ) {
                           return false;
                         }
                         if (
                           decodedCylinders !== undefined &&
                           parsed.cylinders !== undefined &&
                           parsed.cylinders !== decodedCylinders
                           ) {
                           return false;
                         }
                       }
  return true;
});
}

// Added 2026-09-19 alongside the engine-matching fix above. Even when the
// engine genuinely matches, the catalog vehicle's stored trim/cab (e.g.
// "LT Crew Cab") is not something the VIN confirmed -- it's just what we
// happen to have modeled for that year/make/model/engine. This tells the
// UI whether it's honest to keep saying "this exact vehicle," or whether it
// should show the decoded trim/cab alongside a caveat instead. Biased
// toward the caveat: a false "looks different" costs nothing, a false
// "looks the same" is the bug this whole fix exists to close.
export function catalogMatchLooksExact(decoded: DecodedVin, vehicle: Vehicle): boolean {
  const catalogTrim = (vehicle.trim ?? "").toLowerCase();

  // One exception to the bias above. An entry with NO trim is deliberately not
  // making a trim claim: it covers every cab and trim built with that engine and
  // drivetrain, so there is nothing here for a VIN to contradict. Without this,
  // the 2018 Silverado - which covers all of them - would tell a Regular Cab
  // owner their own truck might not be an exact match.
  //
  // Trim carries a trim NAME or nothing. It is not the place for a sentence
  // about coverage breadth; that belongs in the spec table where a reader looks
  // for detail. See claude/silverado-catalog-collapse-2026-09-19.md.
  if (!catalogTrim) return true;

  if (decoded.bodyCabType) {
    const cab = decoded.bodyCabType.toLowerCase();
    if (cab && !catalogTrim.includes(cab)) return false;
  }
  if (decoded.trim) {
    const decodedTrimTokens = decoded.trim
    .toLowerCase()
    .split(/[/,]/)
    .map((t) => t.trim())
    .filter(Boolean);
    const anyTokenMatches = decodedTrimTokens.some((t) => catalogTrim.includes(t));
    if (decodedTrimTokens.length > 0 && !anyTokenMatches) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// "Unverified" = what the build notes call a skeleton: a catalog entry whose
// numbers are all hand-typed reference figures, with nothing sourced behind
// them. Every fluid, torque and capacity on it was written by a person from
// general knowledge of the platform, not pulled from a source that can be
// cited back.
//
// The test is the fluid block, because that is the part a skeleton always
// ships with -- a new entry gets specs and fluids first and its guides
// later, so fluid provenance is the earliest honest signal of whether
// anything on the page has been verified.
//
// A vehicle with NO fluids at all is not called unverified here. It is not
// making a claim yet, and the admin coverage page already flags it as
// missing data. This label is for a page that shows a reader real-looking
// numbers, so the reader learns where they came from.
//
// One definition, three callers: this page badge and the two admin signals
// (getBuildQueue's hand-typed-fluids and the guide console's coverage
// issues). They must not be allowed to drift -- the whole point is that
// what Andy sees in the admin area and what a reader sees on the page are
// the same claim.
export function isUnverifiedVehicle(vehicle: Vehicle): boolean {
  return (
    vehicle.fluids.length > 0 &&
    !vehicle.fluids.some((f) => f.provenance?.source === "open-labor-project")
  );
}

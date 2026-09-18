// Free, public NHTSA vPIC browse endpoints — the same database behind the VIN
// decode in src/lib/vpic.ts, but keyed by year/make/model instead of by VIN.
// No API key, no quota, no cost. Powers the dropdowns on /garage/add for
// people who do not have their VIN handy.
//
// Deliberately NOT using vPIC GetAllMakes: it returns 12,000+ registered
// manufacturers, including trailer and farm-equipment builders, which is
// unusable as a dropdown. The three passenger vehicle types below cover cars,
// trucks and SUVs in roughly 300 entries.
//
// vPIC has no browseable trim or engine list — those come back only from a
// real VIN decode — so /garage/add sources trim and engine from our own
// curated catalog when it has that year/make/model, and falls back to free
// text when it does not.

const BASE = "https://vpic.nhtsa.dot.gov/api/vehicles";
const AS_JSON = "?format=json";

const VEHICLE_TYPES = ["car", "truck", "multipurpose passenger vehicle (mpv)"];

let makesCache: string[] | null = null;

// vPIC returns makes shouted in all caps ("ASTON MARTIN"). Catalog matching is
// case-insensitive, so this is purely so the dropdown does not yell.
function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(" ")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

export async function getVehicleMakes(): Promise<string[]> {
  if (makesCache) return makesCache;
  try {
    const lists = await Promise.all(
      VEHICLE_TYPES.map(async (type) => {
        const res = await fetch(
          `${BASE}/GetMakesForVehicleType/${encodeURIComponent(type)}${AS_JSON}`
        );
        if (!res.ok) return [] as string[];
        const json = await res.json();
        return ((json?.Results ?? []) as { MakeName?: string }[]).map(
          (row) => row.MakeName ?? ""
        );
      })
    );
    const merged = [...new Set(lists.flat().filter(Boolean).map(titleCase))].sort();
    makesCache = merged;
    return merged;
  } catch {
    return [];
  }
}

// vPIC returns one row per body style, so the raw response repeats each model
// several times (2014 Jeep comes back with "Wrangler" three times). Collapse it.
export async function getVehicleModels(
  make: string,
  year: string
): Promise<string[]> {
  if (!make || !year) return [];
  try {
    const res = await fetch(
      `${BASE}/GetModelsForMakeYear/make/${encodeURIComponent(
        make
      )}/modelyear/${encodeURIComponent(year)}${AS_JSON}`
    );
    if (!res.ok) return [];
    const json = await res.json();
    const names = ((json?.Results ?? []) as { Model_Name?: string }[]).map(
      (row) => row.Model_Name ?? ""
    );
    return [...new Set(names.filter(Boolean))].sort();
  } catch {
    return [];
  }
}

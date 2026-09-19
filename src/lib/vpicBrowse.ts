// Vehicle pickers for the no-VIN path on /garage/add.
//
// The make list is baked in rather than fetched from NHTSA vPIC, for three
// reasons:
//   1. The car + truck + MPV vehicle-type lists total 406 entries and are full
//      of street sweepers, fire apparatus, class 8 trucks, RV brands, defunct
//      coachbuilders and one-off customs. "1955 Custom Belair", "Allianz
//      Sweeper Company" and "Zzknown" are all real entries.
//   2. Fetching them cost a network round trip before the form was usable.
//   3. Holding the numeric MakeId is what makes the model lookup below exact
//      instead of fuzzy — see getVehicleModels.
//
// Scion is deliberately absent: vPIC returns zero models for it at any year,
// so it would be a dead end. Scion VINs decode under Toyota.

const BASE = "https://vpic.nhtsa.dot.gov/api/vehicles";
const AS_JSON = "?format=json";

// First model year offered. 1996 is the OBD-II cutover; before it, vPIC model
// lists get both longer and much dirtier (1985 Honda returns 71 models, padded
// with motorcycles), and nothing in the curated catalog reaches back that far.
export const EARLIEST_MODEL_YEAR = 1996;

export interface VehicleMake {
  id: number;
  name: string;
}

export const VEHICLE_MAKES: VehicleMake[] = [
  { id: 475, name: "Acura" },
  { id: 493, name: "Alfa Romeo" },
  { id: 606, name: "AM General" },
  { id: 440, name: "Aston Martin" },
  { id: 582, name: "Audi" },
  { id: 583, name: "Bentley" },
  { id: 452, name: "BMW" },
  { id: 468, name: "Buick" },
  { id: 469, name: "Cadillac" },
  { id: 467, name: "Chevrolet" },
  { id: 477, name: "Chrysler" },
  { id: 1077, name: "Daewoo" },
  { id: 476, name: "Dodge" },
  { id: 2408, name: "Eagle" },
  { id: 603, name: "Ferrari" },
  { id: 492, name: "Fiat" },
  { id: 11856, name: "Fisker" },
  { id: 460, name: "Ford" },
  { id: 5083, name: "Genesis" },
  { id: 472, name: "GMC" },
  { id: 474, name: "Honda" },
  { id: 951, name: "Hummer" },
  { id: 498, name: "Hyundai" },
  { id: 480, name: "Infiniti" },
  { id: 542, name: "Isuzu" },
  { id: 442, name: "Jaguar" },
  { id: 483, name: "Jeep" },
  { id: 499, name: "Kia" },
  { id: 502, name: "Lamborghini" },
  { id: 444, name: "Land Rover" },
  { id: 515, name: "Lexus" },
  { id: 464, name: "Lincoln" },
  { id: 466, name: "Lotus" },
  { id: 10919, name: "Lucid" },
  { id: 443, name: "Maserati" },
  { id: 533, name: "Maybach" },
  { id: 473, name: "Mazda" },
  { id: 2236, name: "McLaren" },
  { id: 449, name: "Mercedes-Benz" },
  { id: 465, name: "Mercury" },
  { id: 456, name: "Mini" },
  { id: 481, name: "Mitsubishi" },
  { id: 478, name: "Nissan" },
  { id: 4162, name: "Oldsmobile" },
  { id: 2409, name: "Plymouth" },
  { id: 10224, name: "Polestar" },
  { id: 536, name: "Pontiac" },
  { id: 584, name: "Porsche" },
  { id: 496, name: "Ram" },
  { id: 10887, name: "Rivian" },
  { id: 445, name: "Rolls-Royce" },
  { id: 572, name: "Saab" },
  { id: 1056, name: "Saturn" },
  { id: 504, name: "Smart" },
  { id: 523, name: "Subaru" },
  { id: 509, name: "Suzuki" },
  { id: 441, name: "Tesla" },
  { id: 448, name: "Toyota" },
  { id: 11366, name: "VinFast" },
  { id: 482, name: "Volkswagen" },
  { id: 485, name: "Volvo" },
];

export function listModelYears(): string[] {
  const newest = new Date().getFullYear() + 1;
  const years: string[] = [];
  for (let y = newest; y >= EARLIEST_MODEL_YEAR; y--) years.push(String(y));
  return years;
}

export function findMakeByName(name: string): VehicleMake | undefined {
  const needle = name.trim().toLowerCase();
  if (!needle) return undefined;
  return VEHICLE_MAKES.find((make) => make.name.toLowerCase() === needle);
}

// Always look models up by numeric MakeId, never by name. The vPIC by-name
// endpoint does a fuzzy substring match: asking for "RAM" returns 79 results
// including "Brammo Street Bikes" and "Best Lane Enterprises dba Ramp Free".
// By id it returns the 11 real Ram models.
//
// vPIC also returns one row per body style, so the same model repeats several
// times in the raw response. Collapse it.
export async function getVehicleModels(
  makeId: number,
  year: string
): Promise<string[]> {
  if (!makeId || !year) return [];
  try {
    const res = await fetch(
      `${BASE}/GetModelsForMakeIdYear/makeId/${makeId}/modelyear/${encodeURIComponent(
        year
      )}${AS_JSON}`
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

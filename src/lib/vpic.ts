// Free, public NHTSA vPIC API (https://vpic.nhtsa.dot.gov/api/) — no API key
// required. Used as a supplementary "what is this VIN" lookup for basic
// attributes (year/make/model/engine/trim). It does NOT provide fluid
// capacities, torque specs, or repair procedures — those still come from the
// curated data in src/data/, which is the whole reason this app exists.

export interface DecodedVin {
  vin: string;
  year?: string;
  make?: string;
  model?: string;
  trim?: string;
  bodyClass?: string;
  engineCylinders?: string;
  displacementL?: string;
  fuelType?: string;
  driveType?: string;
  transmissionStyle?: string;
  errorText?: string;
}

const FIELD_MAP: Record<string, keyof DecodedVin> = {
  "Model Year": "year",
  Make: "make",
  Model: "model",
  Trim: "trim",
  "Body Class": "bodyClass",
  "Engine Number of Cylinders": "engineCylinders",
  "Displacement (L)": "displacementL",
  "Fuel Type - Primary": "fuelType",
  "Drive Type": "driveType",
  "Transmission Style": "transmissionStyle",
  "Error Text": "errorText",
};

export async function decodeVin(vin: string): Promise<DecodedVin> {
  const cleaned = vin.trim().toUpperCase();
  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/${encodeURIComponent(
    cleaned
  )}?format=json`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`NHTSA vPIC API request failed (${res.status})`);
  }
  const json = await res.json();
  const row = json?.Results?.[0] ?? {};

  const result: Record<string, string> = { vin: cleaned };
  for (const [apiField, key] of Object.entries(FIELD_MAP)) {
    const value = row[apiField];
    if (value) result[key] = value;
  }
  return result as unknown as DecodedVin;
}

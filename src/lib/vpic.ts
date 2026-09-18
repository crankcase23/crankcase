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

// NOTE (2026-09-18): these keys MUST match the flat field names returned by the
// `decodevinvalues` endpoint called below — NOT the human-readable "Variable"
// labels ("Model Year", "Engine Number of Cylinders", ...) returned by the
// other vPIC endpoint, `decodevin`. They were previously the latter, so every
// multi-word field silently decoded to undefined and only make/model/trim (the
// three names that happen to be spelled identically in both response shapes)
// ever populated. Downstream, that stamped every VIN-added vehicle
// "YEAR UNKNOWN" and made matchCatalogVehicles() in src/lib/data.ts a no-op,
// since it bails out when year is missing.
const FIELD_MAP: Record<string, keyof DecodedVin> = {
  ModelYear: "year",
  Make: "make",
  Model: "model",
  Trim: "trim",
  BodyClass: "bodyClass",
  EngineCylinders: "engineCylinders",
  DisplacementL: "displacementL",
  FuelTypePrimary: "fuelType",
  DriveType: "driveType",
  TransmissionStyle: "transmissionStyle",
};

// vPIC reports displacement as a raw float string that sometimes carries
// floating-point noise ("3.5999999046325684"). One decimal place is what a
// person expects to read on a spec line.
function tidyDisplacement(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return value;
  return String(Math.round(n * 10) / 10);
}

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
    if (value) result[key] = String(value).trim();
  }

  if (result.displacementL) {
    result.displacementL = tidyDisplacement(result.displacementL);
  }

  // vPIC populates ErrorText even on a clean decode ("0 - VIN decoded clean."),
  // so only surface it when the error code is actually non-zero.
  const errorCode = String(row.ErrorCode ?? "").trim();
  if (errorCode && errorCode !== "0" && row.ErrorText) {
    result.errorText = String(row.ErrorText).trim();
  }

  return result as unknown as DecodedVin;
}

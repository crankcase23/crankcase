// VIN rules shared by the browser (add-vehicle flow, photo scan) and the server (POST /api/garage), so both agree.
//
// A VIN is required to put a vehicle in a garage permanently. This module only answers "is this string a plausible VIN?";
// it never looks a VIN up anywhere and never reveals whether any other account holds it.
//
// Rules: 17 characters, A-Z 0-9 excluding I, O, Q (ISO 3779). The check digit (position 9) is mandatory for North American
// VINs (WMI starting 1-5), so a mismatch there is a typo and is rejected. Vehicles built for other markets often carry no
// valid check digit, so for those the format alone decides and the customer's confirmation of the decoded vehicle is the
// safety net.

const TRANSLIT: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

/** Uppercase, strip spaces/dashes/punctuation. Never throws. */
export function normalizeVin(raw: unknown): string {
  return typeof raw === "string" ? raw.toUpperCase().replace(/[^A-Z0-9]/g, "") : "";
}

export function vinCheckDigit(vin: string): string | null {
  if (vin.length !== 17) return null;
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const c = vin[i];
    const v = /[0-9]/.test(c) ? Number(c) : TRANSLIT[c];
    if (v === undefined) return null;
    sum += v * WEIGHTS[i];
  }
  const r = sum % 11;
  return r === 10 ? "X" : String(r);
}

export type VinCheck = { ok: true; vin: string } | { ok: false; vin: string; error: string };

export function checkVin(raw: unknown): VinCheck {
  const vin = normalizeVin(raw);
  if (!vin) return { ok: false, vin, error: "A VIN is required to add a vehicle to your garage." };
  if (vin.length !== 17) return { ok: false, vin, error: "A VIN is 17 characters. Double-check it and try again." };
  if (/[IOQ]/.test(vin)) return { ok: false, vin, error: "A VIN never contains the letters I, O or Q. Check for 1 or 0 typed as a letter." };
  if (/^[1-5]/.test(vin) && vinCheckDigit(vin) !== vin[8]) {
    return { ok: false, vin, error: "That VIN fails its check digit, so one character is probably wrong. Compare it to your registration or door jamb." };
  }
  return { ok: true, vin };
}

/** Pull VIN candidates out of arbitrary scanned/pasted text (barcode payloads often carry prefixes such as "I" or a space). */
export function extractVinCandidates(text: string): string[] {
  const up = String(text ?? "").toUpperCase();
  const found = new Set<string>();
  for (const m of up.matchAll(/[A-HJ-NPR-Z0-9]{17}/g)) found.add(m[0]);
  const squashed = up.replace(/[^A-Z0-9]/g, "");
  for (let i = 0; i + 17 <= squashed.length && i < 8; i++) found.add(squashed.slice(i, i + 17));
  return [...found].filter((v) => checkVin(v).ok);
}

// VIN identity helpers, shared by the browser (VIN field, photo scan) and the server (every add). Pure: no I/O.
//
// A VIN identifies ONE canonical vehicle. This module is the single place that says what a well-formed VIN is and how two
// spellings of the same VIN compare, so a future owner/transfer model can hang user-to-vehicle relationships off
// `canonicalVin()` without touching the rules.
//
// Rules (ISO 3779 / 49 CFR 565): 17 characters, A-Z and 0-9 except I, O, Q; position 9 is a check digit computed from the
// other sixteen. Every vehicle sold in the US carries a valid check digit, imports included, and this is a US app, so the
// check digit is enforced for every VIN. A non-US-market VIN that fails it cannot be added until there is a support path;
// that is a known, documented limitation, not a silent pass.

export const VIN_LENGTH = 17;
export const VIN_ALPHABET = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";

const TRANSLIT: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};
for (let d = 0; d <= 9; d++) TRANSLIT[String(d)] = d;
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

/** Formatting only: trims, drops spaces/dashes, upper-cases. It NEVER swaps one character for another. */
export function normalizeVin(input: unknown): string {
  return String(input ?? "").replace(/[\s\-_.]/g, "").toUpperCase();
}

/** The canonical key two spellings of the same VIN share. Today the same as normalizeVin; one place to change later. */
export function canonicalVin(input: unknown): string {
  return normalizeVin(input);
}

export function checkDigitFor(vin: string): string | null {
  if (vin.length !== VIN_LENGTH) return null;
  let sum = 0;
  for (let i = 0; i < VIN_LENGTH; i++) {
    const v = TRANSLIT[vin[i]];
    if (v === undefined) return null;
    sum += v * WEIGHTS[i];
  }
  const r = sum % 11;
  return r === 10 ? "X" : String(r);
}

export type VinProblem = "empty" | "length" | "characters" | "check-digit";

export type VinCheck =
  | { ok: true; vin: string }
  | { ok: false; vin: string; problem: VinProblem; message: string; badPositions: number[] };

/** Validates what the customer typed or confirmed. `vin` in the result is the normalized spelling. */
export function validateVin(input: unknown): VinCheck {
  // Only text is a VIN: a number, array or object that happens to stringify to 17 characters is not one.
  if (typeof input !== "string") return { ok: false, vin: "", problem: "empty", message: "Enter the 17-character VIN.", badPositions: [] };
  const vin = normalizeVin(input);
  if (!vin) return { ok: false, vin, problem: "empty", message: "Enter the 17-character VIN.", badPositions: [] };
  if (vin.length !== VIN_LENGTH) {
    return { ok: false, vin, problem: "length", message: `A VIN has 17 characters; this has ${vin.length}.`, badPositions: [] };
  }
  const bad: number[] = [];
  for (let i = 0; i < VIN_LENGTH; i++) if (!VIN_ALPHABET.includes(vin[i])) bad.push(i);
  if (bad.length) {
    return {
      ok: false, vin, problem: "characters", badPositions: bad,
      message: "VINs never contain the letters I, O or Q, or symbols. Check the highlighted characters against your vehicle.",
    };
  }
  if (checkDigitFor(vin) !== vin[8]) {
    return {
      ok: false, vin, problem: "check-digit", badPositions: [8],
      message: "This VIN does not pass the VIN check-digit test, so at least one character is probably misread. Compare it to your vehicle character by character.",
    };
  }
  return { ok: true, vin };
}

export const isValidVin = (input: unknown): boolean => validateVin(input).ok;

// Characters a camera or a tired eye mixes up. Used to HIGHLIGHT doubt and to OFFER a correction; never to apply one.
const CONFUSABLE: Record<string, string[]> = {
  "0": ["D"], "1": ["L"], "2": ["Z"], "5": ["S"], "6": ["G"], "8": ["B"],
  D: ["0"], L: ["1"], Z: ["2"], S: ["5"], G: ["6"], B: ["8"],
  U: ["V"], V: ["U"], M: ["N"], N: ["M"], E: ["F"], F: ["E"], H: ["N"], K: ["X"], X: ["K"], P: ["R"], R: ["P"],
  // I, O and Q are not legal VIN characters; they are what the camera reads where a 1, 0 or 0 should be.
  I: ["1"], O: ["0"], Q: ["0"],
};

export const isConfusable = (ch: string) => ch in CONFUSABLE;

/**
 * Corrections worth OFFERING when a VIN fails: every single-character change to a lookalike that makes the VIN valid.
 * Returned as suggestions for the customer to accept or ignore. Nothing here ever edits the field by itself.
 */
export function suggestCorrections(input: unknown): { vin: string; position: number; from: string; to: string }[] {
  const vin = normalizeVin(input);
  if (vin.length !== VIN_LENGTH) return [];
  const out: { vin: string; position: number; from: string; to: string }[] = [];
  for (let i = 0; i < VIN_LENGTH; i++) {
    for (const to of CONFUSABLE[vin[i]] ?? []) {
      const next = vin.slice(0, i) + to + vin.slice(i + 1);
      if (validateVin(next).ok) out.push({ vin: next, position: i, from: vin[i], to });
    }
  }
  return out;
}

/**
 * Pulls VIN-shaped candidates out of OCR text. A candidate is any run of 17 letters/digits (spaces and dashes inside a run
 * are ignored). The characters are returned exactly as read, I/O/Q included, so the customer sees what the camera saw.
 */
export function extractVinCandidates(text: string): string[] {
  const found = new Set<string>();
  const lines = String(text ?? "").toUpperCase().split(/\r?\n/);
  const push = (s: string) => { if (s.length === VIN_LENGTH) found.add(s); };
  for (const line of lines) {
    const tokens = line.split(/[^A-Z0-9]+/).filter(Boolean);
    // a VIN, or a VIN the reader broke into a few pieces ("1HGCM 82633 A004352")
    for (let i = 0; i < tokens.length; i++) {
      let joined = "";
      for (let j = i; j < Math.min(tokens.length, i + 5); j++) {
        joined += tokens[j];
        if (joined.length === VIN_LENGTH) push(joined);
        if (joined.length >= VIN_LENGTH) break;
      }
    }
    // a short line that is just a VIN with a stray character or two on either side. Longer lines are ordinary printed
    // text (labels, ratings), and sliding a 17-character window over them only invents VIN-shaped junk.
    const compact = line.replace(/[^A-Z0-9]/g, "");
    if (compact.length > VIN_LENGTH && compact.length <= VIN_LENGTH + 3) for (let i = 0; i + VIN_LENGTH <= compact.length; i++) push(compact.slice(i, i + VIN_LENGTH));
  }
  // Valid ones first, then ones with the fewest illegal characters.
  const score = (v: string) => (validateVin(v).ok ? 0 : 1) * 100 + [...v].filter((c) => !VIN_ALPHABET.includes(c)).length;
  return [...found].sort((a, b) => score(a) - score(b));
}

/**
 * Positions the customer must look at again before trusting a scan: characters that cannot appear in a VIN, characters the
 * OCR itself was unsure of (confidence below `minConfidence`, when known), and lookalike characters when the VIN fails.
 */
export function uncertainPositions(vin: string, confidences?: (number | undefined)[], minConfidence = 85): number[] {
  const v = normalizeVin(vin);
  const result = validateVin(v);
  const out = new Set<number>();
  for (let i = 0; i < v.length; i++) {
    if (!VIN_ALPHABET.includes(v[i])) out.add(i);
    const c = confidences?.[i];
    if (c !== undefined && c < minConfidence) out.add(i);
  }
  // A VIN that fails only the check digit has a misread somewhere. Point at the lookalikes whose swap would make it valid;
  // when no single swap does, point at every lookalike (we cannot narrow it down) rather than guess.
  if (!result.ok && result.problem === "check-digit") {
    const hits = suggestCorrections(v).map((s) => s.position);
    if (hits.length) hits.forEach((p) => out.add(p));
    else for (let i = 0; i < v.length; i++) if (isConfusable(v[i])) out.add(i);
  }
  return [...out].sort((a, b) => a - b);
}

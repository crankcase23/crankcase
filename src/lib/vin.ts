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
  "0": ["D"], "1": ["L", "7"], "2": ["Z"], "5": ["S"], "6": ["G"], "7": ["1", "T", "A"], "8": ["B"],
  A: ["7"], D: ["0"], L: ["1"], Z: ["2", "7"], S: ["5"], G: ["6"], B: ["8"], T: ["7"],
  U: ["V"], V: ["U"], M: ["N"], N: ["M"], E: ["F"], F: ["E"], H: ["N"], K: ["X"], X: ["K"], P: ["R"], R: ["P"],
  // I, O and Q are not legal VIN characters; they are what the camera reads where a 1, 0 or 0 should be.
  I: ["1", "7"], O: ["0"], Q: ["0"], // a slashed 7 is read as I, Z or T on some labels (found on a real BMW door-jamb photo)
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

// ------------------------------------------------------------------------------------------------ reading a VIN out of OCR text
// A door-jamb label is mostly legal text and weights. The reader must pick the VIN out of it, so a candidate has to LOOK like a
// VIN before it is considered at all, and the survivors are ranked by evidence (check digit, the word "VIN" right before it,
// the position-9 rule, how many digits it has, how sure the camera was), never by how often a piece of text was read.

export const MAX_ILLEGAL_CHARS = 2; // I/O/Q: a camera reads 1 or 0 as one of these, so a couple are tolerated (and shown), a lot is not a VIN
export const MIN_DIGITS = 4; // every real VIN carries many digits (serial, year, check digit); sentences and warnings carry none

const DIGIT_LOOKALIKE = new Set(Object.entries({ B: "8", D: "0", G: "6", I: "1", L: "1", O: "0", Q: "0", S: "5", Z: "2" }).map(([k]) => k));

/**
 * Could this 17-character read be a VIN the camera got partly wrong? Pure shape test, no check digit:
 * A-Z/0-9 only, at most MAX_ILLEGAL_CHARS letters from I/O/Q, at least MIN_DIGITS digits, at least 3 digits among the last 4
 * characters, and position 9 (the check digit) is a digit or X, or a letter a camera mixes up with a digit. Plain words and warning text fail this on the digits alone.
 */
export function isPlausibleVinRead(read: string): boolean {
  if (typeof read !== "string" || read.length !== VIN_LENGTH || !/^[A-Z0-9]+$/.test(read)) return false;
  let illegal = 0, digits = 0;
  for (const c of read) {
    if (c === "I" || c === "O" || c === "Q") illegal++;
    if (c >= "0" && c <= "9") digits++;
  }
  if (illegal > MAX_ILLEGAL_CHARS || digits < MIN_DIGITS) return false;
  // The serial number at the end of a US-market VIN is numeric (49 CFR 565.15). Tolerate one misread, but a run of letters at the
  // end ("...1940KGGAWR", the weights line) is label text, even when its check digit happens to pass (about 1 junk read in 11 does).
  let tail = 0;
  for (const c of read.slice(-4)) if (c >= "0" && c <= "9") tail++;
  if (tail < 3) return false;
  const check = read[8];
  return (check >= "0" && check <= "9") || check === "X" || DIGIT_LOOKALIKE.has(check);
}

// Words that fill a vehicle certification / tire / weight label. A VIN-shaped run built out of them is label text, whatever its
// check digit says (a weights line such as "GAWR FRT 2183 LBS 990" can have the shape of a VIN). Whole-word match for any
// piece; words of 4+ letters are also refused as a substring of a run (a run printed right after the word VIN is exempt). Extend this list when a label shows a new one.
const LABEL_WORDS = new Set([
  "GVWR", "GAWR", "FRT", "RR", "LBS", "KG", "KPA", "PSI", "MFD", "DATE", "TYPE", "TIRE", "SIZE", "FRONT", "REAR", "COLD", "CAR", "TRUCK", "MPV", "RIM", "LOAD", "SEE", "GROSS", "AXLE", "WEIGHT", "RATING",
  "PRESSURE", "PASSENGER", "VEHICLE", "STANDARD", "STANDARDS", "EFFECT", "MANUFACTURE", "FEDERAL", "MOTOR", "SAFETY", "BUMPER", "THEFT", "PREVENTION", "CONFORMS", "APPLICABLE", "CANADIAN", "SHOWN", "ABOVE",
  "INFLATION", "OWNERS", "MANUAL", "INFORMATION", "COMBINED", "CERTIFICATION", "MULTIPURPOSE", "CONFORM", "MANUFACTURED",
]);
const SUBSTRING_LABEL_WORDS = [...LABEL_WORDS].filter((w) => w.length >= 4);

/** True when a candidate (and the OCR words it was joined from, if any) is made of label vocabulary rather than a VIN. */
export function looksLikeLabelText(read: string, pieces: string[] = []): boolean {
  if (pieces.some((p) => LABEL_WORDS.has(p))) return true;
  return SUBSTRING_LABEL_WORDS.some((w) => read.includes(w));
}

export type VinReadEvidence = { afterVinLabel?: boolean; confidences?: (number | undefined)[]; count?: number };

/** Higher is more likely to be THE VIN. Meant for ranking plausible reads only; it never edits a character. */
export function scoreVinRead(read: string, ev: VinReadEvidence = {}): number {
  let score = 0;
  const valid = validateVin(read).ok;
  if (valid) score += 1000;
  // No bonus for 'one lookalike swap away from valid': with this many confusable characters almost any read is, so it proves nothing.
  if (ev.afterVinLabel) score += 300; // the label prints "VIN" right before the number
  let illegal = 0, digits = 0;
  for (const c of read) {
    if (c === "I" || c === "O" || c === "Q") illegal++;
    if (c >= "0" && c <= "9") digits++;
  }
  score -= illegal * 150;
  score += digits * 10;
  const check = read[8];
  score += (check >= "0" && check <= "9") || check === "X" ? 100 : -100;
  const known = (ev.confidences ?? []).filter((c): c is number => typeof c === "number");
  if (known.length) score += (known.reduce((a, b) => a + b, 0) / known.length) / 2;
  score += Math.min(ev.count ?? 1, 10) * 5; // repetition is only a tie-breaker, never the deciding factor
  return score;
}

/** Candidates in the order they should be offered, each with the evidence that ranked it. Exported for the scanner. */
export function rankedVinCandidates(text: string): { vin: string; afterVinLabel: boolean }[] {
  const found = new Map<string, boolean>(); // vin -> printed right after the word VIN
  const push = (s: string, afterVin = false, pieces: string[] = []) => {
    if (!isPlausibleVinRead(s) || (!afterVin && looksLikeLabelText(s, pieces))) return;
    found.set(s, (found.get(s) ?? false) || afterVin);
  };
  const lines = String(text ?? "").toUpperCase().split(/\r?\n/);
  for (const line of lines) {
    const tokens = line.split(/[^A-Z0-9]+/).filter(Boolean);
    // a VIN, or a VIN the reader broke into a few pieces ("1HGCM 82633 A004352")
    for (let i = 0; i < tokens.length; i++) {
      let joined = "";
      for (let j = i; j < Math.min(tokens.length, i + 5); j++) {
        joined += tokens[j];
        if (joined.length === VIN_LENGTH) push(joined, i > 0 && tokens[i - 1] === "VIN", tokens.slice(i, j + 1));
        if (joined.length >= VIN_LENGTH) break;
      }
    }
    const compact = line.replace(/[^A-Z0-9]/g, "");
    // a short line that is just a VIN with a stray character or two on either side. Longer lines are ordinary printed
    // text (labels, ratings), and sliding a 17-character window over them only invents VIN-shaped junk.
    if (compact.length > VIN_LENGTH && compact.length <= VIN_LENGTH + 3) {
      // a line that starts with the label ("VIN" + number) has exactly one sensible alignment: the number after the label.
      // Shifted windows over the same text ("VINWBAPH7C58AA175", "NWBAPH7C58AA17576") are the same VIN misaligned, not new VINs.
      if (compact.startsWith("VIN")) push(compact.slice(3, 3 + VIN_LENGTH), true);
      else if (!looksLikeLabelText("", tokens)) {
        // a window that overlaps a label word, even partly ("AWRFRT2183LBS990K" sliced out of "GAWRFRT2183LBS990KG"), is label text
        const spans = SUBSTRING_LABEL_WORDS.flatMap((w) => { const at = compact.indexOf(w); return at >= 0 ? [[at, at + w.length] as const] : []; });
        for (let i = 0; i + VIN_LENGTH <= compact.length; i++) if (!spans.some(([a, b]) => i < b && i + VIN_LENGTH > a)) push(compact.slice(i, i + VIN_LENGTH));
      }
    }
    // the reader ran "VIN" and the number together, possibly with more text after it ("VINWBAPH7C58AA175760TYPE...")
    const at = compact.indexOf("VIN");
    if (at >= 0 && compact.length >= at + 3 + VIN_LENGTH) push(compact.slice(at + 3, at + 3 + VIN_LENGTH), true);
  }
  return [...found.entries()]
    .map(([vin, afterVinLabel]) => ({ vin, afterVinLabel, score: scoreVinRead(vin, { afterVinLabel }) }))
    .sort((a, b) => b.score - a.score)
    .map(({ vin, afterVinLabel }) => ({ vin, afterVinLabel }));
}

/**
 * Pulls VIN candidates out of OCR text, best first. A candidate is a 17-character run of letters/digits (spaces and dashes
 * inside a run are ignored) that LOOKS like a VIN (see isPlausibleVinRead): text with no digits, such as a legal warning, is
 * never a candidate. Characters are returned exactly as read, I/O/Q included, so the customer sees what the camera saw.
 */
export function extractVinCandidates(text: string): string[] {
  return rankedVinCandidates(text).map((c) => c.vin);
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

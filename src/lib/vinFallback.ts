// NHTSA-outage fallback: pure rules (no database, no network), shared by the server gate and the tests.
//
// While the NHTSA VIN decoder is down a customer may add a vehicle by typing its details. Such a vehicle is saved as
// UNVERIFIED and gets Service History and reminders only (never guides, specs, fluids or unlocks). The VIN rules do not
// relax: the VIN is still required and still has to pass src/lib/vin.ts. The server, not the browser, decides whether the
// decoder is really down (src/lib/vpicServer.ts).

export type VinStatus = "verified" | "unverified";

/** Fallback additions allowed per account per rolling 24 hours. */
export const FALLBACK_DAILY_CAP = 5;

/** Off unless VIN_FALLBACK_ENABLED is exactly "true". Turning it on is an environment change the owner makes. */
export function fallbackEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.VIN_FALLBACK_ENABLED === "true";
}

export interface TypedDetails {
  year: string;
  make: string;
  model: string;
  trim?: string;
  engine?: string;
}

export type DetailsParse = { ok: true; value: TypedDetails } | { ok: false; error: string };

const FIRST_YEAR = 1981; // the 17-character VIN standard
const clean = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");
// Plain text only: letters, digits and the punctuation real model names use. Rejects markup and control characters.
const SAFE = /^[\p{L}\p{N} .,'&+\/()\-]+$/u;

export function parseFallbackDetails(raw: unknown, now: Date = new Date()): DetailsParse {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const year = clean(r.year);
  const make = clean(r.make);
  const model = clean(r.model);
  const trim = clean(r.trim);
  const engine = clean(r.engine);
  if (!/^\d{4}$/.test(year)) return { ok: false, error: "Enter the model year as four digits." };
  const y = Number(year);
  if (y < FIRST_YEAR || y > now.getUTCFullYear() + 1) {
    return { ok: false, error: `Model year must be between ${FIRST_YEAR} and ${now.getUTCFullYear() + 1}.` };
  }
  if (!make || make.length > 40) return { ok: false, error: "Enter the make (up to 40 characters)." };
  if (!model || model.length > 60) return { ok: false, error: "Enter the model (up to 60 characters)." };
  if (trim.length > 60) return { ok: false, error: "Trim is too long (60 characters at most)." };
  if (engine.length > 60) return { ok: false, error: "Engine is too long (60 characters at most)." };
  for (const [label, v] of [["make", make], ["model", model], ["trim", trim], ["engine", engine]] as const) {
    if (v && !SAFE.test(v)) return { ok: false, error: `The ${label} has characters we can't accept. Use letters, numbers and basic punctuation.` };
  }
  return { ok: true, value: { year, make, model, ...(trim ? { trim } : {}), ...(engine ? { engine } : {}) } };
}

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/**
 * Does what NHTSA decoded describe the vehicle the customer typed? Year and make must agree exactly (ignoring case and
 * punctuation). The model must agree, or one must be the other plus extra words ("328i" and "328i xDrive"), because NHTSA
 * and owners word models differently. Anything looser would let a different vehicle become "verified".
 */
export function identityMatches(typed: Pick<TypedDetails, "year" | "make" | "model">, decoded: Pick<TypedDetails, "year" | "make" | "model">): boolean {
  if (squash(typed.year) !== squash(decoded.year)) return false;
  if (squash(typed.make) !== squash(decoded.make)) return false;
  const a = squash(typed.model);
  const b = squash(decoded.model);
  if (!a || !b) return false;
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 2 && long.startsWith(short);
}

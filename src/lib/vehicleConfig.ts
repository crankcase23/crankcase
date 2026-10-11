import type { ConfigAxis, ConfigScope, DrivetrainKind, FluidCapacity, SpecItem, TransmissionKind, Vehicle } from "@/types/vehicle";

// Vehicle configuration: which transmission and drivetrain a customer's car really has.
//
// This module is pure (no React, no DB) so the add flow, the Edit Configuration form, the API validators, the
// guide resolver and the tests all share one vocabulary. It deliberately knows nothing about any one make: the
// make only decides how a drivetrain is LABELLED ("Standard RWD" / "xDrive AWD" on a BMW, "2WD" / "4WD" on a Jeep)
// and, for a vehicle without a model-specific list, which family of options is offered.
//
// Three ideas to keep straight:
//   value     what is stored on the garage entry: a kind ("automatic", "rwd" ...), "unknown" (the customer chose
//             Not sure) or null (never asked: every garage entry that predates this feature).
//   options   what the Confirm Your Ride screen offers for ONE vehicle. Never an impossible choice; see configOptionsFor.
//   decision  only the customer's own selection is ever saved. A VIN decode may PRESELECT a choice; it never writes one.

export const UNKNOWN = "unknown" as const;
export type Unknown = typeof UNKNOWN;

export const TRANSMISSIONS: readonly TransmissionKind[] = ["automatic", "manual", "cvt", "dct"];
export const DRIVETRAINS: readonly DrivetrainKind[] = ["fwd", "rwd", "awd", "4wd", "2wd"];

export type TransmissionChoice = TransmissionKind | Unknown;
export type DrivetrainChoice = DrivetrainKind | Unknown;
export type AxisChoice = TransmissionChoice | DrivetrainChoice;

/** What is saved on a garage entry. null = never asked (a record that predates configuration). */
export interface VehicleConfig {
  transmission: TransmissionChoice | null;
  drivetrain: DrivetrainChoice | null;
  /** ISO time the customer last saved their choices; null while never confirmed. */
  confirmedAt: string | null;
}

export const EMPTY_CONFIG: VehicleConfig = { transmission: null, drivetrain: null, confirmedAt: null };

export const isTransmission = (v: unknown): v is TransmissionKind => typeof v === "string" && (TRANSMISSIONS as readonly string[]).includes(v);
export const isDrivetrain = (v: unknown): v is DrivetrainKind => typeof v === "string" && (DRIVETRAINS as readonly string[]).includes(v);
export const isChoice = (axis: ConfigAxis, v: unknown): v is AxisChoice =>
  v === UNKNOWN || (axis === "transmission" ? isTransmission(v) : isDrivetrain(v));

/** The confirmed kind for one axis, or null when it is unknown or never asked. */
export function confirmedValue(config: VehicleConfig | null | undefined, axis: ConfigAxis): TransmissionKind | DrivetrainKind | null {
  const v = config?.[axis];
  if (axis === "transmission") return isTransmission(v) ? v : null;
  return isDrivetrain(v) ? v : null;
}

export type AxisState = "confirmed" | "unknown" | "unset";
export function axisState(config: VehicleConfig | null | undefined, axis: ConfigAxis): AxisState {
  const v = config?.[axis];
  if (v == null) return "unset";
  return v === UNKNOWN ? "unknown" : "confirmed";
}

export type ConfigState = "confirmed" | "partial" | "unknown" | "unset";
/** Both axes confirmed / one confirmed / the customer said Not sure to everything / never asked. */
export function configState(config: VehicleConfig | null | undefined): ConfigState {
  const a = axisState(config, "transmission");
  const b = axisState(config, "drivetrain");
  if (a === "confirmed" && b === "confirmed") return "confirmed";
  if (a === "confirmed" || b === "confirmed") return "partial";
  if (a === "unset" && b === "unset") return "unset";
  return "unknown";
}

/**
 * Identity of the configuration as a guide sees it. Two configurations with the same key resolve every guide
 * identically, so a Wrench Mode session started under one key must not continue under another.
 */
export function configKey(config: VehicleConfig | null | undefined): string {
  return `${confirmedValue(config, "transmission") ?? "?"}|${confirmedValue(config, "drivetrain") ?? "?"}`;
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

const TRANSMISSION_LABEL: Record<TransmissionKind, string> = {
  automatic: "Automatic",
  manual: "Manual",
  cvt: "CVT",
  dct: "Dual-clutch (DCT)",
};

const isMake = (make: string | undefined, ...names: string[]) => names.includes((make ?? "").trim().toLowerCase());

/** Customer-facing label for a choice, in the vocabulary of the vehicle's make. */
export function choiceLabel(axis: ConfigAxis, value: AxisChoice, make?: string): string {
  if (value === UNKNOWN) return "Not sure";
  if (axis === "transmission") return TRANSMISSION_LABEL[value as TransmissionKind] ?? String(value);
  const d = value as DrivetrainKind;
  if (isMake(make, "bmw")) {
    if (d === "rwd") return "Standard RWD";
    if (d === "awd") return "xDrive AWD";
  }
  return { fwd: "FWD", rwd: "RWD", awd: "AWD", "4wd": "4WD", "2wd": "2WD" }[d] ?? String(d);
}

/** Short form for a one-line summary ("Automatic · RWD"). */
export function shortLabel(axis: ConfigAxis, value: AxisChoice, make?: string): string {
  if (axis === "drivetrain" && isMake(make, "bmw")) {
    if (value === "rwd") return "RWD";
    if (value === "awd") return "xDrive";
  }
  return choiceLabel(axis, value, make);
}

// ---------------------------------------------------------------------------
// Reading free text (a catalog entry's own strings, or NHTSA's decode)
// ---------------------------------------------------------------------------

/** Maps free text to a transmission kind, or undefined when it names none ("Not confirmed (...)" names none). */
export function parseTransmission(text: string | undefined | null): TransmissionKind | undefined {
  const t = String(text ?? "").trim().toLowerCase();
  if (!t || t.startsWith("not confirmed") || t.startsWith("not sure")) return undefined;
  if (/\bcvt\b|continuously variable/.test(t)) return "cvt";
  if (/dual[- ]clutch|\bdct\b/.test(t)) return "dct";
  if (/automated manual|\bamt\b/.test(t)) return undefined; // clutchless manual: neither a stick nor a torque converter, so do not guess
  if (/automatic|\bauto\b/.test(t)) return "automatic";
  if (/\bmanual\b|\bstick\b|standard transmission/.test(t)) return "manual";
  return undefined;
}

/** Maps free text to a drivetrain kind, or undefined when it names none. */
export function parseDrivetrain(text: string | undefined | null): DrivetrainKind | undefined {
  const t = String(text ?? "").trim().toLowerCase();
  if (!t || t.startsWith("not confirmed") || t.startsWith("not sure")) return undefined;
  if (/\bawd\b|all[- ]wheel|xdrive|4matic|quattro/.test(t)) return "awd";
  if (/\b4wd\b|\b4x4\b|four[- ]wheel/.test(t)) return "4wd";
  if (/\bfwd\b|front[- ]wheel/.test(t)) return "fwd";
  if (/\brwd\b|rear[- ]wheel/.test(t)) return "rwd";
  if (/\b2wd\b|\b4x2\b|two[- ]wheel/.test(t)) return "2wd";
  return undefined;
}

// ---------------------------------------------------------------------------
// What to offer for one vehicle
// ---------------------------------------------------------------------------

/** Where an axis's option list came from. "model" is our own per-model list; "generic" means we have none. */
export type OptionSource = "model" | "catalog" | "vin" | "generic";

export interface AxisOptions<T extends string> {
  /** The real choices, in display order. "Not sure" is always offered in addition and is not listed here. */
  options: T[];
  source: OptionSource;
  /** A choice the VIN (or a one-build model) establishes. Preselected, never saved until the customer confirms. */
  preselect?: T;
  /** Plain words for why it is preselected. */
  preselectBasis?: string;
}

export interface ConfigOptions {
  transmission: AxisOptions<TransmissionKind>;
  drivetrain: AxisOptions<DrivetrainKind>;
}

export interface ConfigOptionsInput {
  make?: string;
  /** The matching catalog vehicle, when there is one. */
  vehicle?: Vehicle;
  /** What a VIN decode (NHTSA vPIC) said, when this came from one. */
  decoded?: { driveType?: string; transmissionStyle?: string };
}

/** The drivetrain family offered when we have no model list: what exists, not what a given model offered. */
function genericDrivetrains(make?: string): DrivetrainKind[] {
  if (isMake(make, "jeep")) return ["2wd", "4wd"];
  return ["fwd", "rwd", "awd", "4wd"];
}

function build<T extends TransmissionKind | DrivetrainKind>(
  axis: ConfigAxis,
  input: ConfigOptionsInput,
): AxisOptions<T> {
  const parseRaw = axis === "transmission" ? parseTransmission : parseDrivetrain;
  // A Jeep sells "2WD"/"4WD", so a catalog or VIN wording of "RWD (2WD)" is the 2WD choice, not a separate RWD one.
  const parse = (text: string | undefined | null) => {
    const kind = parseRaw(text);
    return axis === "drivetrain" && isMake(input.make, "jeep") && (kind === "rwd" || kind === "fwd") ? "2wd" : kind;
  };
  const fromVin = parse(axis === "transmission" ? input.decoded?.transmissionStyle : input.decoded?.driveType) as T | undefined;
  const modelList = input.vehicle?.configSpec?.[axis] as T[] | undefined;

  if (modelList && modelList.length > 0) {
    // Our own list for this model: only these, ever. A VIN preselects one only when it names a member.
    const out: AxisOptions<T> = { options: [...modelList], source: "model" };
    if (modelList.length === 1) {
      out.preselect = modelList[0];
      out.preselectBasis = "this model came this way";
    } else if (fromVin && modelList.includes(fromVin)) {
      out.preselect = fromVin;
      out.preselectBasis = "your VIN lookup";
    }
    return out;
  }

  // No model list. Offer the family, plus anything the VIN or catalog entry actually named, and preselect only what they named.
  const fromCatalog = parse(axis === "transmission" ? input.vehicle?.transmission : input.vehicle?.drivetrain) as T | undefined;
  const base = (axis === "transmission" ? (["automatic", "manual"] as T[]) : (genericDrivetrains(input.make) as T[]));
  const named = [fromVin, fromCatalog].filter((x): x is T => Boolean(x));
  const options = [...new Set([...base, ...named])];
  const chosen = fromVin ?? fromCatalog;
  return {
    options,
    source: chosen ? (fromVin ? "vin" : "catalog") : "generic",
    ...(chosen ? { preselect: chosen, preselectBasis: fromVin ? "your VIN lookup" : "our catalog entry for this vehicle" } : {}),
  };
}

export function configOptionsFor(input: ConfigOptionsInput): ConfigOptions {
  return { transmission: build<TransmissionKind>("transmission", input), drivetrain: build<DrivetrainKind>("drivetrain", input) };
}

/** True when `value` may be saved for this vehicle (an option it really offers, or Not sure). */
export function isAllowedChoice(axis: ConfigAxis, value: unknown, options: ConfigOptions): value is AxisChoice {
  if (value === UNKNOWN) return true;
  return (options[axis].options as string[]).includes(value as string);
}

// ---------------------------------------------------------------------------
// One-line summary (garage card, vehicle header)
// ---------------------------------------------------------------------------

/**
 * The transmission and drivetrain parts of a vehicle's summary line, e.g. ["Automatic", "RWD"]. An axis that is not
 * confirmed contributes nothing: the card then shows a confirm prompt instead of a paragraph of uncertainty.
 */
export function summaryParts(config: VehicleConfig | null | undefined, make?: string): string[] {
  const out: string[] = [];
  const t = confirmedValue(config, "transmission");
  const d = confirmedValue(config, "drivetrain");
  if (t) out.push(shortLabel("transmission", t, make));
  if (d) out.push(shortLabel("drivetrain", d, make));
  return out;
}

/** Normalises a stored/JSON config; anything malformed becomes "never asked" for that axis rather than throwing. */
export function normalizeConfig(raw: unknown): VehicleConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    transmission: isChoice("transmission", r.transmission) ? (r.transmission as TransmissionChoice) : null,
    drivetrain: isChoice("drivetrain", r.drivetrain) ? (r.drivetrain as DrivetrainChoice) : null,
    confirmedAt: typeof r.confirmedAt === "string" ? r.confirmedAt : null,
  };
}

// ---------------------------------------------------------------------------
// Server-side validation of what a client sent
// ---------------------------------------------------------------------------

/**
 * Can `value` be saved for `axis` on this vehicle? A model with our own list accepts only that list (plus Not sure).
 * A vehicle without one accepts any real kind for the axis: the server cannot see the VIN decode the screen used, and
 * the screen is what narrows the choices there.
 */
export function serverAllows(axis: ConfigAxis, value: unknown, vehicle?: Vehicle): value is AxisChoice {
  if (value === UNKNOWN) return true;
  const list = vehicle?.configSpec?.[axis] as string[] | undefined;
  if (list && list.length > 0) return list.includes(value as string);
  return axis === "transmission" ? isTransmission(value) : isDrivetrain(value);
}

export type ConfigParse<T> = { ok: true; value: T } | { ok: false; error: string };

/** A complete configuration, for adding a vehicle: BOTH axes must be explicit ("unknown" is the Not sure answer). */
export function parseFullConfig(raw: unknown, vehicle?: Vehicle): ConfigParse<{ transmission: TransmissionChoice; drivetrain: DrivetrainChoice }> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  for (const axis of ["transmission", "drivetrain"] as const) {
    if (r[axis] == null || r[axis] === "") return { ok: false, error: `Confirm your ${axis} (or choose Not sure) before adding the vehicle.` };
    if (!serverAllows(axis, r[axis], vehicle)) return { ok: false, error: `That ${axis} is not available for this vehicle.` };
  }
  return { ok: true, value: { transmission: r.transmission as TransmissionChoice, drivetrain: r.drivetrain as DrivetrainChoice } };
}

/** An edit: one or both axes. Anything not sent is left as saved. */
export function parsePartialConfig(raw: unknown, vehicle?: Vehicle): ConfigParse<{ transmission?: TransmissionChoice; drivetrain?: DrivetrainChoice }> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: { transmission?: TransmissionChoice; drivetrain?: DrivetrainChoice } = {};
  for (const axis of ["transmission", "drivetrain"] as const) {
    if (r[axis] === undefined) continue;
    if (!serverAllows(axis, r[axis], vehicle)) return { ok: false, error: `That ${axis} is not available for this vehicle.` };
    (out as Record<string, unknown>)[axis] = r[axis];
  }
  if (Object.keys(out).length === 0) return { ok: false, error: "Nothing to change." };
  return { ok: true, value: out };
}

// ---------------------------------------------------------------------------
// How a catalog vehicle is described once the customer has answered
// ---------------------------------------------------------------------------

/**
 * The text for a vehicle's transmission or drivetrain, or null when there is nothing honest to say yet.
 *   confirmed   the customer's own answer. If the catalog entry already names the same kind it keeps its richer wording
 *               ("8-speed automatic (845RE)"); otherwise the plain label of what the customer confirmed.
 *   otherwise   the catalog entry's own wording when it names a single build (so an existing Jeep or Silverado reads as it
 *               always did until its owner confirms), and null when it does not ("Not confirmed (...)"). The caller shows a
 *               confirm prompt for null rather than a paragraph of uncertainty.
 */
export function axisDisplay(axis: ConfigAxis, vehicle: Vehicle, config: VehicleConfig | null | undefined, short = false): string | null {
  const have = confirmedValue(config, axis);
  const catalog = axis === "transmission" ? vehicle.transmission : vehicle.drivetrain;
  const catalogKind = axis === "transmission" ? parseTransmission(catalog) : parseDrivetrain(catalog);
  if (have) {
    if (catalogKind === have) return catalog;
    return short ? shortLabel(axis, have, vehicle.make) : choiceLabel(axis, have, vehicle.make);
  }
  return catalogKind ? catalog : null;
}

const NEEDS_CONFIRM = "Not confirmed yet. Use Edit Configuration to confirm it.";

/** Spec rows for this customer: transmission and drivetrain rows follow their saved answer (see SpecItem.configAxis). */
export function specRowsForConfig(vehicle: Vehicle, config: VehicleConfig | null | undefined): SpecItem[] {
  return vehicle.specs.map((row) => {
    if (row.configAxis) {
      const text = axisDisplay(row.configAxis, vehicle, config);
      return { label: row.label, value: text ?? NEEDS_CONFIRM };
    }
    // Every other vehicle's transmission / drivetrain row keeps its own wording until the customer confirms a build, then follows the answer.
    const axis: ConfigAxis | null = /^(drivetrain|drive type|drive)$/i.test(row.label) ? "drivetrain" : /^transmission$/i.test(row.label) ? "transmission" : null;
    if (axis && confirmedValue(config, axis)) return { label: row.label, value: axisDisplay(axis, vehicle, config) ?? row.value };
    return row;
  });
}

function scopeVerdict(scope: ConfigScope | undefined, config: VehicleConfig | null | undefined): "show" | "hide" | "restrict" {
  if (!scope) return "show";
  let verdict: "show" | "restrict" = "show";
  for (const axis of ["transmission", "drivetrain"] as const) {
    const allowed = scope[axis] as string[] | undefined;
    if (!allowed || allowed.length === 0) continue;
    const have = confirmedValue(config, axis);
    if (have == null) verdict = "restrict";
    else if (!allowed.includes(have)) return "hide";
  }
  return verdict;
}

/** Fluid rows for this customer: another build's rows are removed, an undecided row says what to confirm. */
export function fluidsForConfig(vehicle: Vehicle, config: VehicleConfig | null | undefined): FluidCapacity[] {
  const out: FluidCapacity[] = [];
  for (const f of vehicle.fluids) {
    const v = scopeVerdict(f.forConfig, config);
    if (v === "hide") continue;
    if (v === "restrict") {
      out.push({ name: f.name, capacity: "Confirm your drivetrain or transmission to see this", spec: "Depends on your build" });
      continue;
    }
    out.push(f);
  }
  return out;
}

/** The "Automatic · RWD" part of a card or header line, from the catalog and the customer's answer. */
export function summaryLine(vehicle: Vehicle, config: VehicleConfig | null | undefined): string[] {
  return [axisDisplay("transmission", vehicle, config, true), axisDisplay("drivetrain", vehicle, config, true)].filter((x): x is string => Boolean(x));
}

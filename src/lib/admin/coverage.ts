import { allRepairs, listVehicles, getPendingFitment } from "@/lib/data";
import type { JobTypeId, RepairGuide, Vehicle } from "@/types/vehicle";

// ---------------------------------------------------------------------------
// Guide coverage report.
//
// Answers one question per vehicle: how many guides SHOULD this car have, how
// many does it have, and what is left.
//
// The target is computed, never hardcoded. A flat "every vehicle needs N
// guides" would be wrong in both directions -- a front-wheel-drive car has no
// serviceable differential, and an EV has no oil to change. So each job in the
// catalog below carries an applicability rule, and a vehicle's target is the
// subset of jobs that actually apply to it.
//
// This module is read-only over src/data/*.ts. It touches no database and
// stores nothing: the numbers are derived fresh from the catalog every load,
// so they cannot drift out of sync with the content the way a cached count
// would.
// ---------------------------------------------------------------------------

export type CoverageStatus = "complete" | "in-progress" | "not-started";

export interface JobType {
  id: JobTypeId;
  label: string;
  /** Why this job might not apply to every vehicle. Shown in the UI. */
  appliesTo: (v: Vehicle) => boolean;
  /**
   * Overrides the label for one vehicle. Same job, different word: a drum-
   * braked truck needs "Rear Brake Shoes", not "Rear Brake Pads".
   */
  labelFor?: (v: Vehicle) => string;
  /** Set when a job is universal, so the UI can explain exclusions honestly. */
  exclusionNote?: string;
}

// --- vehicle classification -------------------------------------------------
//
// These read the free-text engine/drivetrain strings because the Vehicle type
// has no structured fuel-type or driveline field yet. That is a deliberate
// stopgap, not a design: when an EV actually enters the catalog, replacing
// these with a real field is the right fix, and the whole report keys off
// these three functions so it is a small change.

/** Battery-electric only. A hybrid still has an engine, oil and plugs. */
export function isElectric(v: Vehicle): boolean {
  const s = `${v.engine} ${v.trim}`.toLowerCase();
  if (/\bhybrid\b|\bphev\b|plug-in hybrid/.test(s)) return false;
  return /\belectric\b|\bbev\b|\bkwh\b|\bev\b|dual motor|single motor/.test(s);
}

/**
 * True when the PCV function is cast into the valve cover rather than being a
 * replaceable valve, which puts the job on the disassemble-and-reseal side of
 * our scope line: you cannot service it without pulling and resealing the
 * cover. GM's Gen V small block (EcoTec3 L83/L84/L86/L87) is the case that
 * forced this - same ruling that took spark plugs off the 3.6 Pentastar.
 */
export function hasIntegratedPcv(v: Vehicle): boolean {
  return /ecotec3/i.test(v.engine);
}

/**
 * True when the rear brakes are drums rather than discs.
 *
 * Reads the vehicle's own declared rearBrakes field rather than guessing from
 * free text, because there is no free text to guess from - nothing in the
 * engine or drivetrain string tells you what is at the back. Omitted means
 * disc, which is the common case.
 */
export function hasRearDrums(v: Vehicle): boolean {
  return v.rearBrakes === "drum";
}

export function isDiesel(v: Vehicle): boolean {
  return /diesel|duramax|powerstroke|power stroke|ecodiesel|cummins|tdi/i.test(v.engine);
}

/** True when there is no separately serviceable differential or transfer case. */
export function isFrontWheelDrive(v: Vehicle): boolean {
  return /^fwd\b|front-wheel|front wheel/i.test(v.drivetrain.trim());
}

// --- the catalog ------------------------------------------------------------
//
// Mirrors the approved "do cover" list in the coverage-scope project doc.
// Keep them in step: adding a row here raises the target for every applicable
// vehicle and will surface as newly-missing work, which is the intended
// behaviour but should follow a product decision rather than precede one.

export const JOB_CATALOG: JobType[] = [
  { id: "oil-change", label: "Engine Oil & Filter Change", appliesTo: (v) => !isElectric(v), exclusionNote: "Not applicable to EVs" },
  { id: "tire-rotation", label: "Tire Rotation", appliesTo: () => true },
  { id: "brake-pads-front", label: "Front Brake Pads", appliesTo: () => true },
  {
    id: "brake-pads-rear",
    label: "Rear Brake Pads",
    labelFor: (v) => (hasRearDrums(v) ? "Rear Brake Shoes" : "Rear Brake Pads"),
    appliesTo: () => true,
  },
  { id: "battery", label: "Battery Replacement", appliesTo: () => true },
  { id: "engine-air-filter", label: "Engine Air Filter", appliesTo: (v) => !isElectric(v), exclusionNote: "Not applicable to EVs" },
  { id: "cabin-air-filter", label: "Cabin Air Filter", appliesTo: () => true },
  { id: "wiper-blades", label: "Wiper Blades", appliesTo: () => true },
  { id: "coolant", label: "Coolant Flush & Fill", appliesTo: (v) => !isElectric(v), exclusionNote: "Not applicable to EVs" },
  {
    id: "driveline-fluid",
    label: "Differential / Transfer Case Fluid",
    appliesTo: (v) => !isFrontWheelDrive(v),
    exclusionNote: "FWD vehicles have no separately serviceable differential",
  },
  { id: "serpentine-belt", label: "Serpentine Belt", appliesTo: (v) => !isElectric(v), exclusionNote: "Not applicable to EVs" },
  { id: "fluid-checks", label: "Fluid Checks & Top-Offs", appliesTo: () => true },
  { id: "fuse-bulb", label: "Fuse & Bulb Replacement", appliesTo: () => true },
  {
    id: "pcv-valve",
    label: "PCV Valve",
    appliesTo: (v) => !isElectric(v) && !hasIntegratedPcv(v),
    exclusionNote:
      "Not applicable to EVs, and not serviceable on engines whose PCV is cast into the valve cover",
  },
  { id: "o2-sensor", label: "Oxygen Sensor", appliesTo: (v) => !isElectric(v), exclusionNote: "Not applicable to EVs" },
  { id: "key-fob-battery", label: "Key Fob Battery", appliesTo: () => true },
];

export const JOB_LABELS: Record<JobTypeId, string> = JOB_CATALOG.reduce(
  (acc, j) => ({ ...acc, [j.id]: j.label }),
  {} as Record<JobTypeId, string>
);

// --- per-vehicle ------------------------------------------------------------

/**
 * An applicable job whose PROCEDURE already exists - a shared guide fits this
 * vehicle on platform, engine or driveline - but whose NUMBERS have not been
 * verified for it yet, so the guide does not render.
 *
 * This is deliberately a subset of missing rather than a third bucket: it is
 * not done, and it must not move the percentage. What it changes is the size
 * of the job in front of you. A pending job is an afternoon of table lookups
 * against two sources. A plain missing job is a guide to research and write.
 * A planner that cannot tell those apart is not much of a planner.
 */
export interface PendingJob {
  job: JobType;
  /** The shared guide waiting on this vehicle's figures. */
  guideId: string;
}

export interface VehicleCoverage {
  vehicle: Vehicle;
  label: string;
  /** Jobs that apply to this vehicle. */
  target: number;
  /** Applicable jobs that have a guide. */
  done: number;
  remaining: number;
  /** 0-100, rounded. 100 only when remaining is genuinely 0. */
  pct: number;
  status: CoverageStatus;
  built: { job: JobType; guide: RepairGuide }[];
  missing: JobType[];
  /** Subset of missing: procedure written, numbers not yet verified. */
  pending: PendingJob[];
  /** Jobs skipped for this vehicle, with the reason. Not counted anywhere. */
  notApplicable: JobType[];
  freeGuides: number;
  premiumGuides: number;
}

// getPendingFitment walks every vehicle against every authored guide, so it is
// resolved once and reused rather than recomputed per vehicle in listCoverage.
let pendingCache: ReturnType<typeof getPendingFitment> | null = null;
function pendingFor(vehicleId: string) {
  if (!pendingCache) pendingCache = getPendingFitment();
  return pendingCache.filter((p) => p.vehicleId === vehicleId);
}

export function getVehicleCoverage(vehicle: Vehicle, guides: RepairGuide[]): VehicleCoverage {
  const mine = guides.filter((g) => g.vehicleId === vehicle.id);
  const byJob = new Map<string, RepairGuide>();
  for (const g of mine) if (g.jobType) byJob.set(g.jobType, g);

  // Resolve any per-vehicle label override once, here, where the vehicle is
  // known. Everything downstream keeps reading job.label and gets the right
  // word without needing to know why.
  const resolve = (j: JobType): JobType =>
    j.labelFor ? { ...j, label: j.labelFor(vehicle) } : j;
  const applicable = JOB_CATALOG.filter((j) => j.appliesTo(vehicle)).map(resolve);
  const notApplicable = JOB_CATALOG.filter((j) => !j.appliesTo(vehicle)).map(resolve);

  const pendingByJob = new Map<string, string>();
  for (const p of pendingFor(vehicle.id)) {
    if (p.jobType) pendingByJob.set(p.jobType, p.guideId);
  }

  const built: { job: JobType; guide: RepairGuide }[] = [];
  const missing: JobType[] = [];
  const pending: PendingJob[] = [];
  for (const job of applicable) {
    const g = byJob.get(job.id);
    if (g) {
      built.push({ job, guide: g });
      continue;
    }
    // Still missing either way - a pending job is NOT done and must not move
    // the percentage. It is only cheaper to finish than a blank one.
    missing.push(job);
    const guideId = pendingByJob.get(job.id);
    if (guideId) pending.push({ job, guideId });
  }

  const target = applicable.length;
  const done = built.length;
  const remaining = target - done;

  return {
    vehicle,
    label: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
    target,
    done,
    remaining,
    pct: target === 0 ? 0 : Math.round((done / target) * 100),
    status: remaining === 0 ? "complete" : done === 0 ? "not-started" : "in-progress",
    built,
    missing,
    pending,
    notApplicable,
    freeGuides: mine.filter((g) => g.tier === "free").length,
    premiumGuides: mine.filter((g) => g.tier === "premium").length,
  };
}

export function listCoverage(): VehicleCoverage[] {
  const guides = allRepairs();
  return listVehicles().map((v) => getVehicleCoverage(v, guides));
}

// --- overall ----------------------------------------------------------------

export interface CoverageSummary {
  vehicles: number;
  /** Sum of every vehicle's applicable-job count. */
  targetGuides: number;
  builtGuides: number;
  remainingGuides: number;
  pct: number;
  vehiclesComplete: number;
  vehiclesInProgress: number;
  vehiclesNotStarted: number;
  /** Guides in the data file with no jobType -- they count toward nothing. */
  unclassifiedGuides: RepairGuide[];
  /** Which job is missing on the most vehicles. The highest-leverage next build. */
  biggestGap: { job: JobType; missingOn: number } | null;
}

export function getCoverageSummary(rows: VehicleCoverage[] = listCoverage()): CoverageSummary {
  const targetGuides = rows.reduce((n, r) => n + r.target, 0);
  const builtGuides = rows.reduce((n, r) => n + r.done, 0);

  const missingCounts = new Map<JobTypeId, number>();
  for (const r of rows) for (const j of r.missing) missingCounts.set(j.id, (missingCounts.get(j.id) ?? 0) + 1);

  let biggestGap: CoverageSummary["biggestGap"] = null;
  for (const [id, n] of missingCounts) {
    if (!biggestGap || n > biggestGap.missingOn) {
      const job = JOB_CATALOG.find((j) => j.id === id);
      if (job) biggestGap = { job, missingOn: n };
    }
  }

  return {
    vehicles: rows.length,
    targetGuides,
    builtGuides,
    remainingGuides: targetGuides - builtGuides,
    pct: targetGuides === 0 ? 0 : Math.round((builtGuides / targetGuides) * 100),
    vehiclesComplete: rows.filter((r) => r.status === "complete").length,
    vehiclesInProgress: rows.filter((r) => r.status === "in-progress").length,
    vehiclesNotStarted: rows.filter((r) => r.status === "not-started").length,
    unclassifiedGuides: allRepairs().filter((g) => !g.jobType),
    biggestGap,
  };
}

// --- filtering --------------------------------------------------------------

export interface CoverageFilters {
  year?: string;
  make?: string;
  model?: string;
  status?: string;
  job?: string;
}

export function applyFilters(rows: VehicleCoverage[], f: CoverageFilters): VehicleCoverage[] {
  let out = rows;
  if (f.year) out = out.filter((r) => String(r.vehicle.year) === f.year);
  if (f.make) out = out.filter((r) => r.vehicle.make === f.make);
  if (f.model) out = out.filter((r) => r.vehicle.model === f.model);
  if (f.status && f.status !== "all") out = out.filter((r) => r.status === f.status);
  // Filtering by job answers "which vehicles still need X" -- the question you
  // ask right before deciding what to build next.
  if (f.job && f.job !== "all") out = out.filter((r) => r.missing.some((j) => j.id === f.job));
  return out;
}

/**
 * Options for the filter selects, narrowed by the choices already made so the
 * dropdowns never offer a combination that returns nothing.
 */
export function getFilterOptions(rows: VehicleCoverage[], f: CoverageFilters) {
  const years = [...new Set(rows.map((r) => r.vehicle.year))].sort((a, b) => b - a);

  const forMakes = f.year ? rows.filter((r) => String(r.vehicle.year) === f.year) : rows;
  const makes = [...new Set(forMakes.map((r) => r.vehicle.make))].sort();

  const forModels = forMakes.filter((r) => !f.make || r.vehicle.make === f.make);
  const models = [...new Set(forModels.map((r) => r.vehicle.model))].sort();

  return { years, makes, models };
}

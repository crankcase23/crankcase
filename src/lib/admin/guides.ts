import { allRepairs, listVehicles, findVehicle } from "@/lib/data";
import type { ResolvedGuide, Vehicle } from "@/types/vehicle";

// ---------------------------------------------------------------------------
// Guide console.
//
// WHY THIS IS READ-ONLY OVER CODE, not a database CMS:
//
// Repair guides live in src/data/repairs.ts, under version control. That is
// the right place for them -- torque specs are safety-relevant content, and
// git gives every change a diff, an author, a review point and a one-command
// rollback. Moving them into Postgres so an editor could exist would mean
// rewriting how every user-facing vehicle and repair page loads its content,
// which is the highest-risk change available in this codebase, for a workflow
// benefit of one person editing their own content.
//
// So instead: this module reads the real guide data and answers the questions
// an editor would have answered. What exists, what's thin, what's missing
// required fields, what's safe to consider published. Publishing still means
// committing to git -- and the validation below is the checklist to clear
// before you do.
// ---------------------------------------------------------------------------

export type GuideStatus = "published" | "incomplete" | "draft";

export interface ValidationIssue {
  field: string;
  message: string;
  severity: "required" | "recommended";
}

export interface GuideRecord {
  guide: ResolvedGuide;
  vehicle: Vehicle | undefined;
  vehicleLabel: string;
  status: GuideStatus;
  issues: ValidationIssue[];
  requiredMissing: number;
  recommendedMissing: number;
  /** 0-100 completeness against the full Crankcase guide structure. */
  completeness: number;
  stepCount: number;
  torqueCount: number;
  illustratedSteps: number;
  realDataSpecs: number;
}

// The full Crankcase guide structure, with which parts are non-negotiable
// before a guide should be considered publishable. "required" items block
// publish; "recommended" items are quality gaps worth seeing but not blocking.
const CHECKS: {
  field: string;
  severity: "required" | "recommended";
  test: (g: ResolvedGuide) => boolean;
  message: string;
}[] = [
  { field: "title", severity: "required", test: (g) => g.title.trim().length > 3, message: "Guide needs a title." },
  { field: "summary", severity: "required", test: (g) => g.summary.trim().length > 20, message: "Summary is missing or too short to be useful." },
  { field: "difficulty", severity: "required", test: (g) => Boolean(g.difficulty), message: "Difficulty rating not set." },
  { field: "estTime", severity: "required", test: (g) => g.estTime.trim().length > 0, message: "Estimated time not set." },
  { field: "tools", severity: "required", test: (g) => g.tools.length > 0, message: "No tools listed — a DIY user can't prepare." },
  { field: "parts", severity: "required", test: (g) => g.parts.length > 0, message: "No parts or supplies listed." },
  { field: "safety", severity: "required", test: (g) => g.safety.length > 0, message: "No safety warnings. Required on every guide." },
  { field: "steps", severity: "required", test: (g) => g.steps.length >= 3, message: "Fewer than 3 steps — procedure looks incomplete." },
  {
    field: "torqueSpecs",
    severity: "required",
    // Torque specs are the core of the product, so a guide without them is
    // normally incomplete. The exception is a job with no torqued fastener at
    // all -- wiper blades, cabin and engine air filters. Those declare
    // noFasteners and are exempt from this one check only. See ResolvedGuide.
    test: (g) => g.noFasteners === true || g.torqueSpecs.length > 0,
    message: "No torque specifications. This is the core of the product.",
  },
  {
    field: "stepDetail",
    severity: "recommended",
    test: (g) => g.steps.every((s) => s.instructions.trim().length > 40),
    message: "One or more steps have very short instructions.",
  },
  {
    field: "stepImages",
    severity: "recommended",
    test: (g) => g.steps.filter((s) => s.image).length >= Math.ceil(g.steps.length / 2),
    message: "Fewer than half the steps have an illustration.",
  },
  {
    field: "provenance",
    severity: "recommended",
    // A fastener-free guide has nothing to source, so flagging it here would
    // be permanent noise on the Build Queue rather than a real gap.
    test: (g) => g.noFasteners === true || g.torqueSpecs.some((t) => t.provenance?.source === "open-labor-project"),
    message: "No torque spec is backed by real sourced data — all hand-typed.",
  },
  {
    field: "fluids",
    severity: "recommended",
    test: (g) => {
      const v = findVehicle(g.vehicleId);
      return (v?.fluids.length ?? 0) > 0;
    },
    message: "Parent vehicle has no fluid capacities recorded.",
  },
];

export function validateGuide(guide: ResolvedGuide): ValidationIssue[] {
  return CHECKS.filter((c) => !c.test(guide)).map((c) => ({
    field: c.field,
    message: c.message,
    severity: c.severity,
  }));
}

export function buildGuideRecord(guide: ResolvedGuide): GuideRecord {
  const vehicle = findVehicle(guide.vehicleId);
  const issues = validateGuide(guide);
  const requiredMissing = issues.filter((i) => i.severity === "required").length;
  const recommendedMissing = issues.filter((i) => i.severity === "recommended").length;

  const passed = CHECKS.length - issues.length;
  const completeness = Math.round((passed / CHECKS.length) * 100);

  // A guide is live the moment it's in the data file, so "published" is the
  // honest status for anything complete. Anything failing a required check is
  // live-but-incomplete, which is exactly what the admin needs flagged.
  const status: GuideStatus = requiredMissing > 0 ? "incomplete" : "published";

  return {
    guide,
    vehicle,
    vehicleLabel: vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : guide.vehicleId,
    status,
    issues,
    requiredMissing,
    recommendedMissing,
    completeness,
    stepCount: guide.steps.length,
    torqueCount: guide.torqueSpecs.length,
    illustratedSteps: guide.steps.filter((s) => s.image).length,
    realDataSpecs: guide.torqueSpecs.filter((t) => t.provenance?.source === "open-labor-project").length,
  };
}

export function listGuideRecords(): GuideRecord[] {
  return allRepairs().map(buildGuideRecord);
}

export function findGuideRecord(id: string): GuideRecord | undefined {
  const guide = allRepairs().find((g) => g.id === id);
  return guide ? buildGuideRecord(guide) : undefined;
}

export interface GuideSummary {
  total: number;
  complete: number;
  incomplete: number;
  free: number;
  premium: number;
  averageCompleteness: number;
  vehiclesTotal: number;
  vehiclesWithGuides: number;
  vehiclesWithoutGuides: Vehicle[];
  vehiclesWithoutFreeGuide: Vehicle[];
  totalSteps: number;
  totalTorqueSpecs: number;
  realDataSpecs: number;
}

export function getGuideSummary(): GuideSummary {
  const records = listGuideRecords();
  const vehicles = listVehicles();

  const vehiclesWithGuides = new Set(records.map((r) => r.guide.vehicleId));
  const vehiclesWithFree = new Set(records.filter((r) => r.guide.tier === "free").map((r) => r.guide.vehicleId));

  return {
    total: records.length,
    complete: records.filter((r) => r.status === "published").length,
    incomplete: records.filter((r) => r.status === "incomplete").length,
    free: records.filter((r) => r.guide.tier === "free").length,
    premium: records.filter((r) => r.guide.tier === "premium").length,
    averageCompleteness:
      records.length === 0
        ? 0
        : Math.round(records.reduce((sum, r) => sum + r.completeness, 0) / records.length),
    vehiclesTotal: vehicles.length,
    vehiclesWithGuides: vehiclesWithGuides.size,
    vehiclesWithoutGuides: vehicles.filter((v) => !vehiclesWithGuides.has(v.id)),
    // The business model rests on every vehicle having one free hook guide.
    vehiclesWithoutFreeGuide: vehicles.filter((v) => !vehiclesWithFree.has(v.id)),
    totalSteps: records.reduce((s, r) => s + r.stepCount, 0),
    totalTorqueSpecs: records.reduce((s, r) => s + r.torqueCount, 0),
    realDataSpecs: records.reduce((s, r) => s + r.realDataSpecs, 0),
  };
}

// --- catalog vehicle data-quality ------------------------------------------

export interface VehicleDataIssue {
  vehicleId: string;
  label: string;
  issues: string[];
}

/** Data-integrity problems in the curated catalog (src/data/vehicles.ts). */
export function getCatalogDataIssues(): VehicleDataIssue[] {
  const out: VehicleDataIssue[] = [];
  const guidesByVehicle = new Map<string, ResolvedGuide[]>();
  for (const g of allRepairs()) {
    const list = guidesByVehicle.get(g.vehicleId) ?? [];
    list.push(g);
    guidesByVehicle.set(g.vehicleId, list);
  }

  for (const v of listVehicles()) {
    const issues: string[] = [];
    if (v.specs.length === 0) issues.push("No vehicle specifications");
    if (v.fluids.length === 0) issues.push("No fluid capacities");
    if (!v.engine) issues.push("No engine recorded");
    if (!v.drivetrain) issues.push("No drivetrain recorded");

    const guides = guidesByVehicle.get(v.id) ?? [];
    if (guides.length === 0) issues.push("No repair guides");
    else if (!guides.some((g) => g.tier === "free")) issues.push("No free guide (breaks the freemium hook)");

    const hasRealFluidData = v.fluids.some((f) => f.provenance?.source === "open-labor-project");
    if (v.fluids.length > 0 && !hasRealFluidData) issues.push("All fluid data is hand-typed, none sourced");

    if (issues.length > 0) {
      out.push({ vehicleId: v.id, label: `${v.year} ${v.make} ${v.model}`, issues });
    }
  }
  return out;
}

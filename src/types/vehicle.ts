// Core data model for the DIY Mechanic app.
// Keeping this as a small, well-typed layer makes it easy to later swap
// the JSON data files for a real database or external API without
// touching any page/component code — everything reads through src/lib/data.ts.

export interface Tool {
  name: string;
  note?: string;
}

// Where a value came from, and how much to trust it. "curated" is our own
// hand-typed reference figures (today's default — see DataDisclaimer).
// "open-labor-project" is real sourced data pulled from their API once we're
// wired up; "confidence" passes through their own rating (e.g. "oem_verified")
// so the UI can eventually show provenance per-value instead of one blanket
// warning banner for the whole page.
export type DataSource = "curated" | "open-labor-project";

export interface Provenance {
  source: DataSource;
  confidence?: string; // e.g. "oem_verified" — only meaningful for open-labor-project
}

export interface TorqueSpec {
  fastener: string;
  value: string; // e.g. "20 ft-lb (27 Nm)"
  notes?: string;
  provenance?: Provenance;
}

export interface FluidCapacity {
  name: string; // e.g. "Engine Oil"
  capacity: string; // e.g. "5.7 qt (5.4 L) with filter"
  spec: string; // e.g. "0W-20 API SN synthetic"
  notes?: string;
  provenance?: Provenance;
}

export interface SpecItem {
  label: string;
  value: string;
}

export interface RepairStep {
  number: number;
  title: string;
  instructions: string;
  image?: string; // path under /public
  torque?: TorqueSpec[];
  warning?: string;
}

export type Difficulty = "Easy" | "Moderate" | "Advanced";

// Freemium gating: every vehicle's specs + fluid capacities are always free.
// Each vehicle gets one "free" guide (the simple hook — an oil change) and
// the rest are "premium", unlocked per-vehicle once payments exist. No
// enforcement lives here yet (see build notes) — this field just drives the
// Free/Premium badges so the model is visible before it's wired up.
export type ContentTier = "free" | "premium";

export interface RepairGuide {
  id: string;
  vehicleId: string;
  title: string;
  summary: string;
  difficulty: Difficulty;
  estTime: string;
  tier: ContentTier;
  tools: Tool[];
  parts: string[];
  safety: string[];
  torqueSpecs: TorqueSpec[];
  steps: RepairStep[];
}

export interface Vehicle {
  id: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  engine: string;
  drivetrain: string;
  transmission: string;
  image?: string;
  specs: SpecItem[];
  fluids: FluidCapacity[];
}

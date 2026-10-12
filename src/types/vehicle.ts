// Core data model for the DIY Mechanic app.
// Keeping this as a small, well-typed layer makes it easy to later swap
// the JSON data files for a real database or external API without
// touching any page/component code — everything reads through src/lib/data.ts.

// ---------------------------------------------------------------------------
// Vehicle configuration (platform-wide).
//
// Two build facts decide which procedure variant, parts, fluids and torque
// figures are right for a particular car: its transmission and its drivetrain.
// The customer confirms both when they add a vehicle (or later, via Edit
// Configuration) and the choice is stored on their garage entry. Guide content
// that depends on either axis carries a `forConfig` scope; src/lib/guideConfig.ts
// resolves a guide against the saved configuration. See src/lib/vehicleConfig.ts.
// ---------------------------------------------------------------------------

export type TransmissionKind = "automatic" | "manual" | "cvt" | "dct";
export type DrivetrainKind = "fwd" | "rwd" | "awd" | "4wd" | "2wd";
export type ConfigAxis = "transmission" | "drivetrain";

/**
 * Which builds a piece of guide content applies to. An omitted axis means "every
 * value" (the content does not depend on that axis). Present means ONLY those
 * values. A scope that names an axis the customer has not confirmed cannot be
 * decided, so the content is restricted until they confirm it.
 */
export interface ConfigScope {
  transmission?: TransmissionKind[];
  drivetrain?: DrivetrainKind[];
}

/** A part or fluid line whose presence depends on the build (plain parts stay in `parts`). */
export interface ConfigPart {
  text: string;
  forConfig: ConfigScope;
}

export interface Tool {
  name: string;
  note?: string;
  /** Only show this tool when one of these variant option ids is selected. */
  onlyFor?: string[];
  /** Only for these transmission / drivetrain builds (see ConfigScope). */
  forConfig?: ConfigScope;
}

/**
 * One answer to a variant question, e.g. "10-bolt cover (8.6-inch axle)".
 *
 * Variants exist for one reason: some facts a reader needs depend on how their
 * particular truck was built, and the ones that matter are the ones that change
 * WHAT THEY BUY or WHAT THEY TORQUE. Cab length and trim do not qualify; rear
 * axle size does, because it decides how much gear oil ends up in the cart.
 */
export interface GuideVariantOption {
  id: string;
  label: string;
  /** Optional nudge, e.g. "Most 5.3L LT trucks". */
  hint?: string;
}

export interface GuideVariantGroup {
  id: string;
  /** The question put to the reader, e.g. "Which rear axle do you have?" */
  question: string;
  /** How to tell, with no special tools and without taking anything apart. */
  howToTell: string;
  options: GuideVariantOption[];
}

/** A part whose presence or quantity depends on a variant answer. */
export interface VariantPart {
  text: string;
  onlyFor: string[];
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
  /** Only show this figure when one of these variant option ids is selected. */
  onlyFor?: string[];
  /** Only for these transmission / drivetrain builds (see ConfigScope). */
  forConfig?: ConfigScope;
}

export interface FluidCapacity {
  name: string; // e.g. "Engine Oil"
  capacity: string; // e.g. "5.7 qt (5.4 L) with filter"
  spec: string; // e.g. "0W-20 API SN synthetic"
  notes?: string;
  provenance?: Provenance;
  /** Only for these transmission / drivetrain builds (see ConfigScope). */
  forConfig?: ConfigScope;
}

export interface SpecItem {
  label: string;
  value: string;
  /**
   * Marks this row as the vehicle's transmission or drivetrain. Shown to a customer who has confirmed it as THEIR
   * confirmed value; until then it says what is still to be confirmed. Without this a catalog row can only describe
   * the model in general, and a general sentence ("might be RWD or xDrive") must not outlive the customer's answer.
   */
  configAxis?: ConfigAxis;
}

export interface RepairStep {
  number: number;
  title: string;
  instructions: string;
  image?: string; // path under /public
  torque?: TorqueSpec[];
  warning?: string;
  /**
   * Marks a step that only applies when the rotors are being replaced as well
   * as the pads. The guide page hides these when the reader says pads-only and
   * renumbers what is left, so nobody is ever told to skip a range of numbers.
   */
  rotorsOnly?: boolean;
  /** Only show this step when one of these variant option ids is selected. */
  onlyFor?: string[];
  /**
   * Only for these transmission / drivetrain builds (see ConfigScope). A step for
   * another build is removed and the rest renumbered; a step whose axis is not
   * confirmed yet is restricted (title kept, instructions withheld) until it is.
   */
  forConfig?: ConfigScope;
}

export type Difficulty = "Easy" | "Moderate" | "Advanced";

// Freemium gating: every vehicle's specs + fluid capacities are always free.
// Each vehicle gets one "free" guide (the simple hook — an oil change) and
// the rest are "premium", unlocked per-vehicle once payments exist. No
// enforcement lives here yet (see build notes) — this field just drives the
// Free/Premium badges so the model is visible before it's wired up.
export type ContentTier = "free" | "premium";

/**
 * The service jobs Crankcase Garage covers, as approved in the coverage-scope
 * doc. This is the vocabulary the coverage report counts against: a vehicle's
 * target is the subset of these that applies to it, and its progress is how
 * many of those it actually has a guide for.
 *
 * Adding a job here is a product decision, not a code one -- it raises the
 * target for every applicable vehicle in the catalog and will show up as
 * newly-missing work on the Coverage tab. Check the coverage-scope doc before
 * adding one, and set its applicability in src/lib/admin/coverage.ts.
 */
export type JobTypeId =
  | "oil-change"
  | "tire-rotation"
  | "engine-air-filter"
  | "cabin-air-filter"
  | "wiper-blades"
  | "battery"
  | "brake-pads-front"
  | "brake-pads-rear"
  | "coolant"
  | "driveline-fluid"
  | "serpentine-belt"
  | "spark-plugs"
  | "fluid-checks"
  | "fuse-bulb"
  | "pcv-valve"
  | "o2-sensor"
  | "key-fob-battery";

/**
 * FITMENT - how a guide's PROCEDURE is shared across vehicles.
 *
 * The unit of sharing is never "the vehicle", and it is never "the engine" on
 * its own either. It is whichever key actually decides the procedure FOR THAT
 * JOB:
 *
 *   engine     oil, spark plugs, PCV, engine air filter, belt, coolant
 *   platform   brakes, tire rotation, battery, cabin filter, wipers, fuse/bulb
 *   driveline  transfer case, front and rear differential
 *
 * A 2020 Silverado and a 2020 Sierra share every one of these - same T1XX
 * platform, same L84, same 8L80. A 2018 and a 2020 Silverado share none of
 * them, despite both being "a 5.3L V8": different generation, different engine
 * RPO. Keying on displacement would have shipped L83 figures to an L84 truck.
 */
export interface GuideFitment {
  on: "platform" | "engine" | "driveline";
  key: string;
  /** Inclusive model-year window, for when the key alone is too broad. */
  years?: [number, number];
  /** Vehicle ids that match the key but must NOT receive this guide. */
  except?: string[];
}

/**
 * The numbers for ONE vehicle, bound to a shared procedure at resolve time.
 *
 * This is the safety gate of the entire fitment system. Procedure text is free
 * to inherit. Torque, capacity and part numbers NEVER are. A shared guide with
 * no figures entry for a vehicle does not render for that vehicle at all - it
 * does not quietly fall back to the donor truck's numbers, because that is
 * exactly how someone ends up torquing a fastener to a figure that belongs to
 * a different axle.
 *
 * verified is typed as the literal true rather than boolean so an entry cannot
 * be added at all without asserting that the two-source check from the build
 * playbook was actually carried out for this specific vehicle.
 */
export interface GuideFigures {
  /** Public guide id for this vehicle. Keeps URLs stable and readable. */
  id: string;
  verified: true;
  torqueSpecs: TorqueSpec[];
  parts: string[];
  variantParts?: VariantPart[];
  /** Fills {{token}} slots in the shared step text for this vehicle. */
  slots?: Record<string, string>;
}

export interface RepairGuide {
  id: string;
  /**
   * Set only on a guide written for one specific vehicle. This is the legacy
   * shape, and it stays correct for a genuinely one-off procedure. A shared
   * guide leaves this unset and carries fitment instead - the resolver fills
   * it in per vehicle as it binds that vehicle's figures.
   */
  vehicleId?: string;
  /**
   * Set instead of vehicleId when this procedure is shared. Every vehicle
   * whose keys match receives it, but ONLY if figures holds a verified entry
   * for that vehicle. A key match with no figures resolves to nothing at all,
   * deliberately - see GuideFigures.
   */
  fitment?: GuideFitment;
  /** Per-vehicle numbers, keyed by vehicle id. Required alongside fitment. */
  figures?: Record<string, GuideFigures>;
  title: string;
  summary: string;
  difficulty: Difficulty;
  estTime: string;
  tier: ContentTier;
  tools: Tool[];
  /**
   * Required on a guide bound to one vehicleId. Omitted on a shared guide,
   * where the parts list is per-vehicle and lives in figures - the part that
   * fits a Silverado is described differently from the one that fits a Sierra
   * even when it is the same box off the same shelf.
   */
  parts?: string[];
  safety: string[];
  /**
   * Same rule as parts. Omitted on a shared guide, because a torque figure is
   * the single most dangerous thing in this codebase to inherit by accident.
   * See GuideFigures.
   */
  torqueSpecs?: TorqueSpec[];
  steps: RepairStep[];
  /**
   * Set on the small number of approved jobs that genuinely have no torqued
   * fastener anywhere in the procedure — wiper blades snap onto an arm, cabin
   * and engine air filters sit behind clips or a single trim screw.
   *
   * The guide console treats a missing torque spec as a publish-blocking
   * error, which is correct for every job that bolts something to the car and
   * wrong for these. This flag turns that one check off for the guide, and
   * nothing else. It is NOT a way to ship a fastener job without its specs:
   * if the procedure torques anything at all, this stays unset.
   */
  noFasteners?: boolean;
  /**
   * Set on a brake guide that covers both the pads-only and the pads-and-rotors
   * path. Turns on the rotor toggle at the top of the step list; steps marked
   * rotorsOnly are shown or hidden by it.
   */
  hasRotorOption?: boolean;
  /**
   * Questions about how this particular vehicle was built, asked ABOVE the
   * parts list because the whole point is to answer them before the parts run
   * rather than while lying under the truck on stands.
   *
   * Only add a group when the answer changes what the reader buys or what they
   * torque. Nothing is hidden until a question is answered - an unanswered
   * guide still shows every option, tagged with which build it applies to.
   */
  variants?: GuideVariantGroup[];
  /**
   * Parts whose presence or quantity depends on a variant answer. Kept
   * separate from `parts` so that field stays a plain string[] for the admin
   * console and the guide validator.
   */
  variantParts?: VariantPart[];
  /**
   * UNCERTIFIED PREVIEW. A guide that is readable by every customer but is not
   * finished: some facts are unverified and some steps are blocked. It is never
   * gated, never sold, and never counted as paid content, whatever its `tier`
   * says. `tier` is the tier the guide will have once certified, which is what
   * keeps it compatible with the Get the Keys model; this flag is what keeps a
   * customer from being charged for it meanwhile. Anything that grants or
   * charges for premium access must go through isSellable() in
   * src/lib/guideAccess.ts, never read `tier` directly.
   */
  preview?: boolean;
  /**
   * Render this guide with the Overall Guide + Wrench Mode experience on the
   * customer page instead of the plain full guide. Opt-in per guide so every
   * other vehicle's guide pages stay exactly as they were.
   */
  wrenchMode?: boolean;
  /**
   * Parts and fluids that only apply to some builds. Kept apart from `parts`
   * (like variantParts) so that field stays a plain string[]. Resolved against
   * the customer's saved configuration by resolveGuideForConfig().
   */
  configParts?: ConfigPart[];
  /**
   * The builds the evidence behind this guide actually covers. An omitted axis
   * means the evidence says the job does not depend on that axis. A customer
   * whose CONFIRMED configuration is outside this scope is not shown the guide's
   * procedure: it was never researched for their build, and this guide does not
   * guess. (The guide still exists as a category, with a plain explanation.)
   * An unconfirmed axis shows the guide with a confirm-your-configuration prompt.
   */
  evidenceFor?: ConfigScope;
  /** One plain sentence on why evidenceFor is what it is. Shown in the refusal. */
  evidenceNote?: string;
  /**
   * Which covered service job this guide satisfies. Drives the Coverage tab.
   *
   * Optional so a guide is never rejected for lacking it, but a guide without
   * one counts toward nothing -- the Coverage report lists unclassified guides
   * explicitly rather than quietly ignoring them, so the gap stays visible.
   * Matching on title instead was considered and rejected: a retitled guide
   * would silently stop counting.
   */
  jobType?: JobTypeId;
}

/**
 * A guide AFTER fitment resolution: always bound to exactly one vehicle, with
 * that vehicle's own verified numbers already substituted in.
 *
 * Everything user-facing and everything in the admin console reads this shape
 * rather than the authored one. An authored shared guide has no vehicleId at
 * all, so asking it which vehicle it belongs to is a question with no answer -
 * this type is how that distinction stays in the compiler instead of in
 * somebody's memory.
 */
export type ResolvedGuide = RepairGuide & {
  vehicleId: string;
  parts: string[];
  torqueSpecs: TorqueSpec[];
};

/**
 * What makes two vehicles "the same" for the purpose of reusing a procedure.
 *
 * Three separate axes, because any given job inherits on one of them and not
 * the others. A Silverado and a Sierra share a platform AND an engine. A
 * Silverado 5.3 and a Silverado 6.2 share a platform but not an engine. A
 * 4WD and a 2WD of the same truck share both and not the driveline.
 */
export interface VehicleKeys {
  /** Body/chassis generation, e.g. "gm-t1xx-1500", "jeep-wk2". */
  platform: string;
  /** Engine family AND generation, e.g. "gm-ecotec3-l84". Never "5.3l". */
  engine: string;
  /** Driveline option set, e.g. "gm-t1xx-4wd". Omit where nothing shares it. */
  driveline?: string;
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
  /**
   * Fitment keys. These are what let one written procedure serve every vehicle
   * it genuinely fits, rather than being re-researched per truck. See
   * GuideFitment for which key governs which job.
   *
   * Optional so an untagged vehicle still works - it simply receives only the
   * guides written directly against its id.
   */
  keys?: VehicleKeys;
  /**
   * Rear brake type. Omitted means disc, which is the common case.
   *
   * This exists because the job is the same job either way - remove the
   * friction material, fit new, adjust - but the READER needs the right word.
   * A Tacoma owner told to replace his rear "pads" will go looking for a
   * caliper he does not have. Set this to "drum" and the coverage report and
   * the guide catalog both say "shoes" instead.
   */
  rearBrakes?: "disc" | "drum";
  /**
   * The transmission and drivetrain builds this model/year really came in. The
   * Confirm Your Ride screen offers exactly these (plus Not sure) and never an
   * impossible one. Omitted on a vehicle whose catalog entry is itself the one
   * build: the options then come from the entry's own transmission/drivetrain
   * text (see configOptionsFor in src/lib/vehicleConfig.ts).
   */
  configSpec?: ConfigScope;
  image?: string;
  specs: SpecItem[];
  fluids: FluidCapacity[];
}

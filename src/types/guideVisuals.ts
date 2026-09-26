/**
 * Vehicle-specific instructional visuals for guide steps.
 *
 * RULES THIS MODEL ENFORCES (see lib/guideVisuals.ts):
 *  - A visual is bound to ONE application (year / make / model / engine). It is
 *    shown only when that application matches the vehicle of the guide being
 *    viewed. There is no generic or "close enough" image.
 *  - A visual is shown only when its provenance is marked "verified" by a
 *    human and names a real source. Unverified or pending images are never
 *    rendered.
 *  - Callouts (arrows/labels) are drawn only when a human has confirmed that
 *    each one points at the component it names (`calloutsVerified`).
 *  - A step with no verified visual simply has none. Nothing is substituted.
 */

/** The exact application an image depicts. Compared against the guide's vehicle. */
export interface VisualApplication {
  year: number;
  make: string;
  model: string;
  /** When present it must match the vehicle's trim. Omit only when trim is irrelevant to the component. */
  trim?: string;
  /** Engine string exactly as the Vehicle carries it, e.g. "3.6L Pentastar V6". */
  engine: string;
}

/**
 * Usage rights for the RAW source. "unknown" is never publishable.
 * "oem-authorized" means the OEM/publisher gave written permission to use the
 * material; a paid manual subscription alone is not that.
 */
export type LicenseStatus =
  | "owned"
  | "licensed"
  | "permission-granted"
  | "public-domain"
  | "oem-authorized"
  | "unknown";

/** Exactly what the Crankcase treatment did. Written by the pipeline, never by hand. */
export interface TreatmentRecord {
  version: string;
  /** Crop taken from the raw image, in raw pixels. */
  crop: { x: number; y: number; w: number; h: number };
  rawSize: { w: number; h: number };
  /** Operations applied, from a fixed whitelist that cannot change what a picture shows. */
  ops: string[];
  brightness: number;
  contrast: number;
}

export interface VisualProvenance {
  /** Only "verified" visuals are ever displayed. */
  status: "verified" | "pending";
  sourceType: "own-photo" | "licensed" | "oem-manual" | "other";
  /** Who/what produced the raw image. */
  source: string;
  /** URL, manual + page, or file reference that lets someone find the original. */
  sourceRef: string;
  license: { status: LicenseStatus; terms?: string };
  /** The component(s) the picture is about. */
  component: string;
  /** Why this raw image is known to be THIS application (VIN, badge, manual title, caption...). */
  vehicleEvidence: string;
  /** Vehicle/application check: who, when (yyyy-mm-dd). */
  verifiedBy?: string;
  verifiedOn?: string;
  /** Independent technical review of what the picture shows and says. */
  technicalReviewBy?: string;
  technicalReviewOn?: string;
  technicalReviewNotes?: string;
  capturedOn?: string;
  /**
   * A human checked that every callout tip sits on the component its label
   * names. Callouts are omitted (image only) unless this is true.
   */
  calloutsVerified?: boolean;
  calloutsVerifiedBy?: string;
  calloutsVerifiedOn?: string;
  /** Hashes tie the shipped file to the reviewed raw file; `visuals:check` verifies them. */
  rawSha256: string;
  finalSha256: string;
  treatment: TreatmentRecord;
}

/** A point on the image, in percent of its width / height (0-100, from top-left). */
export interface ImagePoint {
  x: number;
  y: number;
}

export interface VisualCallout {
  /** Text that names the component, e.g. "IAT connector". Shown on the image AND in the legend. */
  label: string;
  /** Where the arrow tip touches the component. */
  target: ImagePoint;
  /** Where the label pill is anchored (its center). The arrow runs label -> target. */
  labelAt: ImagePoint;
}

export interface GuideStepVisual {
  /** Unique within its guide. */
  id: string;
  /** Public path, under /guide-visuals/<application-slug>/. */
  src: string;
  /** Intrinsic pixel size; reserves the layout box so nothing jumps while loading. */
  width: number;
  height: number;
  /** Describes what the picture shows, for screen readers. */
  alt: string;
  /** Visible caption under the picture. */
  caption: string;
  callouts?: VisualCallout[];
  application: VisualApplication;
  provenance: VisualProvenance;
}

/** All visuals for one guide, keyed by canonical step number (RepairStep.number). */
export interface GuideVisualSet {
  guideId: string;
  application: VisualApplication;
  steps: Record<number, GuideStepVisual[]>;
}

/**
 * A step that WOULD benefit from a visual and the photo that is still needed.
 * Never rendered. It exists so the shot list lives next to the guide and each
 * callout is named from the step's own text, not invented.
 */
export interface VisualSlot {
  step: number;
  id: string;
  /** Where the finished file must be placed under /public. */
  targetPath: string;
  shoot: string;
  /** Components the step text itself names, in the order they should be called out. */
  calloutTargets: string[];
  why: string;
}

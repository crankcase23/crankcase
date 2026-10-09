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
  /** AI-generated output. Ownership is NOT asserted; provider terms are recorded. Never "owned". */
  | "generated-original"
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

/**
 * A reference used to ESTABLISH FACTS for original artwork. It may be inspected
 * by the author and the technical reviewer. It is never an input to the
 * artwork's pixels: no embedding, no tracing (see OriginalArtworkRecord).
 */
export interface ReferenceEvidence {
  id: string;
  kind: "oem-figure" | "oem-text" | "parts-catalog" | "third-party-guide" | "third-party-photo" | "user-supplied-photo";
  source: string;
  /** URL, or document + page + figure, precise enough for a reviewer to re-open it. */
  sourceRef: string;
  /** "reference-only" = facts read from the item; "corroborating-text" = supporting text only. */
  usage: "reference-only" | "corroborating-text";
  /** The facts this reference is used to establish. */
  establishes: string[];
  /** What we may and may not do with it (e.g. "no redistribution; no pixels used"). */
  rights: string;
}

export type LedgerAttribute =
  | "existence" | "location" | "orientation" | "relationship" | "hardware-type" | "action"
  | "fine-detail-geometry"
  // Safety-critical: never drawn unless established; otherwise omitted or occluded.
  | "release-mechanism-geometry" | "fastener-position" | "fastener-head-type";

/** One independently tracked fact about one element, and how the picture treats it. */
export interface EvidenceLedgerRow {
  element: string;
  attribute: LedgerAttribute;
  status: "established" | "not-established";
  /** ids into referenceEvidence. Required when established. */
  evidence?: string[];
  render: "draw" | "simplify" | "occlude" | "de-emphasize" | "omit";
  note: string;
}

/** An unsupported attribute that was deliberately kept out of the picture. */
export interface OmittedAttribute {
  element: string;
  attribute: LedgerAttribute;
  handling: "omitted" | "occluded" | "de-emphasized" | "simplified";
  reason: string;
}

/** Everything that makes a piece of original artwork auditable. Written by the pipeline from the manifest. */
export interface OriginalArtworkRecord {
  /** Newly authored Crankcase artwork; never a copy, trace or transform of a reference. */
  originalCrankcaseArtwork: true;
  author: string;
  authoredOn: string;
  method: "vector-svg";
  /** The approved visual specification the artwork was drawn from. */
  specRef: string;
  /** Repo path of the authored SVG, and its hash. */
  sourceFile: string;
  sourceSha256: string;
  /** Present when the platform stamped provenance into the SVG file; sourceSha256 is the authored content without it. */
  platformProvenance?: PlatformProvenanceRecord;
  noSourcePixels: {
    attested: true;
    by: string;
    on: string;
    statement: string;
    /** Must be empty: no reference image was an input to the artwork. */
    referenceImageInputs: string[];
    /** Must be empty: nothing was traced. */
    tracedFrom: string[];
  };
  referenceEvidence: ReferenceEvidence[];
  evidenceLedger: EvidenceLedgerRow[];
  omittedAttributes: OmittedAttribute[];
  /** Elements the picture must never show. The pipeline fails the build if the SVG draws one. */
  mustNotDepict: string[];
}

/** Platform/provider provenance stamped into an original-artwork SVG (recorded, never part of the authored content). */
export interface PlatformProvenanceRecord {
  present: true;
  manifestBase64Length: number;
  manifestSha256: string;
  /** Hash of the stamped file as stored; `sourceSha256` covers the authored content without the stamp. */
  fileSha256: string;
}

export interface RasterArtifactRecord {
  mediaType: "png" | "webp";
  sha256: string;
  bytes: number;
  width: number;
  height: number;
  metadataChunks: string[];
}

/** Everything that makes a generated raster auditable. Written by the pipeline from the Guide Factory objects. */
export interface GeneratedRasterRecord {
  /** Repo path of the Guide Factory directory holding the objects and the source artifact. */
  factoryDir: string;
  visualId: string;
  epRef: { id: string; sha256: string };
  vcRef: { id: string; sha256: string };
  grRef: { id: string; sha256: string };
  qrRef: { id: string; sha256: string };
  overlayQrRef?: { id: string; sha256: string };
  templateRef: { id: string; sha256: string };
  eventsSeq: number;
  eventsHeadSha256: string | null;
  generator: { system: string; model: string; provider: string };
  license: { status: "generated-original"; ownershipAsserted: false; provider: string; model: string; terms: { summary: string; url?: string } };
  promptSha256: string;
  /** Must be empty: no image was an input to generation. */
  imageInputs: unknown[];
  attestation: {
    generatedFromTextOnly: true; noReferenceImageInputs: true; noTracing: true; noThirdPartyCompositing: true; noBakedText: true;
    attestedBy: string; attestedOn: string;
  };
  providerProvenance: { requestId: string | null; generationId: string | null; c2pa: { present: boolean; manifestSha256?: string } };
  /** The generator's file, untouched. Its hash equals provenance.rawSha256. */
  sourceArtifact: RasterArtifactRecord & { file: string; c2pa: { present: boolean; manifestSha256?: string }};
  /** The published derivative. Its hash equals provenance.finalSha256 and differs from the source hash. */
  normalizedArtifact: RasterArtifactRecord & { normalizer: { version: string; tool: string; ops: string[] } };
  qa: { stage: "content"; verdict: "PASS_FOR_OVERLAY_QA"; rubricVersion: string; reviewer: { actor: string; system: string }; provenanceValidated: true; recordedOn: string; overlayVerdict?: string };
  /** The only wording shown to customers; full provenance stays internal. */
  customerDisclosure: "Simplified illustration";
}

export interface VisualProvenance {
  /** Only "verified" visuals are ever displayed. */
  status: "verified" | "pending";
  /**
   * "original-artwork" = newly authored Crankcase vector art (see originalArtwork).
   * The others describe a raw photo / manual page we hold rights to.
   */
  sourceType: "own-photo" | "licensed" | "oem-manual" | "other" | "original-artwork" | "generated-raster";
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
  /** Present exactly when sourceType is "original-artwork". */
  originalArtwork?: OriginalArtworkRecord;
  /** Present exactly when sourceType is "generated-raster". */
  generatedRaster?: GeneratedRasterRecord;
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

// RECONSTRUCTED-V1 | NOT the lost original.
// Enums/constants. Each carries its source tag. VC = recovered surviving code (types/lib), VD = documentation.
export const RECONSTRUCTION_BANNER =
  "THIS GUIDE FACTORY IMPLEMENTATION IS RECONSTRUCTED FROM SURVIVING EVIDENCE. IT IS NOT THE LOST ORIGINAL IMPLEMENTATION.";
export const SCHEMA_VERSION = "reconstructed-1"; // original schemaVersion string: UNKNOWN

export const ACTORS = ["claude-research", "claude-qa", "image-generator", "factory-code", "maze", "andy", "hermes"]; // VD arch §0; "hermes" ADDED in C-4 (Andy lock: independent final reviewer)
export const REFERENCE_KINDS = ["oem-figure", "oem-text", "parts-catalog", "third-party-guide", "third-party-photo", "user-supplied-photo"]; // VC types
export const REFERENCE_USAGE = ["reference-only", "corroborating-text"]; // VC types
export const LEDGER_ATTRIBUTES = ["existence", "location", "orientation", "relationship", "hardware-type", "action", "fine-detail-geometry", "release-mechanism-geometry", "fastener-position", "fastener-head-type"]; // VC types
export const SAFETY_CRITICAL = ["release-mechanism-geometry", "fastener-position", "fastener-head-type"]; // VC lib
export const LEDGER_STATUS = ["established", "not-established"]; // VC types
export const LEDGER_RENDER = ["draw", "simplify", "occlude", "de-emphasize", "omit"]; // VC types
export const ELEMENT_ROLES = ["hero", "target", "context"]; // VD arch §1.1
export const CRITICALITY = ["critical", "identification", "procedure", "cosmetic"]; // VD arch §1.1
export const STRICT_RENDER_CRITICALITY = ["critical", "identification", "procedure"]; // VD: unsupported rows on these may only be omit|occlude

export const FRAME = { width: 1600, height: 1000, aspectW: 16, aspectH: 10 }; // VD arch §1.2 / old pipeline lib.mjs (VC)
export const MEDIA_TYPES_SUPPORTED = ["png"]; // VD says png|webp. WEBP NOT RECONSTRUCTED (UNRESOLVED U-07).
export const MAX_CORRECTIONS = 3; // VD arch §3 + risks #6 ("initial + 3 corrections"; Andy asked to confirm -> still OPEN)
export const MAX_GENERATIONS = MAX_CORRECTIONS + 1;
export const MAX_OVERLAY_ROUNDS = 3; // VD Brick C
export const RUBRIC_VERSION = "CG-QA-v1.0"; // VD rubric
export const TREATMENT_VERSION = "cc-visual-1"; // VC lib (resolver compares to this)
export const NORMALIZER_VERSION = "reconstructed-normalizer-1"; // original version string: UNKNOWN
export const RASTER_OPS = ["decode", "resize-to-frame", "strip-metadata", "png-encode"]; // VD arch §4 (webp-encode omitted)
export const CUSTOMER_DISCLOSURE = "Simplified illustration"; // VC types/lib
export const DEFAULT_MAX_BYTES = 12 * 1024 * 1024; // INFERRED. The original maxBytes value is UNKNOWN (U-08).

export const REVIEW_CLASSES = ["internal", "independent"]; // C-4 lock: internal = claude-qa; independent = hermes (non-Claude)
export const INDEPENDENT_REVIEWER_ACTOR = "hermes";
export const INTERNAL_REVIEWER_ACTOR = "claude-qa";
// C-5 lock #2: canonical independent reviewer identity = "Hermes / ChatGPT / GPT-5.6 Sol". The factory cannot PROVE who wrote a review; it makes
// relabelling insufficient: actor hermes + a GPT/ChatGPT model string + a Hermes/ChatGPT/OpenAI system string + the sha256 of the reviewer's RAW response
// (so Andy can audit it against the real transcript). A Claude result that merely says "Hermes" fails every one of these unless the labels are forged wholesale.
export const INDEPENDENT_IDENTITY = Object.freeze({ canonicalName: "Hermes / ChatGPT / GPT-5.6 Sol", actor: "hermes", modelPattern: /gpt/i, systemPattern: /hermes|chatgpt|openai/i });
export const GENERATED_ASSET_CLASS = "Redline Origin / Crankcase project asset, subject to the generation provider's applicable usage rights"; // C-5 lock #3
export const RIGHTS_BASIS = "provider-granted rights only; no ownership claim beyond the rights the provider actually grants";
export const CLAUDE_FAMILY = /claude|anthropic/i; // a reviewer whose actor/model/system matches is a Claude reviewer and can NEVER be independent
export const QA_STAGES = ["content", "overlay"];
export const SEVERITY = ["CRITICAL", "CONTRACT", "COSMETIC", "IGNORE"]; // VD arch §1.4
export const BLOCKING = ["CRITICAL", "CONTRACT"];
export const CHECK_RESULTS = ["PASS", "FAIL", "NOT_VISIBLE", "NA"];
export const FIX_TYPES = ["modify", "remove", "suppress", "simplify", "relocate", "add"];
export const QR_VERDICTS = ["PASS_FOR_OVERLAY_QA", "CORRECTIONS_REQUIRED", "EVIDENCE_DEFICIENT", "ESCALATE"]; // VD arch §1.4
export const OVERLAY_VERDICTS = ["PASS_OVERLAY", "OVERLAY_CORRECTIONS_REQUIRED", "ESCALATE"]; // PASS_OVERLAY: VD Brick A/VC lib; others INFERRED
// Controlled gate ids: original list UNKNOWN. These are INFERRED from the CG-QA-v1.0 section headings (§3-§14) + the implicit PROVENANCE item (VD Brick A dev. 5).
export const GATE_IDS = ["VEHICLE_CONFIGURATION", "EVIDENCE_PROVENANCE", "NUMERIC_SPEC", "PROCEDURE", "SAFETY", "PARTS_FLUIDS_CONSUMABLES", "TOOLING", "VISUAL_ACCURACY", "TEXT_VISUAL_CONSISTENCY", "BUILD_FUNCTIONAL", "CUSTOMER_USABILITY", "SCOPE_CLAIM_DISCIPLINE", "PROVENANCE"];

export const OBJECT_SCHEMAS = { EP: "guide-factory.evidence-packet", VC: "guide-factory.visual-contract", GR: "guide-factory.generation-record", QR: "guide-factory.qa-result", CD: "guide-factory.correction-delta", AA: "guide-factory.approved-artifact", TPL: "guide-factory.product-template" };
export const ID_PATTERNS = { EP: /^EP-[a-z0-9-]+-v\d+$/, VC: /^VC-[a-z0-9-]+-v\d+$/, GR: /^GR-[a-z0-9-]+-\d{3}$/, QR: /^QR-[a-z0-9-]+-\d{3}$/, CD: /^CD-[a-z0-9-]+-\d{3}$/, AA: /^AA-[a-z0-9-]+$/, TPL: /^TPL-[a-z0-9.-]+-v\d+$/ };

export const EVENT_TYPES = ["EP_REGISTERED", "EP_SUFFICIENT", "EP_INSUFFICIENT", "EP_SUPERSEDED", "VC_COMPILED", "VC_LOCKED", "GEN_REQUESTED", "GEN_SUBMITTED", "PROVENANCE_VALID", "PROVENANCE_REJECTED", "QA_RECORDED", "DELTA_ISSUED", "GEN_ACCEPTED", "NORMALIZED", "OVERLAY_RECORDED", "APPROVED", "NEEDS_ANDY"];

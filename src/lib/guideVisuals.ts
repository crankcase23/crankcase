import type { GuideStepVisual, GuideVisualSet, VisualApplication } from "@/types/guideVisuals";
import type { ResolvedGuide, Vehicle } from "@/types/vehicle";
import { chargerVisuals } from "@/data/guide-visuals/charger-2016-sxt-multi-job";

/** Every registered set. Add a vehicle's set here; nothing else changes. */
const REGISTRY: GuideVisualSet[] = [chargerVisuals];

/** Must equal TREATMENT_VERSION in scripts/visuals/lib.mjs. */
export const TREATMENT_VERSION = "cc-visual-1";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

export function applicationMatches(app: VisualApplication, v: Vehicle): boolean {
  return (
    app.year === v.year &&
    norm(app.make) === norm(v.make) &&
    norm(app.model) === norm(v.model) &&
    norm(app.engine) === norm(v.engine) &&
    (!app.trim || norm(app.trim) === norm(v.trim ?? ""))
  );
}

/**
 * Extra gates for original artwork. They add to, never replace, the checks
 * above: the same vehicle, verification and independent technical review apply.
 * (The full structural audit, including the SVG itself, runs in the pipeline
 * and in `visuals:check`; this is the runtime backstop.)
 */
const SAFETY_CRITICAL = new Set<string>(["release-mechanism-geometry", "fastener-position", "fastener-head-type"]);

function artworkRefusal(p: GuideStepVisual["provenance"]): string | null {
  const a = p.originalArtwork;
  if (!a) return "original artwork without its provenance record";
  if (a.originalCrankcaseArtwork !== true) return "artwork not recorded as original Crankcase artwork";
  if (p.license.status !== "owned") return "original artwork must be owned";
  const n = a.noSourcePixels;
  if (!n || n.attested !== true || !n.by || !n.on) return "no-source-pixels attestation missing";
  if (n.referenceImageInputs.length || n.tracedFrom.length) return "artwork was derived from reference pixels";
  if (!a.referenceEvidence?.length) return "reference list missing";
  if (!a.evidenceLedger?.length) return "evidence ledger missing";
  if (!Array.isArray(a.omittedAttributes)) return "omitted-attribute record missing";
  const refIds = new Set(a.referenceEvidence.map((r) => r.id));
  for (const r of a.evidenceLedger) {
    if (r.status === "established" && !(r.evidence?.length && r.evidence.every((id) => refIds.has(id)))) return "ledger row without evidence";
    if (r.status === "not-established" && r.render === "draw") return "unsupported attribute drawn as if known";
    if (r.status === "not-established" && SAFETY_CRITICAL.has(r.attribute) && r.render !== "omit" && r.render !== "occlude") return "unsupported safety-critical geometry shown";
  }
  if (!a.sourceSha256 || a.sourceSha256 !== p.rawSha256) return "authored source hash missing or inconsistent";
  if (p.technicalReviewBy && p.technicalReviewBy.trim().toLowerCase() === a.author.trim().toLowerCase())
    return "technical review must be independent of the artwork's author";
  return null;
}

/**
 * Extra gates for generated rasters. Added to, never replacing, the common checks. Generated output is never "owned":
 * it needs a valid generator attestation, empty image-input provenance, an independent passing QA result, and a
 * source artifact that is hash-distinct from the normalized derivative that ships.
 */
function rasterRefusal(p: GuideStepVisual["provenance"]): string | null {
  const g = p.generatedRaster;
  if (!g) return "generated raster without its provenance record";
  if (p.license.status !== "generated-original") return "generated raster must be classed generated-original";
  if (g.license?.status !== "generated-original" || g.license.ownershipAsserted !== false) return "generated raster must not assert ownership";
  const at = g.attestation;
  if (!at || !(at.generatedFromTextOnly && at.noReferenceImageInputs && at.noTracing && at.noThirdPartyCompositing && at.noBakedText) || at.attestedBy !== "image-generator" || !at.attestedOn) return "generator attestation missing or incomplete";
  if (!Array.isArray(g.imageInputs) || g.imageInputs.length) return "generation used image inputs";
  if (!g.qa || g.qa.stage !== "content" || g.qa.verdict !== "PASS_FOR_OVERLAY_QA" || g.qa.provenanceValidated !== true) return "independent passing technical QA missing";
  if (!g.qa.reviewer?.actor || g.qa.reviewer.actor === at.attestedBy || g.qa.reviewer.system === g.generator?.system) return "QA reviewer is not independent of the generator";
  if (p.calloutsVerified && g.qa.overlayVerdict !== "PASS_OVERLAY") return "callouts shown without a passing overlay QA result";
  if (!g.sourceArtifact?.sha256 || !g.normalizedArtifact?.sha256) return "source or normalized artifact hash missing";
  if (g.sourceArtifact.sha256 !== p.rawSha256) return "source artifact hash inconsistent with rawSha256";
  if (g.normalizedArtifact.sha256 !== p.finalSha256) return "normalized artifact hash inconsistent with finalSha256";
  if (g.sourceArtifact.sha256 === g.normalizedArtifact.sha256) return "source and normalized hashes must be distinct";
  if (g.normalizedArtifact.metadataChunks?.length) return "published derivative still carries embedded metadata";
  if (!g.grRef?.sha256 || !g.vcRef?.sha256 || !g.epRef?.sha256 || !g.qrRef?.sha256 || !g.templateRef?.sha256) return "factory references missing";
  if (g.customerDisclosure !== "Simplified illustration") return "customer disclosure missing";
  return null;
}

/** Why a visual would be refused, or null when it may be shown. */
export function visualRefusal(
  set: GuideVisualSet,
  vis: GuideStepVisual,
  guide: ResolvedGuide,
  vehicle: Vehicle
): string | null {
  if (set.guideId !== guide.id) return "guide id mismatch";
  if (!applicationMatches(set.application, vehicle)) return "set application does not match vehicle";
  if (!applicationMatches(vis.application, vehicle)) return "image application does not match vehicle";
  const p = vis.provenance;
  if (p.status !== "verified") return "not verified";
  if (!p.source.trim() || !p.sourceRef.trim()) return "missing source / reference";
  if (!p.license || p.license.status === "unknown") return "usage rights not established";
  if (!p.component.trim() || !p.vehicleEvidence.trim()) return "missing component / vehicle evidence";
  if (!p.verifiedBy || !p.verifiedOn) return "vehicle verification missing";
  if (!p.technicalReviewBy || !p.technicalReviewOn) return "technical review missing";
  if (!p.rawSha256 || !p.finalSha256 || !p.treatment || p.treatment.version !== TREATMENT_VERSION)
    return "not produced by the current Crankcase pipeline";
  if (p.sourceType === "original-artwork") {
    const why = artworkRefusal(p);
    if (why) return why;
  } else if (p.originalArtwork) {
    return "originalArtwork record on a non-artwork source";
  }
  if (p.sourceType === "generated-raster") {
    const why = rasterRefusal(p);
    if (why) return why;
  } else if (p.generatedRaster) {
    return "generatedRaster record on a non-raster source";
  } else if (p.license.status === "generated-original") {
    return "generated-original license on a non-generated source";
  }
  if (p.sourceType === "generated-raster" && !vis.caption.includes("Simplified illustration")) return "generated raster caption lacks the customer disclosure";
  if (!vis.src.startsWith("/guide-visuals/")) return "bad path";
  if (!vis.alt.trim() || !vis.caption.trim()) return "missing alt/caption";
  if (!(vis.width > 0 && vis.height > 0)) return "missing dimensions";
  return null;
}

/**
 * The visuals to show for one step: only those that pass every check above.
 * Callouts are stripped unless a human confirmed them. Returns [] (never a
 * substitute) when there is nothing trustworthy to show.
 */
export function resolveStepVisuals(
  guide: ResolvedGuide,
  vehicle: Vehicle,
  stepNumber: number
): GuideStepVisual[] {
  const set = REGISTRY.find((s) => s.guideId === guide.id);
  const list = set?.steps[stepNumber];
  if (!set || !list?.length) return [];
  const out: GuideStepVisual[] = [];
  for (const vis of list) {
    const why = visualRefusal(set, vis, guide, vehicle);
    if (why) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[guide-visuals] step ${stepNumber} "${vis.id}" not shown: ${why}`);
      }
      continue;
    }
    out.push(vis.provenance.calloutsVerified ? vis : { ...vis, callouts: undefined });
  }
  return out;
}

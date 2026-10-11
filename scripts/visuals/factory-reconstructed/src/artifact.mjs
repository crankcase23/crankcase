// RECONSTRUCTED-V1 | NOT the lost original.
// Approved Artifact (AA) assembly + the registry-entry PREVIEW (never written to any real registry or public/).
// Sources: VD arch §1.6 (AA fields, gates list, authority), VC recovered types `GeneratedRasterRecord` / `VisualProvenance`
// (the exact record the recovered resolver reads), VD Brick C ("vehicleVerified is objective registry match";
// "spot-check non-blocking for APPROVED"). INTEGRATED/REVOKED lifecycle states are NOT reconstructed (integration is out of scope).
import { makeObject, envelopeProblems, slugApplication, sameApplication } from "./objects.mjs";
import { refOf, contentHashOf } from "./canon.mjs";
import { P } from "./evidence.mjs";
import { isClaudeReviewer } from "./qa.mjs";
import { CUSTOMER_DISCLOSURE, RASTER_OPS, TREATMENT_VERSION } from "./enums.mjs";

export const GATE_NAMES = ["evidenceSufficient", "contractLocked", "provenanceValid", "contentQaPass", "overlayQaPass", "calloutsVerified", "vehicleVerified", "hashesConsistent", "reviewerIndependent", "independentFinalReview"];
export const gatesPass = (g) => GATE_NAMES.every((k) => g?.[k] === true || g?.[k] === "na");

/** C-4: the final QR must be an INDEPENDENT review by hermes (never Claude). */
export const independentFinalReview = (qr) => qr?.reviewClass === "independent" && qr?.reviewer?.actor === "hermes" && !isClaudeReviewer(qr.reviewer);

export const publicPathFor = (application, visualId) => `/guide-visuals/${slugApplication(application)}/${visualId}.png`;

export function buildRegistryEntry({ guideId, step, ep, vc, gr, qr, overlayQr, template, events, norm, presentation, authority, now, factoryDirLabel }) {
  const head = events.at(-1) ?? null;
  const caption = presentation.caption.includes(CUSTOMER_DISCLOSURE) ? presentation.caption : `${presentation.caption} ${CUSTOMER_DISCLOSURE}`; // INFERRED: disclosure appended when absent
  const humanOk = authority?.approvedBy === "andy" && /^\d{4}-\d{2}-\d{2}$/.test(authority?.approvedOn ?? "");
  const date = now.slice(0, 10);
  const provenance = {
    status: humanOk ? "verified" : "pending", // only a human sign-off makes it "verified" (VC types: "verified by a human"; VD risk #3)
    sourceType: "generated-raster", source: `${gr.generator.system} / ${gr.generator.model}`, sourceRef: `${factoryDirLabel}/${gr.id}`,
    license: { status: "generated-original", terms: gr.license.terms.summary },
    component: ep.elements.filter((e) => e.role === "hero" || e.role === "target").map((e) => e.id).join(", "),
    vehicleEvidence: "objective match of the application against the registry (applications.json)", // VD Brick C: "vehicleVerified is objective registry match"
    ...(humanOk ? { verifiedBy: authority.approvedBy, verifiedOn: authority.approvedOn, technicalReviewBy: qr.reviewer.actor, technicalReviewOn: date } : {}),
    calloutsVerified: vc.callouts.length > 0 ? overlayQr?.verdict === "PASS_OVERLAY" : false,
    rawSha256: gr.artifact.sha256, finalSha256: norm.normalized.sha256,
    treatment: { version: TREATMENT_VERSION, crop: { x: 0, y: 0, w: gr.artifact.width, h: gr.artifact.height }, rawSize: { w: gr.artifact.width, h: gr.artifact.height }, ops: RASTER_OPS, brightness: 1, contrast: 1 },
    generatedRaster: {
      factoryDir: factoryDirLabel, visualId: ep.visualId,
      epRef: refOf(ep), vcRef: refOf(vc), grRef: refOf(gr), qrRef: refOf(qr), ...(overlayQr ? { overlayQrRef: refOf(overlayQr) } : {}), templateRef: refOf(template),
      eventsSeq: head?.seq ?? 0, eventsHeadSha256: head?.eventSha256 ?? null,
      generator: gr.generator, license: gr.license, promptSha256: gr.promptSha256, imageInputs: gr.imageInputs, attestation: gr.attestation,
      providerProvenance: gr.providerProvenance,
      sourceArtifact: { mediaType: "png", sha256: gr.artifact.sha256, bytes: gr.artifact.bytes, width: gr.artifact.width, height: gr.artifact.height, metadataChunks: gr.artifact.metadataChunks, file: gr.artifact.file, c2pa: gr.artifact.c2pa },
      normalizedArtifact: { ...norm.normalized },
      qa: { stage: "content", reviewClass: qr.reviewClass, verdict: qr.verdict, rubricVersion: qr.rubricVersion, reviewer: { actor: qr.reviewer.actor, system: qr.reviewer.system }, provenanceValidated: qr.provenanceCheck.validated, recordedOn: qr.createdAt.slice(0, 10), ...(overlayQr ? { overlayVerdict: overlayQr.verdict } : {}) },
      customerDisclosure: CUSTOMER_DISCLOSURE,
    },
  };
  return { step, entry: { id: ep.visualId, src: publicPathFor(ep.application, ep.visualId), width: norm.normalized.width, height: norm.normalized.height, alt: presentation.alt, caption, application: ep.application, ...(vc.callouts.length ? {} : {}), provenance }, guideId };
}

export function buildAA({ ep, vc, gr, qr, overlayQr, template, norm, gates, authority, registryRef, createdAt }) {
  return makeObject("AA", {
    id: `AA-${ep.visualId}`, visualId: ep.visualId, application: ep.application, createdBy: { actor: "factory-code", role: "artifact-assembler" }, createdAt,
    refs: [refOf(ep), refOf(vc), refOf(gr), refOf(qr), ...(overlayQr ? [refOf(overlayQr)] : []), refOf(template)],
    body: {
      artifact: { file: publicPathFor(ep.application, ep.visualId), mediaType: "png", sha256: norm.normalized.sha256, width: norm.normalized.width, height: norm.normalized.height, treatment: { version: TREATMENT_VERSION, ops: RASTER_OPS } },
      publishedTo: null, callouts: vc.callouts, calloutsVerified: vc.callouts.length ? { by: overlayQr?.reviewer?.actor ?? null, on: overlayQr?.createdAt?.slice(0, 10) ?? null } : null,
      gates, authority: { andyFinal: "required", approvedBy: authority?.approvedBy ?? null, approvedOn: authority?.approvedOn ?? null }, registryEntryRef: registryRef,
    },
  });
}

export function aaProblems(aa, store, files) {
  const bad = envelopeProblems("AA", aa).map((m) => P("ENVELOPE", "malformed", m));
  if (!aa?.gates || !aa?.refs || !aa?.artifact) return [...bad, P("AA_SHAPE", "malformed", "gates/refs/artifact missing")];
  if (!gatesPass(aa.gates)) bad.push(P("AA_GATES", "rule", "not every gate is true"));
  for (const r of aa.refs) { const t = store.get(r.id); if (!t || contentHashOf(t) !== r.sha256) bad.push(P("AA_STALE_REF", "rule", `ref ${r.id} missing or stale`)); }
  if (files.normalizedSha256 !== aa.artifact.sha256) bad.push(P("AA_FILE_HASH", "rule", "published-candidate file hash differs from the derived hash"));
  return bad;
}
export const _same = sameApplication;

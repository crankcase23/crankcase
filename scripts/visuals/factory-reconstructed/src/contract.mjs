// RECONSTRUCTED-V1 | NOT the lost original.
// Product template (TPL) + Visual Contract (VC) compiler.
// Source: VD arch §1.2 (VC fields/validation: "Compiled by code from EP plus a product template. It is a projection of the
// ledger, not new claims."). The original `criticality-template.json` is LOST (UNKNOWN). The template here carries ONLY
// what the docs state: the output frame, generation rules, QA rubric version, and the rule that hardware/connectors/
// clamps/release mechanisms are never cosmetic (arch §8.7, INFERRED as a keyword list).
import { makeObject, envelopeProblems } from "./objects.mjs";
import { refOf } from "./canon.mjs";
import { P } from "./evidence.mjs";
import { FRAME, MAX_CORRECTIONS, MEDIA_TYPES_SUPPORTED, DEFAULT_MAX_BYTES, RUBRIC_VERSION, BLOCKING, CRITICALITY } from "./enums.mjs";
import { slugApplication } from "./objects.mjs";

export const NEVER_COSMETIC_KEYWORDS = ["hardware", "connector", "clamp", "release", "fastener", "bolt", "screw", "latch", "tab"]; // INFERRED

export function makeTemplate(application, createdAt, maxBytes = DEFAULT_MAX_BYTES) {
  return makeObject("TPL", {
    id: `TPL-${slugApplication(application)}-v1`, visualId: "template", application,
    createdBy: { actor: "factory-code", role: "template-author" }, createdAt, refs: [],
    body: { output: { width: FRAME.width, height: FRAME.height, mediaTypes: MEDIA_TYPES_SUPPORTED, maxBytes, noBakedText: true },
      generation: { imageInputsAllowed: false, maxCorrectionCycles: MAX_CORRECTIONS },
      qa: { rubricVersion: RUBRIC_VERSION, blockingSeverities: BLOCKING }, neverCosmeticKeywords: NEVER_COSMETIC_KEYWORDS },
  });
}

/** Template-level criticality rule: an element whose id/role text names hardware may not be tagged cosmetic. */
export function criticalityProblems(ep, template) {
  const bad = [];
  for (const e of ep.elements) {
    if (e.criticality === "cosmetic" && template.neverCosmeticKeywords.some((k) => e.id.toLowerCase().includes(k)))
      bad.push(P("CRITICALITY_COSMETIC_HARDWARE", "rule", `element ${e.id} looks like hardware and may not be cosmetic`));
    if (!CRITICALITY.includes(e.criticality)) bad.push(P("ELEMENT_SHAPE", "malformed", `element ${e.id} criticality invalid`));
  }
  return bad;
}

/**
 * Compile VC from a SUFFICIENT EP. `spec` (optional) contributes non-binding composition hints, callouts and clear space.
 * Everything in mustDepict / mustNotDepict / suppress traces to an EP row (arch §1.2 validation).
 */
export function compileVC({ ep, template, spec = null, version = 1, createdAt }) {
  const mustDepict = ep.elements.filter((e) => e.role === "hero" || e.role === "target").map((e) => ({
    id: `MD-${e.id}`, element: e.id, criticality: e.criticality, visibility: e.role,
    requirements: ep.ledger.filter((r) => r.element === e.id && r.status === "established").map((r) => ({ attribute: r.attribute, render: r.render, evidence: r.evidence })),
  }));
  const maySimplify = ep.elements.filter((e) => e.role === "context" || e.criticality === "cosmetic").filter((e) => !mustDepict.some((m) => m.element === e.id)).map((e) => ({ element: e.id }));
  const suppress = ep.ledger.filter((r) => r.status === "not-established" && ["omit", "occlude", "de-emphasize", "simplify"].includes(r.render)).map((r) => ({ element: r.element, attribute: r.attribute, handling: r.render }));
  const mustNotDepict = ep.mustNotDepict.map((m) => ({ id: `MN-${m.id}`, element: m.element, reason: m.reason, trace: m.trace }));
  const callouts = (spec?.callouts ?? []).map((c) => ({ label: c.label, element: c.element, required: !!c.required }));
  return makeObject("VC", {
    id: `VC-${ep.visualId}-v${version}`, visualId: ep.visualId, application: ep.application, createdBy: { actor: "factory-code", role: "contract-compiler" }, createdAt,
    refs: [refOf(ep), refOf(template)],
    body: {
      output: template.output, mustDepict, maySimplify, mustNotDepict, suppress,
      composition: { viewpoint: spec?.framing?.viewpoint ?? null, regionsHint: [] },
      callouts, overlay: { clearSpaceRegions: spec?.clearSpace ?? [] },
      generation: template.generation, qa: template.qa,
      specRef: spec ? { sourceKind: spec.sourceKind, sourcePromptSha256: spec.sourcePromptSha256 } : null,
    },
  });
}

export function vcProblems(vc, ep) {
  const bad = envelopeProblems("VC", vc).map((m) => P("ENVELOPE", "malformed", m));
  if (bad.length || !ep) return bad;
  const mdEls = new Set(vc.mustDepict.map((m) => m.element));
  for (const e of ep.elements) if ((e.role === "hero" || e.role === "target") && !mdEls.has(e.id)) bad.push(P("VC_MISSING_HERO", "rule", `hero/target ${e.id} not in mustDepict`));
  for (const m of vc.mustNotDepict) if (!ep.mustNotDepict.some((x) => `MN-${x.id}` === m.id)) bad.push(P("VC_UNTRACED", "rule", `mustNotDepict ${m.id} does not trace to the EP`));
  for (const c of vc.callouts) if (!mdEls.has(c.element)) bad.push(P("VC_CALLOUT_ELEMENT", "rule", `callout ${c.label} names an element not in mustDepict`));
  if (vc.generation.imageInputsAllowed !== false) bad.push(P("VC_IMAGE_INPUTS", "rule", "imageInputsAllowed must be false"));
  return bad;
}

/** Deterministic generation prompt. If the spec carries a human-authored source prompt, that is canonical (hash recorded). Original prompt writer: UNKNOWN. */
export function renderPrompt(vc, spec = null, promptText = null) {
  if (promptText) return promptText;
  const lines = ["Create ONE instructional illustration. Text-only prompt: do not use, request or trace any reference image.",
    `Frame: ${vc.output.width}x${vc.output.height} (16:10) or larger at 16:10. No text, labels, arrows or watermarks.`, "MUST SHOW:"];
  vc.mustDepict.forEach((m, i) => lines.push(`${i + 1}. ${m.element} (${m.visibility})`));
  lines.push("MUST NOT SHOW:", ...vc.mustNotDepict.map((m) => `- ${m.element}`));
  void spec;
  return lines.join("\n") + "\n";
}

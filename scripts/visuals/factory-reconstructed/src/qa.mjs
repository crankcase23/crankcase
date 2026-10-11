// RECONSTRUCTED-V1 | NOT the lost original.
// QA Result (QR) + Correction Delta (CD). Verdicts are COMPUTED by code ("code decides, actors propose").
// Sources: VD arch §1.4 (QR), §1.5 (CD), CG-QA-v1.0 rubric (all-or-nothing; PASS only with zero blocking findings),
// Brick A report (PROVENANCE is an implicit contract item; overlay verdict PASS_OVERLAY).
import { makeObject, envelopeProblems } from "./objects.mjs";
import { refOf } from "./canon.mjs";
import { P } from "./evidence.mjs";
import { BLOCKING, SEVERITY, CHECK_RESULTS, FIX_TYPES, GATE_IDS, RUBRIC_VERSION, MAX_CORRECTIONS, MAX_OVERLAY_ROUNDS, ACTORS, CLAUDE_FAMILY, INDEPENDENT_IDENTITY, INDEPENDENT_REVIEWER_ACTOR, INTERNAL_REVIEWER_ACTOR, REVIEW_CLASSES } from "./enums.mjs";

const isStr = (s) => typeof s === "string" && s.trim().length > 0;
export const contractItemIds = (vc) => [...vc.mustDepict.map((m) => m.id), ...vc.mustNotDepict.map((m) => m.id), "PROVENANCE"];

/** Compute the verdict. `correctionsUsed` = corrections already issued for this visual (cap MAX_CORRECTIONS). */
export function computeVerdict({ vc, checks, findings, provenanceCheck, regressionCheck = [], correctionsUsed = 0 }) {
  const blocking = findings.filter((f) => BLOCKING.includes(f.severity));
  const failedMustDepict = vc.mustDepict.some((m) => checks.find((c) => c.contractItemId === m.id)?.result !== "PASS");
  const regressed = regressionCheck.some((r) => r.now !== "PASS");
  if (blocking.some((f) => f.evidenceDeficiency && f.evidenceDeficiency !== false)) return "EVIDENCE_DEFICIENT";
  if (blocking.length || failedMustDepict || !provenanceCheck?.validated || regressed) return correctionsUsed >= MAX_CORRECTIONS ? "ESCALATE" : "CORRECTIONS_REQUIRED";
  return "PASS_FOR_OVERLAY_QA";
}

export function failedGatesOf(findings, provenanceCheck) {
  const g = new Set(findings.filter((f) => BLOCKING.includes(f.severity)).map((f) => f.gate ?? "VISUAL_ACCURACY"));
  if (!provenanceCheck?.validated) g.add("PROVENANCE");
  return [...g];
}

/** Validation of an actor's QR submission BEFORE the object is built. Returns problems. */
export const isClaudeReviewer = (r) => !!r && [r.actor, r.model, r.system].some((x) => typeof x === "string" && (CLAUDE_FAMILY.test(x) || x === INTERNAL_REVIEWER_ACTOR));

/**
 * C-4 INDEPENDENCE RULE (Andy lock #2): "Claude may perform internal QA. Hermes / ChatGPT is the independent final reviewer.
 * Claude reviewing Claude is not independent QA." => independent reviews must be actor "hermes" and must not look like Claude anywhere
 * (actor, model, system). Internal reviews must be actor "claude-qa" and may never be labelled independent.
 */
export function reviewerClassProblems(reviewer, reviewClass) {
  const bad = [];
  if (!REVIEW_CLASSES.includes(reviewClass)) return [P("QR_REVIEW_CLASS", "malformed", `reviewClass must be ${REVIEW_CLASSES.join("|")}`)];
  if (!reviewer || !isStr(reviewer.model) || !isStr(reviewer.system)) bad.push(P("QR_REVIEWER", "rule", "reviewer needs {actor, model, system}"));
  if (reviewClass === "independent") {
    if (reviewer?.actor !== INDEPENDENT_REVIEWER_ACTOR) bad.push(P("QR_SELF_QA_NOT_INDEPENDENT", "rule", `independent review must come from actor ${INDEPENDENT_REVIEWER_ACTOR}; ${reviewer?.actor} is not independent (Claude reviewing Claude is internal QA)`));
    if (isClaudeReviewer(reviewer)) bad.push(P("QR_SELF_QA_NOT_INDEPENDENT", "rule", "a Claude-family reviewer (actor/model/system) cannot be presented as independent QA"));
    if (!INDEPENDENT_IDENTITY.modelPattern.test(reviewer?.model ?? "") || !INDEPENDENT_IDENTITY.systemPattern.test(reviewer?.system ?? "")) bad.push(P("QR_REVIEWER_IDENTITY", "rule", `independent reviewer identity must be ${INDEPENDENT_IDENTITY.canonicalName}: model must look like a GPT/ChatGPT model and system like Hermes/ChatGPT/OpenAI; relabelling a result "hermes" is not enough`));
    if (!/^[0-9a-f]{64}$/.test(reviewer?.rawResponseSha256 ?? "")) bad.push(P("QR_REVIEWER_RAW_HASH", "rule", "independent review must carry reviewer.rawResponseSha256 (sha256 of the reviewer's raw response) so it can be audited against the real transcript"));
  } else if (reviewer?.actor !== INTERNAL_REVIEWER_ACTOR) bad.push(P("QR_REVIEWER", "rule", `internal review must come from actor ${INTERNAL_REVIEWER_ACTOR}`));
  return bad;
}

export function qaSubmissionProblems({ sub, vc, gr, priorPasses = [], reviewClass = "internal" }) {
  const bad = [];
  if (sub?.reviewClass !== undefined && sub.reviewClass !== reviewClass) bad.push(P("QR_SELF_QA_NOT_INDEPENDENT", "rule", `submission claims reviewClass ${sub.reviewClass} on a ${reviewClass} review channel`));
  bad.push(...reviewerClassProblems(sub?.reviewer, reviewClass));
  if (!isStr(sub?.reviewer?.system)) bad.push(P("QR_REVIEWER", "rule", "reviewer.system missing"));
  if (sub?.reviewer?.actor === gr.attestation?.attestedBy || (isStr(sub?.reviewer?.system) && sub.reviewer.system === gr.generator?.system)) bad.push(P("QR_NOT_INDEPENDENT", "rule", "reviewer is not independent of the generator"));
  if (sub?.rubricVersion !== RUBRIC_VERSION) bad.push(P("QR_RUBRIC", "rule", `rubricVersion must be ${RUBRIC_VERSION}`));
  if (!Array.isArray(sub?.checks) || !Array.isArray(sub?.findings)) return [...bad, P("QR_SHAPE", "malformed", "checks and findings must be lists")];
  const items = new Set(contractItemIds(vc));
  const seen = new Set();
  for (const c of sub.checks) {
    if (!items.has(c.contractItemId) || !CHECK_RESULTS.includes(c.result)) bad.push(P("QR_CHECK_SHAPE", "malformed", `check ${JSON.stringify(c)} invalid`));
    if (seen.has(c.contractItemId)) bad.push(P("QR_CHECK_DUPLICATE", "malformed", `contract item ${c.contractItemId} checked more than once`));
    seen.add(c.contractItemId);
  }
  for (const id of items) if (!seen.has(id)) bad.push(P("QR_CHECK_MISSING", "rule", `contract item ${id} has no check`));
  const findingIds = new Set();
  for (const f of sub.findings) {
    if (!isStr(f.id) || findingIds.has(f.id) || !SEVERITY.includes(f.severity) || !isStr(f.description) || !isStr(f.requiredChange ?? "x")) bad.push(P("QR_FINDING_SHAPE", "malformed", `finding ${f.id} invalid`));
    findingIds.add(f.id);
    if (f.fixType !== undefined && !FIX_TYPES.includes(f.fixType)) bad.push(P("QR_FINDING_SHAPE", "malformed", `finding ${f.id} fixType invalid`));
    if (f.gate !== undefined && !GATE_IDS.includes(f.gate)) bad.push(P("QR_FINDING_SHAPE", "malformed", `finding ${f.id} gate ${f.gate} not a controlled gate id`));
    if (!f.evidenceDeficiency && !items.has(f.contractItemRef)) bad.push(P("QR_FINDING_UNCITED", "rule", `finding ${f.id} cites no contract item`));
    if (f.regression === true && !BLOCKING.includes(f.severity)) bad.push(P("QR_REGRESSION_SEVERITY", "rule", `finding ${f.id} is a regression and must be CRITICAL or CONTRACT`));
  }
  for (const c of sub.checks) {
    const isMd = vc.mustDepict.some((m) => m.id === c.contractItemId), isMn = vc.mustNotDepict.some((m) => m.id === c.contractItemId);
    if ((isMd && (c.result === "FAIL" || c.result === "NOT_VISIBLE")) || (isMn && c.result === "FAIL") || (c.contractItemId === "PROVENANCE" && c.result === "FAIL")) {
      if (!sub.findings.some((f) => f.contractItemRef === c.contractItemId && BLOCKING.includes(f.severity)) && c.contractItemId !== "PROVENANCE") bad.push(P("QR_FAIL_NO_FINDING", "rule", `check ${c.contractItemId} failed without a blocking finding`));
    }
  }
  for (const r of sub.regressionCheck ?? []) if (!priorPasses.includes(r.priorPassRef)) bad.push(P("QR_REGRESSION_REF", "rule", `regression check cites unknown prior pass ${r.priorPassRef}`));
  return bad;
}

export function buildQR({ visualId, application, n, vc, gr, ep, sub, correctionsUsed, createdAt, stage = "content", reviewClass = "internal" }) {
  const provenanceCheck = sub.provenanceCheck ?? { validated: false, notes: "" };
  const verdict = computeVerdict({ vc, checks: sub.checks, findings: sub.findings, provenanceCheck, regressionCheck: sub.regressionCheck ?? [], correctionsUsed });
  return makeObject("QR", {
    id: `QR-${visualId}-${String(n).padStart(3, "0")}`, visualId, application, createdBy: { actor: sub.reviewer.actor, role: reviewClass === "independent" ? "independent-reviewer" : "internal-reviewer", system: sub.reviewer.system }, createdAt,
    refs: [refOf(gr), refOf(vc), refOf(ep)],
    body: { stage, reviewClass, rubricVersion: sub.rubricVersion, reviewer: sub.reviewer, provenanceCheck, checks: sub.checks, findings: sub.findings, regressionCheck: sub.regressionCheck ?? [], verdict, failedGates: failedGatesOf(sub.findings, provenanceCheck) },
  });
}

export function qrProblems(qr) {
  const bad = envelopeProblems("QR", qr).map((m) => P("ENVELOPE", "malformed", m));
  if (!bad.length) bad.push(...reviewerClassProblems(qr.reviewer, qr.reviewClass));
  if (!bad.length && qr.verdict === "PASS_FOR_OVERLAY_QA" && (qr.findings.some((f) => BLOCKING.includes(f.severity)) || qr.failedGates.length)) bad.push(P("QR_PASS_WITH_BLOCKERS", "rule", "PASS with blocking findings / failed gates"));
  return bad;
}

/** Correction Delta compiled by code from the QR's blocking findings (VD arch §1.5). */
export function buildCD({ visualId, application, n, qr, gr, cycle, priorPassRefs, createdAt }) {
  const blocking = qr.findings.filter((f) => BLOCKING.includes(f.severity));
  const items = blocking.map((f) => ({ findingRef: f.id, action: f.fixType ?? "modify", element: f.element ?? null, region: f.region ?? null, instruction: f.requiredChange, acceptance: { contractItemId: f.contractItemRef ?? null, expect: "PASS" } }));
  const mayChange = [...new Set(items.map((i) => i.element).filter(Boolean))];
  const protectedEls = qr.checks.filter((c) => c.result === "PASS" && !String(c.contractItemId).startsWith("MN-") && c.contractItemId !== "PROVENANCE").map((c) => c.contractItemId.replace(/^MD-/, "")).filter((el) => !mayChange.includes(el)).map((el) => ({ element: el, attributes: [], priorPassRef: priorPassRefs?.[el] ?? qr.id }));
  return makeObject("CD", {
    id: `CD-${visualId}-${String(n).padStart(3, "0")}`, visualId, application, createdBy: { actor: "factory-code", role: "delta-compiler" }, createdAt, refs: [refOf(qr), refOf(gr)],
    body: { cycle, items, mayChange, protected: protectedEls, optionalCosmetic: qr.findings.filter((f) => f.severity === "COSMETIC").map((f) => f.id) },
  });
}

export function cdProblems(cd, qr, store = null) {
  const bad = envelopeProblems("CD", cd).map((m) => P("ENVELOPE", "malformed", m));
  const blocking = qr.findings.filter((f) => BLOCKING.includes(f.severity));
  if (cd.items.length !== blocking.length || !blocking.every((f) => cd.items.some((i) => i.findingRef === f.id))) bad.push(P("CD_NOT_1_TO_1", "rule", "delta items are not 1:1 with blocking findings"));
  if (cd.protected.some((p) => cd.mayChange.includes(p.element))) bad.push(P("CD_NOT_DISJOINT", "rule", "protected and mayChange overlap"));
  if (cd.cycle > MAX_CORRECTIONS) bad.push(P("CD_CYCLE", "rule", "correction cycle beyond the cap"));
  if (store) { // C-4: a delta may only protect elements that demonstrably passed in a prior artifact that EXISTS
    for (const p of cd.protected ?? []) {
      const prior = store.get(p.priorPassRef);
      if (!prior || !String(prior.id).startsWith("QR-")) bad.push(P("CD_PRIOR_MISSING", "rule", `protected element ${p.element} cites prior pass ${p.priorPassRef}, which does not exist`));
      else if (prior.checks?.find((c) => c.contractItemId === `MD-${p.element}`)?.result !== "PASS") bad.push(P("CD_PRIOR_NOT_PASS", "rule", `${p.priorPassRef} did not pass MD-${p.element}`));
    }
    for (const r of cd.refs ?? []) if (!store.get(r.id)) bad.push(P("CD_REF_MISSING", "rule", `delta ref ${r.id} does not exist`));
  }
  return bad;
}

/** Overlay stage (Brick C: second QR stage; max MAX_OVERLAY_ROUNDS rounds). Overlay rules beyond that are INFERRED/minimal. */
export function overlayVerdict({ result, round }) {
  if (result === "PASS") return "PASS_OVERLAY";
  return round >= MAX_OVERLAY_ROUNDS ? "ESCALATE" : "OVERLAY_CORRECTIONS_REQUIRED";
}
export const _ACTORS = ACTORS;

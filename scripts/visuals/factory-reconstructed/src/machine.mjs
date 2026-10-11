// RECONSTRUCTED-V1 | NOT the lost original.
// The pipeline state machine + command layer ("code decides, actors propose").
// Source for states/transitions: VD arch §3. Source for command/actor split: VD Brick C report
// (register-ep, ep-evaluate, compile-vc, submit-generation, validate-generation, submit-qa, issue-delta, accept-generation,
// overlay-check, approve; "Refused commands leave the directory byte-identical"). The original command names/CLI flags are
// UNKNOWN; this is a programmatic API, not a CLI re-creation.
//
// CORRECTION-CYCLE POLICY: see policy.mjs. ARCHITECTURE_V1 is CANONICAL (locked by Andy in C-4). Anything else needs allowNonCanonical:true and can never be approved.
// REVIEW MODEL (C-4 lock): claude-qa = INTERNAL QA (submitQA). hermes = INDEPENDENT final reviewer (submitIndependentReview). Only an independent PASS admits a generation.
//
// Every command: (1) derives state from the event log, (2) validates EVERYTHING, (3) only then writes. A refusal throws
// `Refused` and writes nothing.
import fs from "node:fs";
import path from "node:path";
import { sha256, refOf, contentHashOf } from "./canon.mjs";
import { appendEvent, readEvents } from "./eventlog.mjs";
import { makeObject } from "./objects.mjs";
import { epProblems, sufficiencyProblems } from "./evidence.mjs";
import { makeTemplate, criticalityProblems, compileVC, vcProblems, renderPrompt } from "./contract.mjs";
import { describeRaster, checkGeneration } from "./provenance.mjs";
import { qaSubmissionProblems, reviewerClassProblems, buildQR, qrProblems, buildCD, cdProblems, overlayVerdict, contractItemIds } from "./qa.mjs";
import { normalizeRaster, NormalizationRefused } from "./normalize.mjs";
import { buildAA, buildRegistryEntry, GATE_NAMES, gatesPass, independentFinalReview } from "./artifact.mjs";
import { Refused, LAYOUT, loadStore, readJson, writeJsonOnce, writeFileOnce, readBytes, exists, abs } from "./store.mjs";
import { resolvePolicy } from "./policy.mjs";
import { MAX_GENERATIONS, MAX_OVERLAY_ROUNDS, RUBRIC_VERSION, GENERATED_ASSET_CLASS, RIGHTS_BASIS } from "./enums.mjs";
import { sameApplication } from "./objects.mjs";

const pad = (n) => String(n).padStart(3, "0");
const note = (o) => JSON.stringify(o);
const parse = (s) => { try { return s ? JSON.parse(s) : {}; } catch { return {}; } };

/** Event-sourced state. Pure function of the event log. */
export function reduce(events) {
  const s = { phase: "NEW", ep: { ref: null, version: 0, status: "NONE" }, vc: { ref: null, version: 0 }, cyclesConsumed: 0, correctionsIssued: 0, provenanceRetries: 0,
    grCount: 0, qrCount: 0, cdCount: 0, pendingGR: null, acceptedGR: null, grStatus: {}, lastQR: null, openDelta: null, overlayRounds: 0, overlayQR: null, internalQR: null, independentQR: null, needsAndy: null, normalized: null, approved: false };
  for (const ev of events) {
    const d = parse(ev.note);
    switch (ev.type) {
      case "EP_REGISTERED": s.ep = { ref: ev.ref, version: s.ep.version + 1, status: "DRAFT" }; s.phase = "EP_DRAFT"; break;
      case "EP_SUPERSEDED": s.ep.status = "SUPERSEDED"; break;
      case "EP_SUFFICIENT": s.ep.status = "SUFFICIENT"; s.phase = "EP_SUFFICIENT"; break;
      case "EP_INSUFFICIENT": s.ep.status = "INSUFFICIENT"; s.phase = "EP_INSUFFICIENT"; break;
      case "VC_COMPILED": s.vc = { ref: ev.ref, version: s.vc.version + 1 }; break;
      case "VC_LOCKED": s.phase = "VC_LOCKED"; break;
      case "GEN_REQUESTED": s.phase = "GEN_REQUESTED"; break;
      case "GEN_SUBMITTED": s.grCount++; s.pendingGR = ev.ref; s.grStatus[ev.ref.id] = "SUBMITTED"; s.phase = "PROVENANCE_CHECK"; break;
      case "PROVENANCE_VALID": s.grStatus[ev.ref.id] = "PROVENANCE_VALID"; s.phase = "QA_PENDING"; break;
      case "PROVENANCE_REJECTED": s.grStatus[ev.ref.id] = "PROVENANCE_REJECTED"; s.pendingGR = null; if (d.burn) s.cyclesConsumed++; else s.provenanceRetries++; s.phase = "PROVENANCE_REJECTED"; break;
      case "QA_RECORDED":
        s.qrCount++; s.lastQR = ev.ref;
        if (d.verdict === "PASS_FOR_OVERLAY_QA") { if (d.reviewClass === "independent") { s.phase = "QA_PASSED"; s.independentQR = ev.ref; } else { s.phase = "INTERNAL_QA_PASSED"; s.internalQR = ev.ref; } }
        else if (d.verdict === "CORRECTIONS_REQUIRED") s.phase = "CORRECTIONS_PENDING";
        else if (d.verdict === "EVIDENCE_DEFICIENT") { s.phase = "EP_REOPEN_NEEDED"; s.cyclesConsumed++; s.grStatus[s.pendingGR?.id] = "SUPERSEDED"; s.pendingGR = null; }
        break;
      case "DELTA_ISSUED": s.cdCount++; s.correctionsIssued++; s.cyclesConsumed++; s.openDelta = ev.ref; s.grStatus[s.pendingGR?.id] = "SUPERSEDED"; s.pendingGR = null; s.phase = "DELTA_ISSUED"; break;
      case "GEN_ACCEPTED": s.grStatus[ev.ref.id] = "ACCEPTED"; s.acceptedGR = ev.ref; s.openDelta = null; s.phase = "ACCEPTED"; break;
      case "NORMALIZED": s.normalized = ev.ref; s.phase = "NORMALIZED"; break;
      case "OVERLAY_RECORDED": s.qrCount++; s.overlayRounds++; s.overlayQR = d.verdict === "PASS_OVERLAY" ? ev.ref : s.overlayQR; if (d.verdict === "PASS_OVERLAY") s.phase = "OVERLAY_PASSED"; break;
      case "APPROVED": s.approved = true; s.phase = "APPROVED"; break;
      case "NEEDS_ANDY": s.needsAndy = d.reason ?? ev.note; s.phase = "NEEDS_ANDY"; break;
      default: break;
    }
  }
  return s;
}

export const policyRecord = (P) => ({ schema: "guide-factory.run-policy", reconstructed: true, policy: P, canonical: P.canonical, retryCapLabel: P.retryCapLabel });
const policyMatches = (rec, P) => ["provenanceRejection", "substantiveProvenanceRejection", "provenanceRetryCap"].every((f) => rec?.policy?.[f] === P[f]);

export class FactoryRun {
  /**
   * @param {object} o  dir, visualId, application, guideId, registry ({guideId: application}), clock (()=>ISO string), policy
   */
  constructor({ dir, visualId, application, guideId, registry = {}, clock, policy, allowNonCanonical = false, factoryDirLabel = null }) {
    if (typeof clock !== "function") throw new Error("clock required (deterministic runs inject a clock)");
    Object.assign(this, { dir, visualId, application, guideId, registry, clock, policy: resolvePolicy(policy, { allowNonCanonical }), factoryDirLabel: factoryDirLabel ?? `visual-sources/${visualId}` });
    fs.mkdirSync(dir, { recursive: true });
    if (exists(dir, LAYOUT.policy)) { const on = readJson(dir, LAYOUT.policy); if (!policyMatches(on, this.policy)) throw new Refused("POLICY_MISMATCH", `policy.json on disk (${on.policy?.name}) differs from the policy this run was opened with (${this.policy.name}); the policy of a run cannot change`); }
  }
  get events() { return readEvents(this.dir); }
  get state() { return reduce(this.events); }
  store() { return loadStore(this.dir); }
  _ev(actor, type, extra = {}) { return appendEvent(this.dir, { ts: this.clock(), actor, type, ...extra }); }
  _need(phases, cmd) { const s = this.state; if (!phases.includes(s.phase)) throw new Refused("WRONG_STATE", `${cmd} not allowed in phase ${s.phase} (needs ${phases.join("|")})`); return s; }

  /** Template is written once, before anything else. */
  init() {
    if (exists(this.dir, LAYOUT.template)) return readJson(this.dir, LAYOUT.template);
    const tpl = makeTemplate(this.application, this.clock());
    writeJsonOnce(this.dir, LAYOUT.template, tpl);
    if (!exists(this.dir, LAYOUT.policy)) writeJsonOnce(this.dir, LAYOUT.policy, policyRecord(this.policy));
    return tpl;
  }
  template() { return readJson(this.dir, LAYOUT.template); }

  /** claude-research: register an Evidence Packet. Supersession only through a QR deficiency finding. */
  registerEP(body, { role = "evidence-author" } = {}) {
    const s = this._need(["NEW", "EP_REOPEN_NEEDED"], "registerEP");
    const version = s.ep.version + 1;
    const ep = makeObject("EP", { id: `EP-${this.visualId}-v${version}`, visualId: this.visualId, application: this.application, createdBy: { actor: "claude-research", role }, createdAt: this.clock(), refs: [], body });
    const bad = epProblems(ep);
    const store = this.store();
    if (s.phase === "EP_REOPEN_NEEDED") {
      const q = ep.deficiencyRef && store.get(ep.deficiencyRef.qrId);
      const f = q?.findings?.find((x) => x.id === ep.deficiencyRef.findingId);
      if (!ep.supersedes || ep.supersedes.sha256 !== s.ep.ref.sha256 || !q || q.verdict !== "EVIDENCE_DEFICIENT" || !f?.evidenceDeficiency) bad.push({ code: "EP_SUPERSEDE_NO_DEFICIENCY", class: "rule", msg: "superseding EP is refused without a QR evidenceDeficiency finding" });
    } else if (ep.supersedes || ep.deficiencyRef) bad.push({ code: "EP_SUPERSEDE_NO_DEFICIENCY", class: "rule", msg: "first EP cannot supersede anything" });
    if (bad.length) throw new Refused("EP_INVALID", `${bad.length} problem(s)`, bad);
    writeJsonOnce(this.dir, LAYOUT.ep(version), ep);
    if (s.phase === "EP_REOPEN_NEEDED") this._ev("factory-code", "EP_SUPERSEDED", { ref: s.ep.ref, note: note({ by: ep.id }) });
    this._ev("claude-research", "EP_REGISTERED", { ref: refOf(ep), from: s.phase, to: "EP_DRAFT" });
    return ep;
  }

  /** factory-code (or andy): objective sufficiency decision. INSUFFICIENT is terminal for that EP version. */
  evaluateEP({ decidedBy = "factory-code", decidedOn = this.clock().slice(0, 10) } = {}) {
    const s = this._need(["EP_DRAFT"], "evaluateEP");
    if (!["factory-code", "andy"].includes(decidedBy)) throw new Refused("BAD_ACTOR", "only factory-code or andy may decide sufficiency");
    const ep = readJson(this.dir, LAYOUT.ep(s.ep.version));
    const bad = [...sufficiencyProblems(ep), ...criticalityProblems(ep, this.template())];
    if (bad.length) { this._ev(decidedBy, "EP_INSUFFICIENT", { ref: refOf(ep), from: "EP_DRAFT", to: "EP_INSUFFICIENT", note: note({ codes: bad.map((b) => b.code), decidedOn }) }); return { sufficient: false, problems: bad }; }
    this._ev(decidedBy, "EP_SUFFICIENT", { ref: refOf(ep), from: "EP_DRAFT", to: "EP_SUFFICIENT", note: note({ decidedBy, decidedOn }) });
    return { sufficient: true, problems: [] };
  }

  /** factory-code: compile + lock the Visual Contract from a SUFFICIENT EP. */
  compileContract({ spec = null } = {}) {
    const s = this._need(["EP_SUFFICIENT"], "compileContract");
    const ep = readJson(this.dir, LAYOUT.ep(s.ep.version));
    const vc = compileVC({ ep, template: this.template(), spec, version: s.ep.version, createdAt: this.clock() });
    const bad = vcProblems(vc, ep);
    if (bad.length) throw new Refused("VC_INVALID", `${bad.length} problem(s)`, bad);
    writeJsonOnce(this.dir, LAYOUT.vc(s.ep.version), vc);
    if (spec && !exists(this.dir, LAYOUT.spec)) fs.writeFileSync(abs(this.dir, LAYOUT.spec), JSON.stringify(spec, null, 2) + "\n");
    this._ev("factory-code", "VC_COMPILED", { ref: refOf(vc), from: "EP_SUFFICIENT", to: "VC_COMPILED" });
    this._ev("factory-code", "VC_LOCKED", { ref: refOf(vc), from: "VC_COMPILED", to: "VC_LOCKED" });
    return vc;
  }

  /** What the generator needs right now: cycle number, prompt, and any open delta. */
  requestGeneration({ promptText = null } = {}) {
    const s = this._need(["VC_LOCKED", "DELTA_ISSUED", "PROVENANCE_REJECTED"], "requestGeneration");
    const cycle = s.cyclesConsumed + 1;
    if (cycle > MAX_GENERATIONS) throw new Refused("CYCLE_CAP", `cycle ${cycle} exceeds ${MAX_GENERATIONS}`);
    const vc = readJson(this.dir, LAYOUT.vc(s.vc.version));
    const prompt = renderPrompt(vc, null, promptText);
    this._ev("factory-code", "GEN_REQUESTED", { ref: s.openDelta ?? s.vc.ref, from: s.phase, to: "GEN_REQUESTED", note: note({ cycle }) });
    return { cycle, prompt, vcRef: s.vc.ref, deltaRef: s.openDelta, deltaItems: s.openDelta ? this.store().get(s.openDelta.id).items : [] };
  }

  /**
   * image-generator output in; code builds the GR from the REAL bytes, runs the provenance checks, applies the cycle policy.
   * A provenance-rejected GR is recorded (immutable evidence of the rejection) but can never be admitted.
   */
  submitGeneration(out, { promptText }) {
    const s = this._need(["GEN_REQUESTED"], "submitGeneration");
    const cycle = s.cyclesConsumed + 1;
    if (cycle > MAX_GENERATIONS) throw new Refused("CYCLE_CAP", `cycle ${cycle} exceeds ${MAX_GENERATIONS}`);
    if (!out || !Buffer.isBuffer(out.bytes)) throw new Refused("NO_BYTES", "generator returned no file");
    if (s.openDelta && out.deltaRef?.sha256 !== s.openDelta.sha256) throw new Refused("DELTA_MISMATCH", "generation does not reference the current open delta");
    if (!s.openDelta && out.deltaRef) throw new Refused("DELTA_MISMATCH", "deltaRef given but no delta is open");
    const vc = readJson(this.dir, LAYOUT.vc(s.vc.version));
    const id = `GR-${this.visualId}-${pad(s.grCount + 1)}`;
    const d = describeRaster(out.bytes, out.mediaType ?? "png");
    const gr = makeObject("GR", { id, visualId: this.visualId, application: this.application, createdBy: { actor: "image-generator", role: "generator", system: out.generator?.system }, createdAt: this.clock(), refs: [s.vc.ref, ...(s.openDelta ? [s.openDelta] : [])],
      body: { cycle, ...(s.openDelta ? { deltaRef: s.openDelta, deltaAddressed: out.deltaAddressed ?? [] } : {}), generator: out.generator, promptSha256: sha256(Buffer.from(promptText, "utf8")), promptFile: LAYOUT.prompt(id),
        imageInputs: out.imageInputs ?? [], inputHashes: out.inputHashes ?? [],
        artifact: { file: LAYOUT.grFile(id), mediaType: d.mediaType, sha256: d.sha256, bytes: d.bytes, width: d.width, height: d.height, metadataChunks: d.metadataChunks, c2pa: d.c2pa },
        attestation: out.attestation, contractAck: out.contractAck ?? { mustNotDepictAcknowledged: false },
        license: { status: "generated-original", ownershipAsserted: false, provider: out.generator?.provider, model: out.generator?.model, terms: out.licenseTerms ?? { summary: "" }, assetClass: GENERATED_ASSET_CLASS, rightsBasis: RIGHTS_BASIS },
        providerProvenance: { requestId: out.requestId ?? null, generationId: out.generationId ?? null, c2pa: d.c2pa } } });
    const res = checkGeneration({ gr, bytes: out.bytes, vc, promptText });
    // all validation done -> now write (the GR record + candidate bytes are kept even when rejected)
    writeFileOnce(this.dir, LAYOUT.prompt(id), promptText);
    writeFileOnce(this.dir, LAYOUT.grFile(id), out.bytes);
    writeJsonOnce(this.dir, LAYOUT.gr(id), gr);
    this._ev("image-generator", "GEN_SUBMITTED", { ref: refOf(gr), from: "GEN_REQUESTED", to: "PROVENANCE_CHECK", note: note({ cycle }) });
    if (res.ok) { this._ev("factory-code", "PROVENANCE_VALID", { ref: refOf(gr), from: "PROVENANCE_CHECK", to: "QA_PENDING" }); return { gr, accepted: false, provenance: "valid", problems: [] }; }
    const P = this.policy;
    const burn = res.substantive ? P.substantiveProvenanceRejection === "burn-cycle-needs-andy" : P.provenanceRejection === "burn-cycle-needs-andy";
    const retriesAfter = s.provenanceRetries + (burn ? 0 : 1);
    const toAndy = res.substantive ? true : P.provenanceRejection === "burn-cycle-needs-andy" || retriesAfter > P.provenanceRetryCap;
    const codes = res.problems.map((p) => p.code);
    this._ev("factory-code", "PROVENANCE_REJECTED", { ref: refOf(gr), from: "PROVENANCE_CHECK", to: "PROVENANCE_REJECTED", note: note({ codes, substantive: res.substantive, burn, retries: retriesAfter, policy: P.name }) });
    if (toAndy) this._ev("factory-code", "NEEDS_ANDY", { ref: refOf(gr), from: "PROVENANCE_REJECTED", to: "NEEDS_ANDY", note: note({ reason: res.substantive ? "substantive provenance failure" : P.provenanceRejection === "burn-cycle-needs-andy" ? "provenance rejection (BRICK_C_REPORT policy)" : "provenance retry cap exceeded", policy: P.name }) });
    else if (this.state.cyclesConsumed + 1 > MAX_GENERATIONS) this._ev("factory-code", "NEEDS_ANDY", { ref: refOf(gr), from: "PROVENANCE_REJECTED", to: "NEEDS_ANDY", note: note({ reason: "generation cycles exhausted", policy: P.name }) });
    return { gr, accepted: false, provenance: "rejected", problems: res.problems, burned: burn, needsAndy: this.state.phase === "NEEDS_ANDY" };
  }

  /** claude-qa: INTERNAL content-stage QR. Verdict is computed by code. An internal PASS does NOT admit anything (see submitIndependentReview). */
  submitQA(sub) { return this._review(sub, "internal"); }
  /** hermes: INDEPENDENT final content-stage QR. Claude (any actor/model/system) is refused here: Claude reviewing Claude is not independent QA. */
  submitIndependentReview(sub) { return this._review(sub, "independent"); }

  _review(sub, reviewClass) {
    const cmd = reviewClass === "independent" ? "submitIndependentReview" : "submitQA";
    const s = this._need(reviewClass === "independent" ? ["QA_PENDING", "INTERNAL_QA_PASSED"] : ["QA_PENDING"], cmd);
    const store = this.store();
    const gr = store.get(s.pendingGR.id), vc = store.get(s.vc.ref.id), ep = store.get(s.ep.ref.id);
    const priorPasses = [...store.values()].filter((o) => o.schema?.endsWith("qa-result") && o.verdict === "PASS_FOR_OVERLAY_QA").map((o) => o.id);
    const bad = qaSubmissionProblems({ sub, vc, gr, priorPasses, reviewClass });
    if (bad.length) throw new Refused("QR_INVALID", `${bad.length} problem(s)`, bad);
    const qr = buildQR({ visualId: this.visualId, application: this.application, n: s.qrCount + 1, vc, gr, ep, sub, correctionsUsed: s.correctionsIssued, createdAt: this.clock(), reviewClass });
    const qb = qrProblems(qr);
    if (qb.length) throw new Refused("QR_INVALID", `${qb.length} problem(s)`, qb);
    let cd = null;
    if (qr.verdict === "CORRECTIONS_REQUIRED") { cd = buildCD({ visualId: this.visualId, application: this.application, n: s.cdCount + 1, qr, gr, cycle: s.correctionsIssued + 1, priorPassRefs: {}, createdAt: this.clock() }); const cb = cdProblems(cd, qr, new Map([...store, [qr.id, qr]])); if (cb.length) throw new Refused("CD_INVALID", `${cb.length} problem(s)`, cb); }
    writeJsonOnce(this.dir, LAYOUT.qr(qr.id), qr);
    this._ev(qr.reviewer.actor, "QA_RECORDED", { ref: refOf(qr), from: s.phase, to: qr.verdict, note: note({ verdict: qr.verdict, failedGates: qr.failedGates, reviewClass }) });
    if (cd) { writeJsonOnce(this.dir, LAYOUT.cd(cd.id), cd); this._ev("factory-code", "DELTA_ISSUED", { ref: refOf(cd), from: "CORRECTIONS_PENDING", to: "DELTA_ISSUED" }); }
    if (qr.verdict === "ESCALATE") this._ev("factory-code", "NEEDS_ANDY", { ref: refOf(qr), from: "QA_RECORDED", to: "NEEDS_ANDY", note: note({ reason: "correction cap reached without convergence" }) });
    if (qr.verdict === "EVIDENCE_DEFICIENT" && this.state.cyclesConsumed >= MAX_GENERATIONS) this._ev("factory-code", "NEEDS_ANDY", { ref: refOf(qr), from: "QA_RECORDED", to: "NEEDS_ANDY", note: note({ reason: "generation cycles exhausted" }) });
    return { qr, cd };
  }

  /** ADMISSION GATE: a generation becomes admitted output only if provenance-valid AND independently QA-passed AND intact on disk. */
  admit() {
    const s = this._need(["QA_PASSED"], "admit");
    const store = this.store();
    const gr = store.get(s.pendingGR?.id), qr = store.get(s.lastQR?.id);
    const why = [];
    if (!gr || s.grStatus[gr.id] !== "PROVENANCE_VALID") why.push("generation is not provenance-valid");
    if (!qr || qr.verdict !== "PASS_FOR_OVERLAY_QA" || qr.stage !== "content") why.push("no passing content-stage QA");
    if (!independentFinalReview(qr)) why.push("final QA is not an independent (hermes) review; internal Claude QA cannot admit output");
    if (gr && s.pendingGR && contentHashOf(gr) !== s.pendingGR.sha256) why.push("generation record no longer matches the hash the event log recorded");
    if (gr && !why.length) { const re = checkGeneration({ gr, bytes: readBytes(this.dir, gr.artifact.file), vc: store.get(s.vc.ref.id), promptText: readBytes(this.dir, gr.promptFile).toString("utf8") }); if (!re.ok) why.push(`provenance re-check from the stored bytes fails: ${re.problems.map((p) => p.code).join(",")}`); }
    if (qr && gr && !qr.refs.some((r) => r.id === gr.id && r.sha256 === gr.contentHash)) why.push("QA does not reference this generation");
    if (qr && gr && (qr.reviewer.actor === gr.attestation.attestedBy || qr.reviewer.system === gr.generator.system)) why.push("reviewer is not independent of the generator");
    if (gr && sha256(readBytes(this.dir, gr.artifact.file)) !== gr.artifact.sha256) why.push("candidate file hash no longer matches its record");
    if (why.length) throw new Refused("ADMISSION_REFUSED", why.join("; "), why.map((w) => ({ code: "ADMISSION", class: "rule", msg: w })));
    this._ev("factory-code", "GEN_ACCEPTED", { ref: refOf(gr), from: "QA_PASSED", to: "ACCEPTED" });
    return gr;
  }

  /** Normalization of the ADMITTED generation only (never a rejected one). */
  normalize() {
    const s = this._need(["ACCEPTED"], "normalize");
    const gr = this.store().get(s.acceptedGR.id);
    let r;
    try { r = normalizeRaster(readBytes(this.dir, gr.artifact.file)); } catch (e) { if (e instanceof NormalizationRefused) throw new Refused(`NORMALIZE_${e.code}`, e.message); throw e; }
    const rel = LAYOUT.normalized(this.visualId);
    writeFileOnce(this.dir, rel, r.bytes);
    fs.writeFileSync(abs(this.dir, `normalized/${this.visualId}.record.json`), JSON.stringify({ source: r.source, normalized: r.normalized, downscaled: r.downscaled }, null, 2) + "\n");
    this._ev("factory-code", "NORMALIZED", { ref: { id: `NORM-${this.visualId}`, sha256: r.normalized.sha256 }, from: "ACCEPTED", to: "NORMALIZED", note: note({ downscaled: r.downscaled }) });
    return r;
  }

  /** Overlay-stage QA, only meaningful when the contract has callouts. Max MAX_OVERLAY_ROUNDS rounds. */
  overlayCheck({ reviewer, results }) {
    const s = this._need(["NORMALIZED", "OVERLAY_PASSED"], "overlayCheck");
    const store = this.store(); const vc = store.get(s.vc.ref.id), gr = store.get(s.acceptedGR.id), ep = store.get(s.ep.ref.id);
    if (!vc.callouts.length) throw new Refused("NO_CALLOUTS", "contract has no callouts; overlay QA does not apply");
    if (s.overlayRounds >= MAX_OVERLAY_ROUNDS) throw new Refused("OVERLAY_CAP", "overlay rounds exhausted");
    const rb = reviewerClassProblems(reviewer, "independent");
    if (rb.length) throw new Refused("QR_NOT_INDEPENDENT", "overlay reviewer must be an independent (hermes, non-Claude) reviewer", rb);
    if (reviewer.actor === gr.attestation.attestedBy || reviewer.system === gr.generator.system) throw new Refused("QR_NOT_INDEPENDENT", "overlay reviewer must be independent of the generator");
    const allPass = vc.callouts.every((c) => results?.find((r) => r.callout === c.label)?.result === "PASS");
    const round = s.overlayRounds + 1;
    const verdict = overlayVerdict({ result: allPass ? "PASS" : "FAIL", round });
    const qr = makeObject("QR", { id: `QR-${this.visualId}-${pad(s.qrCount + 1)}`, visualId: this.visualId, application: this.application, createdBy: { actor: reviewer.actor, role: "independent-reviewer", system: reviewer.system }, createdAt: this.clock(), refs: [refOf(gr), refOf(vc), refOf(ep)],
      body: { stage: "overlay", reviewClass: "independent", rubricVersion: RUBRIC_VERSION, reviewer, provenanceCheck: { validated: true, notes: "n/a at overlay stage" }, checks: results, findings: [], regressionCheck: [], verdict, failedGates: allPass ? [] : ["VISUAL_ACCURACY"], round } });
    writeJsonOnce(this.dir, LAYOUT.qr(qr.id), qr);
    this._ev(reviewer.actor, "OVERLAY_RECORDED", { ref: refOf(qr), from: s.phase, to: verdict, note: note({ verdict, round }) });
    if (verdict === "ESCALATE") this._ev("factory-code", "NEEDS_ANDY", { ref: refOf(qr), from: "OVERLAY_RECORDED", to: "NEEDS_ANDY", note: note({ reason: "overlay rounds exhausted" }) });
    return qr;
  }

  /** Assemble the Approved Artifact + registry-entry PREVIEW. Nothing is written to a registry or public/. */
  approve({ guideId = this.guideId, step, presentation, authority = null }) {
    const s = this._need(["NORMALIZED", "OVERLAY_PASSED"], "approve");
    if (!this.policy.canonical) throw new Refused("POLICY_NON_CANONICAL", `policy ${this.policy.name} is not the locked canonical ARCHITECTURE_V1; a run under it can never be approved`);
    const store = this.store();
    const ep = store.get(s.ep.ref.id), vc = store.get(s.vc.ref.id), gr = store.get(s.acceptedGR.id), qr = store.get(s.lastQR.id), template = this.template();
    const overlayQr = s.overlayQR ? store.get(s.overlayQR.id) : null;
    const normRec = readJson(this.dir, `normalized/${this.visualId}.record.json`);
    const normBytes = readBytes(this.dir, LAYOUT.normalized(this.visualId));
    const norm = { normalized: normRec.normalized };
    const hasCallouts = vc.callouts.length > 0;
    const gates = {
      evidenceSufficient: s.ep.status === "SUFFICIENT", contractLocked: !!s.vc.ref, provenanceValid: s.grStatus[gr.id] === "ACCEPTED", contentQaPass: qr.verdict === "PASS_FOR_OVERLAY_QA",
      overlayQaPass: hasCallouts ? overlayQr?.verdict === "PASS_OVERLAY" : "na", calloutsVerified: hasCallouts ? overlayQr?.verdict === "PASS_OVERLAY" : "na",
      vehicleVerified: !!this.registry[guideId] && sameApplication(this.registry[guideId], this.application),
      hashesConsistent: sha256(normBytes) === norm.normalized.sha256 && gr.artifact.sha256 !== norm.normalized.sha256 && sha256(readBytes(this.dir, gr.artifact.file)) === gr.artifact.sha256,
      reviewerIndependent: qr.reviewer.actor !== gr.attestation.attestedBy && qr.reviewer.system !== gr.generator.system,
      independentFinalReview: independentFinalReview(qr) && (hasCallouts ? independentFinalReview(overlayQr) : true),
    };
    if (!gatesPass(gates)) throw new Refused("GATES_FAILED", `gates not all true: ${GATE_NAMES.filter((k) => !(gates[k] === true || gates[k] === "na")).join(", ")}`, GATE_NAMES.filter((k) => !(gates[k] === true || gates[k] === "na")).map((k) => ({ code: `GATE_${k}`, class: "rule", msg: k })));
    if (!presentation?.alt?.trim() || !presentation?.caption?.trim()) throw new Refused("PRESENTATION", "alt text and caption are required");
    const events = this.events;
    const reg = buildRegistryEntry({ guideId, step, ep, vc, gr, qr, overlayQr, template, events, norm, presentation, authority, now: this.clock(), factoryDirLabel: this.factoryDirLabel });
    const regText = JSON.stringify(reg, null, 2) + "\n";
    const aa = buildAA({ ep, vc, gr, qr, overlayQr, template, norm, gates, authority, registryRef: { file: LAYOUT.registryPreview, sha256: sha256(Buffer.from(regText)) }, createdAt: this.clock() });
    writeFileOnce(this.dir, LAYOUT.registryPreview, regText);
    writeJsonOnce(this.dir, LAYOUT.aa, aa);
    this._ev("factory-code", "APPROVED", { ref: refOf(aa), from: s.phase, to: "APPROVED" });
    return { aa, registry: reg };
  }
}

export { reduce as deriveState, contractItemIds, path };

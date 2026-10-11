// RECONSTRUCTED-V1 | NOT the lost original.
// Read-only integrity + REPLAY verifier for a visual's directory (cf. VD "factory-check ... validates a step directory and its event log").
// C-3 checks: event hash chain; every object's contentHash; every cross-reference hash; every event ref; candidate/prompt/normalized
//   file hashes; AA gates and registry-preview hash.
// C-4 adds (the verifier no longer trusts anything the event log or an object merely CLAIMS):
//   - policy.json present; a run under a non-canonical policy can never be APPROVED
//   - duplicate object ids on disk / filename<->id mismatch
//   - transition legality: every event must be legal from the state the PRIOR events produce (valid chain != valid history)
//   - GR cycle replay: each generation's cycle must equal cyclesConsumed+1 at its submission (provenance rejection burns no cycle)
//   - provenance RE-CHECK from the stored bytes for every generation; PROVENANCE_VALID/REJECTED events must agree with it
//   - QA verdict + failedGates RECOMPUTED from the QR's own checks/findings; event notes must agree with the QR object
//   - independence: an "independent" QR must be hermes and non-Claude; admission requires an independent PASS
//   - correction deltas: prior-artifact references must exist and have passed; cycle numbering replayed
//   - normalized artifact dimensions; retry-cap escalation
// Never writes.
import fs from "node:fs";
import { sha256, contentHashOf } from "./canon.mjs";
import { readEvents, verifyChain } from "./eventlog.mjs";
import { envelopeProblems, refProblems } from "./objects.mjs";
import { listObjectFiles, abs, exists, readBytes, readJson, LAYOUT } from "./store.mjs";
import { aaProblems, independentFinalReview } from "./artifact.mjs";
import { reduce } from "./machine.mjs";
import { checkGeneration, describeRaster } from "./provenance.mjs";
import { computeVerdict, failedGatesOf, overlayVerdict, qrProblems, cdProblems, reviewerClassProblems } from "./qa.mjs";
import { FRAME, MAX_GENERATIONS, QA_STAGES } from "./enums.mjs";
import { isCanonical } from "./policy.mjs";

const kindOf = (id) => id.split("-")[0];
const parse = (s) => { try { return s ? JSON.parse(s) : {}; } catch { return {}; } };

export const ALLOWED_FROM = Object.freeze({
  EP_REGISTERED: ["NEW", "EP_REOPEN_NEEDED"], EP_SUPERSEDED: ["EP_REOPEN_NEEDED"], EP_SUFFICIENT: ["EP_DRAFT"], EP_INSUFFICIENT: ["EP_DRAFT"],
  VC_COMPILED: ["EP_SUFFICIENT"], VC_LOCKED: ["EP_SUFFICIENT"], GEN_REQUESTED: ["VC_LOCKED", "DELTA_ISSUED", "PROVENANCE_REJECTED"], GEN_SUBMITTED: ["GEN_REQUESTED"],
  PROVENANCE_VALID: ["PROVENANCE_CHECK"], PROVENANCE_REJECTED: ["PROVENANCE_CHECK"], QA_RECORDED: ["QA_PENDING", "INTERNAL_QA_PASSED"], DELTA_ISSUED: ["CORRECTIONS_PENDING"],
  GEN_ACCEPTED: ["QA_PASSED"], NORMALIZED: ["ACCEPTED"], OVERLAY_RECORDED: ["NORMALIZED", "OVERLAY_PASSED"], APPROVED: ["NORMALIZED", "OVERLAY_PASSED"],
});
const TERMINAL = ["APPROVED", "NEEDS_ANDY"];

export function verifyRun(dir) {
  const bad = [];
  const events = readEvents(dir);
  bad.push(...verifyChain(events).map((m) => `events: ${m}`));

  // ---- policy
  let policyRec = null;
  if (!exists(dir, LAYOUT.policy)) bad.push("policy.json missing (a run must record the correction-cycle policy it ran under)");
  else { try { policyRec = readJson(dir, LAYOUT.policy); } catch { bad.push("policy.json is not valid JSON"); } }
  const canonical = policyRec ? isCanonical(policyRec.policy) : false;
  if (policyRec && !!policyRec.canonical !== canonical) bad.push("policy.json claims canonical=" + policyRec.canonical + " but its behavior fields say " + canonical);

  // ---- objects
  const files = listObjectFiles(dir);
  const store = new Map();
  for (const { rel, obj } of files) {
    if (store.has(obj.id)) bad.push(`duplicate object id ${obj.id} (also in ${rel})`);
    store.set(obj.id, obj);
    const stem = rel.split("/").pop();
    const okName = /^evidence-packet\.v(\d+)\.json$/.test(stem) ? obj.id.endsWith(`-v${stem.match(/v(\d+)/)[1]}`) && kindOf(obj.id) === "EP"
      : /^visual-contract\.v(\d+)\.json$/.test(stem) ? obj.id.endsWith(`-v${stem.match(/v(\d+)/)[1]}`) && kindOf(obj.id) === "VC"
        : /\.(record|result|delta)\.json$/.test(stem) ? stem.replace(/\.(record|result|delta)\.json$/, "") === obj.id : true;
    if (!okName) bad.push(`${rel}: file name does not match object id ${obj.id}`);
  }
  for (const o of store.values()) {
    const k = kindOf(o.id);
    bad.push(...envelopeProblems(k, o).map((m) => `${o.id}: ${m}`));
    bad.push(...refProblems(o, store).map((m) => `${o.id}: ${m}`));
    if (k === "GR") {
      if (!exists(dir, o.artifact.file)) bad.push(`${o.id}: candidate file missing`);
      else if (sha256(readBytes(dir, o.artifact.file)) !== o.artifact.sha256) bad.push(`${o.id}: candidate file hash differs from its record`);
      if (!exists(dir, o.promptFile)) bad.push(`${o.id}: prompt file missing`);
      else if (sha256(readBytes(dir, o.promptFile)) !== o.promptSha256) bad.push(`${o.id}: prompt file hash differs from promptSha256`);
    }
    if (k === "QR") bad.push(...qrProblems(o).filter((p) => p.code !== "ENVELOPE").map((p) => `${o.id}: ${p.code}: ${p.msg}`));
  }
  for (const ev of events) if (ev.ref && /^(EP|VC|GR|QR|CD|AA)-/.test(ev.ref.id)) {
    const o = store.get(ev.ref.id);
    if (!o) bad.push(`event ${ev.seq}: ref ${ev.ref.id} not on disk`);
    else if (contentHashOf(o) !== ev.ref.sha256) bad.push(`event ${ev.seq}: ref ${ev.ref.id} hash differs from the object on disk`);
  }

  // ---- replay: transition legality + semantic re-derivation
  const grOf = (id) => store.get(id);
  const recheck = (gr) => {
    if (!gr?.artifact || !exists(dir, gr.artifact.file) || !exists(dir, gr.promptFile)) return null;
    const vc = store.get(gr.refs?.[0]?.id);
    return checkGeneration({ gr, bytes: readBytes(dir, gr.artifact.file), vc, promptText: readBytes(dir, gr.promptFile).toString("utf8") });
  };
  let prev = null;
  events.forEach((ev, i) => {
    const pre = reduce(events.slice(0, i));
    const w = `event ${ev.seq} (${ev.type})`;
    if (TERMINAL.includes(pre.phase)) { bad.push(`${w}: occurs after the run reached ${pre.phase}`); prev = ev; return; }
    if (ev.type !== "NEEDS_ANDY") {
      const ok = ALLOWED_FROM[ev.type];
      if (!ok) bad.push(`${w}: unknown event type`);
      else if (!ok.includes(pre.phase)) bad.push(`${w}: illegal transition — not allowed from phase ${pre.phase}`);
      if (ev.type === "VC_LOCKED" && prev?.type !== "VC_COMPILED") bad.push(`${w}: VC_LOCKED does not directly follow VC_COMPILED`);
    }
    const d = parse(ev.note);
    const obj = ev.ref ? store.get(ev.ref.id) : null;
    switch (ev.type) {
      case "GEN_SUBMITTED": {
        if (obj) {
          if (obj.cycle !== pre.cyclesConsumed + 1) bad.push(`${w}: ${obj.id} claims cycle ${obj.cycle} but cycle ${pre.cyclesConsumed + 1} was current (a provenance rejection must not consume a cycle)`);
          if (obj.cycle > MAX_GENERATIONS) bad.push(`${w}: cycle ${obj.cycle} beyond the cap`);
          if (!obj.id.endsWith(`-${String(pre.grCount + 1).padStart(3, "0")}`)) bad.push(`${w}: generation id ${obj.id} out of sequence`);
        }
        break;
      }
      case "PROVENANCE_VALID": case "PROVENANCE_REJECTED": {
        const r = obj && recheck(obj);
        if (r) {
          if (ev.type === "PROVENANCE_VALID" && !r.ok) bad.push(`${w}: ${obj.id} was marked provenance-valid but fails the provenance re-check from its stored bytes (${r.problems.map((p) => p.code).join(",")})`);
          if (ev.type === "PROVENANCE_REJECTED" && r.ok) bad.push(`${w}: ${obj.id} was marked provenance-rejected but passes the provenance re-check`);
        }
        if (ev.type === "PROVENANCE_REJECTED") {
          if (canonical && d.burn === true) bad.push(`${w}: provenance rejection burned a correction cycle under the canonical policy (ARCHITECTURE_V1 forbids it)`);
          const retries = pre.provenanceRetries + (d.burn ? 0 : 1);
          if (d.retries !== undefined && !d.burn && d.retries !== retries) bad.push(`${w}: retry counter ${d.retries} does not match the replayed count ${retries}`);
          const cap = policyRec?.policy?.provenanceRetryCap ?? 3;
          if ((d.substantive || retries > cap) && events[i + 1]?.type !== "NEEDS_ANDY") bad.push(`${w}: ${d.substantive ? "substantive provenance failure" : "retry cap exceeded"} but the run was not escalated to NEEDS_ANDY`);
        }
        break;
      }
      case "QA_RECORDED": {
        if (!obj) break;
        if (obj.stage !== "content") bad.push(`${w}: ${obj.id} is not a content-stage QR`);
        if (!pre.pendingGR || !obj.refs.some((r) => r.id === pre.pendingGR.id && r.sha256 === pre.pendingGR.sha256)) bad.push(`${w}: ${obj.id} does not review the pending generation`);
        const vc = store.get(obj.refs?.[1]?.id);
        if (vc) {
          const v = computeVerdict({ vc, checks: obj.checks, findings: obj.findings, provenanceCheck: obj.provenanceCheck, regressionCheck: obj.regressionCheck ?? [], correctionsUsed: pre.correctionsIssued });
          if (v !== obj.verdict) bad.push(`${w}: QA verdict tampered — ${obj.id} says ${obj.verdict}, its own checks/findings compute ${v}`);
          const fg = failedGatesOf(obj.findings, obj.provenanceCheck).sort().join(",");
          if (fg !== [...obj.failedGates].sort().join(",")) bad.push(`${w}: ${obj.id} failedGates do not match its findings`);
        }
        if (d.verdict !== obj.verdict) bad.push(`${w}: event note verdict ${d.verdict} differs from the QR (${obj.verdict})`);
        if (d.reviewClass !== obj.reviewClass) bad.push(`${w}: event note reviewClass ${d.reviewClass} differs from the QR (${obj.reviewClass})`);
        if (ev.actor !== obj.reviewer?.actor) bad.push(`${w}: event actor ${ev.actor} is not the QR reviewer ${obj.reviewer?.actor}`);
        const gr = grOf(pre.pendingGR?.id);
        if (gr && (obj.reviewer?.actor === gr.attestation?.attestedBy || obj.reviewer?.system === gr.generator?.system)) bad.push(`${w}: reviewer is not independent of the generator`);
        break;
      }
      case "DELTA_ISSUED": {
        if (!obj) break;
        const qr = store.get(pre.lastQR?.id);
        if (!qr || qr.verdict !== "CORRECTIONS_REQUIRED" || !obj.refs.some((r) => r.id === qr.id)) bad.push(`${w}: delta does not reference the CORRECTIONS_REQUIRED QR that caused it`);
        else bad.push(...cdProblems(obj, qr, store).map((p) => `${w}: ${p.code}: ${p.msg}`));
        if (obj.cycle !== pre.correctionsIssued + 1) bad.push(`${w}: delta cycle ${obj.cycle} should be ${pre.correctionsIssued + 1}`);
        break;
      }
      case "GEN_ACCEPTED": {
        const gr = obj, qr = store.get(pre.lastQR?.id);
        if (!gr || pre.grStatus[gr.id] !== "PROVENANCE_VALID") bad.push(`${w}: admitted output without provenance-valid status`);
        if (gr) { const r = recheck(gr); if (r && !r.ok) bad.push(`${w}: admitted output ${gr.id} lacks required provenance (re-check from bytes fails: ${r.problems.map((p) => p.code).join(",")})`); }
        if (!qr || qr.verdict !== "PASS_FOR_OVERLAY_QA" || qr.stage !== "content") bad.push(`${w}: admitted without a passing content-stage QR`);
        else if (!independentFinalReview(qr)) bad.push(`${w}: admitted on a non-independent QR (${qr.id}: ${qr.reviewClass}/${qr.reviewer?.actor}); internal Claude QA cannot admit output`);
        if (qr && gr && !qr.refs.some((r) => r.id === gr.id && r.sha256 === contentHashOf(gr))) bad.push(`${w}: QR does not reference this generation`);
        break;
      }
      case "NORMALIZED": {
        const nf = LAYOUT.normalized(events[0] && store.size ? [...store.values()][0].visualId : "");
        if (exists(dir, nf)) {
          const b = readBytes(dir, nf), dsc = describeRaster(b, "png");
          if (sha256(b) !== ev.ref.sha256) bad.push(`${w}: normalized file hash differs from the event record`);
          if (dsc.width !== FRAME.width || dsc.height !== FRAME.height) bad.push(`${w}: normalized file is ${dsc.width}x${dsc.height}, expected exactly ${FRAME.width}x${FRAME.height}`);
          if (dsc.metadataChunks.length) bad.push(`${w}: normalized file still carries metadata chunks`);
        } else bad.push(`${w}: normalized file missing`);
        break;
      }
      case "OVERLAY_RECORDED": {
        if (!obj) break;
        if (obj.stage !== "overlay" || !QA_STAGES.includes(obj.stage)) bad.push(`${w}: ${obj.id} is not an overlay-stage QR`);
        bad.push(...reviewerClassProblems(obj.reviewer, obj.reviewClass).map((p) => `${w}: ${p.code}: ${p.msg}`));
        if (obj.reviewClass !== "independent") bad.push(`${w}: overlay review must be independent`);
        const vc = store.get(pre.vc.ref.id);
        if (vc) { const allPass = vc.callouts.every((c) => obj.checks?.find((r) => r.callout === c.label)?.result === "PASS"); const v = overlayVerdict({ result: allPass ? "PASS" : "FAIL", round: pre.overlayRounds + 1 }); if (v !== obj.verdict) bad.push(`${w}: overlay verdict tampered — ${obj.id} says ${obj.verdict}, its checks compute ${v}`); }
        break;
      }
      default: break;
    }
    prev = ev;
  });

  // ---- approval
  const aa = [...store.values()].find((o) => o.id.startsWith("AA-"));
  if (aa) {
    const nf = LAYOUT.normalized(aa.visualId);
    const nsha = exists(dir, nf) ? sha256(readBytes(dir, nf)) : null;
    bad.push(...aaProblems(aa, store, { normalizedSha256: nsha }).map((p) => `${aa.id}: ${p.msg}`));
    if (!exists(dir, LAYOUT.registryPreview)) bad.push(`${aa.id}: registry preview missing`);
    else if (sha256(fs.readFileSync(abs(dir, LAYOUT.registryPreview))) !== aa.registryEntryRef.sha256) bad.push(`${aa.id}: registry preview hash differs from registryEntryRef`);
    if (!events.some((e) => e.type === "APPROVED")) bad.push(`${aa.id}: approved.json exists but no APPROVED event`);
    if (exists(dir, LAYOUT.registryPreview)) { // the preview pins the event-log head it was built from: catches a consistently re-chained / truncated history
      try { const g = readJson(dir, LAYOUT.registryPreview)?.entry?.provenance?.generatedRaster; const at = events[(g?.eventsSeq ?? 0) - 1];
        if (!at || at.eventSha256 !== g.eventsHeadSha256) bad.push(`${aa.id}: registry preview pins event ${g?.eventsSeq} head ${String(g?.eventsHeadSha256).slice(0, 12)}…, which the event log no longer matches (history was rewritten or truncated)`); } catch { bad.push(`${aa.id}: registry preview unreadable`); }
    }
    if (policyRec && !canonical) bad.push(`${aa.id}: approved under non-canonical policy ${policyRec.policy?.name}`);
    const contentQr = aa.refs.map((r) => store.get(r.id)).find((o) => o?.id.startsWith("QR-") && o.stage === "content");
    if (!contentQr || !independentFinalReview(contentQr)) bad.push(`${aa.id}: approved without an independent final review`);
  } else if (events.some((e) => e.type === "APPROVED")) bad.push("APPROVED event without approved.json");
  return { ok: bad.length === 0, problems: bad, objects: store.size, events: events.length };
}

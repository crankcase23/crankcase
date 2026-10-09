// RECONSTRUCTED TEST suite — state machine, QA/delta rules, cycle accounting, and the CORRECTION-CYCLE POLICY SWITCH.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Refused, snapshot } from "../src/store.mjs";
import { POLICIES, DEFAULT_POLICY, resolvePolicy } from "../src/policy.mjs";
import { ScriptedGenerator, runGeneration } from "../src/actors.mjs";
import { newRun, driveToQaPending, passQA, passAll, independentQA, INDEPENDENT_REVIEWER, failQA, goodOutput, goodAttestation, synthPng, fixtureEPBody, makeClock, APPLICATION, GUIDE_ID, REGISTRY } from "./support/fixtures.mjs";
import { FactoryRun } from "../src/machine.mjs";
import { verifyRun } from "../src/verify.mjs";

const PNG = (seed) => synthPng(1600, 1000, { seed });
const bad = (over = {}) => goodOutput(PNG(9), { attestation: { ...goodAttestation(), attestedBy: "claude-qa", ...over } }); // metadata-class defect
const substantive = () => goodOutput(PNG(9), { imageInputs: [{ file: "ref.jpg" }] });
async function setup(policy) { const run = newRun("m", { policy }); run.registerEP(fixtureEPBody()); run.evaluateEP(); run.compileContract({}); return run; }
const gen = (run, ...outs) => runGeneration(run, new ScriptedGenerator(outs), { promptText: "p\n" });
const refused = (fn, code) => assert.throws(fn, (e) => e instanceof Refused && (code ? e.code === code : true), code);

test("RECONSTRUCTED TEST: full happy path reaches APPROVED with every gate true and a verified directory", async () => {
  const run = newRun("happy");
  await driveToQaPending(run);
  passAll(run); run.admit(); run.normalize();
  const { aa } = run.approve({ step: 99, presentation: { alt: "synthetic", caption: "synthetic" }, authority: { approvedBy: "andy", approvedOn: "2026-10-04" } });
  assert.equal(run.state.phase, "APPROVED");
  assert.ok(Object.values(aa.gates).every((g) => g === true || g === "na"));
  assert.deepEqual(verifyRun(run.dir).problems, []);
  assert.deepEqual(run.events.map((e) => e.type), ["EP_REGISTERED", "EP_SUFFICIENT", "VC_COMPILED", "VC_LOCKED", "GEN_REQUESTED", "GEN_SUBMITTED", "PROVENANCE_VALID", "QA_RECORDED", "QA_RECORDED", "GEN_ACCEPTED", "NORMALIZED", "APPROVED"]);
});

test("RECONSTRUCTED TEST: deterministic repeated execution — two runs with the same inputs and clock are byte-identical", async () => {
  const mk = async () => { const run = newRun("det"); await driveToQaPending(run); passAll(run); run.admit(); run.normalize(); run.approve({ step: 99, presentation: { alt: "a", caption: "c" } }); return snapshot(run.dir); };
  assert.deepEqual(await mk(), await mk());
});

test("RECONSTRUCTED TEST: commands out of order are refused and leave the directory byte-identical", async () => {
  const run = newRun("order");
  const s0 = snapshot(run.dir);
  refused(() => run.compileContract({}), "WRONG_STATE"); refused(() => run.requestGeneration(), "WRONG_STATE"); refused(() => run.admit(), "WRONG_STATE"); refused(() => run.normalize(), "WRONG_STATE");
  refused(() => run.approve({ step: 1, presentation: { alt: "a", caption: "c" } }), "WRONG_STATE"); refused(() => run.evaluateEP(), "WRONG_STATE");
  assert.deepEqual(snapshot(run.dir), s0);
  run.registerEP(fixtureEPBody()); refused(() => run.registerEP(fixtureEPBody()), "WRONG_STATE");
});

test("RECONSTRUCTED TEST: only factory-code or andy may decide EP sufficiency", () => {
  const run = newRun("actor"); run.registerEP(fixtureEPBody());
  refused(() => run.evaluateEP({ decidedBy: "claude-research" }), "BAD_ACTOR");
});

test("RECONSTRUCTED TEST: QA verdict is COMPUTED — an actor cannot assert PASS over a failing check", async () => {
  const run = newRun("v"); await driveToQaPending(run);
  const { qr } = run.submitQA({ ...failQA(run), verdict: "PASS_FOR_OVERLAY_QA" });
  assert.equal(qr.verdict, "CORRECTIONS_REQUIRED");
});

test("RECONSTRUCTED TEST: QA refused — reviewer not independent, missing check, FAIL without finding, uncited finding, bad rubric, bad regression ref", async () => {
  const run = newRun("qa"); await driveToQaPending(run);
  const s0 = snapshot(run.dir);
  refused(() => run.submitQA(passQA(run, { reviewer: { actor: "claude-qa", model: "m", system: "synthetic-generator" } })), "QR_INVALID");
  refused(() => run.submitQA(passQA(run, { reviewer: { actor: "image-generator", model: "m", system: "s" } })), "QR_INVALID");
  const p = passQA(run); refused(() => run.submitQA({ ...p, checks: p.checks.slice(1) }), "QR_INVALID");
  const f = failQA(run); refused(() => run.submitQA({ ...f, findings: [] }), "QR_INVALID");
  refused(() => run.submitQA({ ...f, findings: [{ ...f.findings[0], contractItemRef: "MD-nope" }] }), "QR_INVALID");
  refused(() => run.submitQA({ ...p, rubricVersion: "CG-QA-v0.9" }), "QR_INVALID");
  refused(() => run.submitQA({ ...f, regressionCheck: [{ element: "fixture-hose", priorPassRef: "QR-none-001", now: "FAIL" }] }), "QR_INVALID");
  refused(() => run.submitQA({ ...f, findings: [{ ...f.findings[0], regression: true, severity: "COSMETIC" }] }), "QR_INVALID");
  assert.deepEqual(snapshot(run.dir), s0);
});

test("RECONSTRUCTED TEST: COSMETIC and IGNORE findings never block a PASS", async () => {
  const run = newRun("cos"); await driveToQaPending(run);
  const p = passQA(run); p.findings = [{ id: "C1", severity: "COSMETIC", contractItemRef: "MD-fixture-hose", description: "slightly dim", requiredChange: "optional", fixType: "modify" }, { id: "C2", severity: "IGNORE", contractItemRef: "MD-fixture-hose", description: "n/a", requiredChange: "none" }];
  assert.equal(run.submitQA(p).qr.verdict, "PASS_FOR_OVERLAY_QA");
});

test("RECONSTRUCTED TEST: correction delta is 1:1 with blocking findings, protected/mayChange are disjoint, and the next generation must cite it", async () => {
  const run = newRun("cd"); await driveToQaPending(run);
  const { qr, cd } = run.submitQA(failQA(run));
  assert.equal(qr.verdict, "CORRECTIONS_REQUIRED");
  assert.equal(cd.items.length, 1); assert.deepEqual(cd.mayChange, ["fixture-clamp"]);
  assert.ok(cd.protected.every((p) => !cd.mayChange.includes(p.element))); assert.ok(cd.protected.some((p) => p.element === "fixture-hose"));
  assert.equal(run.state.phase, "DELTA_ISSUED"); assert.equal(run.state.correctionsIssued, 1); assert.equal(run.state.cyclesConsumed, 1);
  run.requestGeneration();
  refused(() => run.submitGeneration(goodOutput(PNG(2)), { promptText: "p\n" }), "DELTA_MISMATCH"); // no deltaRef given
  refused(() => run.submitGeneration(goodOutput(PNG(2), { deltaRef: { id: cd.id, sha256: "f".repeat(64) } }), { promptText: "p\n" }), "DELTA_MISMATCH");
  const r = run.submitGeneration(goodOutput(PNG(2), { deltaRef: { id: cd.id, sha256: cd.contentHash }, deltaAddressed: ["F1"] }), { promptText: "p\n" });
  assert.equal(r.provenance, "valid"); assert.equal(r.gr.cycle, 2);
});

test("RECONSTRUCTED TEST: generation cap — initial + 3 corrections; the 4th generation failing QA ESCALATES to NEEDS_ANDY", async () => {
  const run = await setup();
  for (let i = 1; i <= 3; i++) { const r = await gen(run, goodOutput(PNG(i))); assert.equal(r.gr.cycle, i); run.submitQA(failQA(run)); }
  const r4 = await gen(run, goodOutput(PNG(4))); assert.equal(r4.gr.cycle, 4);
  const { qr } = run.submitQA(failQA(run));
  assert.equal(qr.verdict, "ESCALATE"); assert.equal(run.state.phase, "NEEDS_ANDY");
  refused(() => run.requestGeneration(), "WRONG_STATE");
});

test("RECONSTRUCTED TEST: EVIDENCE_DEFICIENT reopens the EP only via a superseding EP citing the finding; cycles do NOT reset", async () => {
  const run = await setup(); await gen(run, goodOutput(PNG(1)));
  const f = failQA(run, "MD-fixture-hose"); f.findings[0] = { ...f.findings[0], evidenceDeficiency: { element: "fixture-hose", attribute: "orientation", why: "synthetic" } };
  const { qr } = run.submitQA(f);
  assert.equal(qr.verdict, "EVIDENCE_DEFICIENT"); assert.equal(run.state.phase, "EP_REOPEN_NEEDED"); assert.equal(run.state.cyclesConsumed, 1);
  refused(() => run.registerEP(fixtureEPBody()), undefined); // no supersedes -> EP_INVALID
  const ep1 = run.store().get("EP-synthetic-fixture-v1");
  const ep2 = run.registerEP(fixtureEPBody({ supersedes: { id: ep1.id, sha256: ep1.contentHash }, deficiencyRef: { qrId: qr.id, findingId: "F1" } }));
  assert.equal(ep2.id, "EP-synthetic-fixture-v2"); assert.equal(run.state.cyclesConsumed, 1);
  run.evaluateEP(); run.compileContract({});
  const r = await gen(run, goodOutput(PNG(3))); assert.equal(r.gr.cycle, 2);
  assert.deepEqual(verifyRun(run.dir).problems, []);
});

test("RECONSTRUCTED TEST: superseding with a QR that is not an evidence deficiency is refused", async () => {
  const run = await setup(); await gen(run, goodOutput(PNG(1)));
  const f = failQA(run); f.findings[0] = { ...f.findings[0], evidenceDeficiency: { element: "fixture-clamp", attribute: "location", why: "x" } };
  const { qr } = run.submitQA(f);
  const ep1 = run.store().get("EP-synthetic-fixture-v1");
  refused(() => run.registerEP(fixtureEPBody({ supersedes: { id: ep1.id, sha256: ep1.contentHash }, deficiencyRef: { qrId: qr.id, findingId: "NOPE" } })), "EP_INVALID");
});

// ---------------------------------------------------------------- THE POLICY SWITCH
test("RECONSTRUCTED TEST [POLICY]: ARCHITECTURE_V1 is the LOCKED canonical policy (Andy C-4); BRICK_C_REPORT is a rejected non-canonical alternative", () => {
  assert.equal(DEFAULT_POLICY, "ARCHITECTURE_V1");
  assert.equal(resolvePolicy().name, "ARCHITECTURE_V1"); assert.equal(resolvePolicy().canonical, true);
  for (const p of Object.values(POLICIES)) assert.equal(p.provisional, false);
  assert.throws(() => resolvePolicy("BRICK_C_REPORT"), /NON_CANONICAL_POLICY/);
  assert.equal(resolvePolicy("BRICK_C_REPORT", { allowNonCanonical: true }).canonical, false);
  assert.equal(newRun("d").policy.name, "ARCHITECTURE_V1");
});

test("RECONSTRUCTED TEST [POLICY]: ARCHITECTURE_V1 — a metadata-class provenance rejection burns NO cycle; the retry is the same cycle", async () => {
  const run = await setup();
  const r1 = await gen(run, bad()); assert.equal(r1.provenance, "rejected"); assert.equal(r1.burned, false);
  assert.equal(run.state.cyclesConsumed, 0); assert.equal(run.state.phase, "PROVENANCE_REJECTED"); assert.equal(r1.gr.cycle, 1);
  const r2 = await gen(run, goodOutput(PNG(2)));
  assert.equal(r2.provenance, "valid"); assert.equal(r2.gr.cycle, 1); assert.equal(r2.gr.id, "GR-synthetic-fixture-002");
  assert.equal(run.state.cyclesConsumed, 0);
});

test("RECONSTRUCTED TEST [POLICY]: ARCHITECTURE_V1 — rejected generations never count toward the 4-generation cap", async () => {
  const run = await setup();
  await gen(run, bad()); await gen(run, bad()); await gen(run, bad());
  assert.equal(run.state.cyclesConsumed, 0); assert.notEqual(run.state.phase, "NEEDS_ANDY");
  const ok = await gen(run, goodOutput(PNG(2))); assert.equal(ok.gr.cycle, 1);
});

test("RECONSTRUCTED TEST [POLICY]: ARCHITECTURE_V1 — retry cap (NEW reconstructed behavior, Andy C-4 lock — not recovered original) escalates the 4th consecutive rejection", async () => {
  const run = await setup();
  for (let i = 0; i < 3; i++) await gen(run, bad());
  const r = await gen(run, bad());
  assert.equal(r.needsAndy, true); assert.equal(run.state.phase, "NEEDS_ANDY"); assert.equal(run.state.cyclesConsumed, 0);
  assert.match(JSON.parse(run.events.at(-1).note).reason, /retry cap/);
});

test("RECONSTRUCTED TEST [POLICY]: ARCHITECTURE_V1 — a SUBSTANTIVE provenance failure fails closed to NEEDS_ANDY without burning a cycle", async () => {
  const run = await setup();
  const r = await gen(run, substantive());
  assert.equal(r.needsAndy, true); assert.equal(r.burned, false); assert.equal(run.state.cyclesConsumed, 0); assert.equal(run.state.phase, "NEEDS_ANDY");
});

test("RECONSTRUCTED TEST [POLICY]: BRICK_C_REPORT — ANY provenance rejection consumes a cycle and goes to NEEDS_ANDY (terminal)", async () => {
  for (const out of [bad(), substantive()]) {
    const run = await setup("BRICK_C_REPORT");
    const r = await gen(run, out);
    assert.equal(r.burned, true); assert.equal(run.state.cyclesConsumed, 1); assert.equal(run.state.phase, "NEEDS_ANDY");
    refused(() => run.requestGeneration(), "WRONG_STATE");
  }
});

test("RECONSTRUCTED TEST [POLICY]: the two policies diverge on the SAME input sequence (this is the conflict, made executable)", async () => {
  const a = await setup("ARCHITECTURE_V1"), b = await setup("BRICK_C_REPORT");
  await gen(a, bad()); await gen(b, bad());
  assert.deepEqual([a.state.cyclesConsumed, a.state.phase], [0, "PROVENANCE_REJECTED"]);
  assert.deepEqual([b.state.cyclesConsumed, b.state.phase], [1, "NEEDS_ANDY"]);
});

test("RECONSTRUCTED TEST [POLICY]: policy is overridable per field, validated, and recorded on the rejection event", async () => {
  assert.throws(() => resolvePolicy("NOPE"), /unknown/);
  assert.throws(() => resolvePolicy({ base: "ARCHITECTURE_V1", provenanceRejection: "whatever" }), /bad provenanceRejection/);
  assert.throws(() => resolvePolicy({ base: "ARCHITECTURE_V1", provenanceRetryCap: -1 }), /bad provenanceRetryCap/);
  const run = await setup({ base: "ARCHITECTURE_V1", name: "ARCH_STRICT", provenanceRetryCap: 0 });
  const r = await gen(run, bad());
  assert.equal(r.needsAndy, true);
  const rej = run.events.find((e) => e.type === "PROVENANCE_REJECTED");
  assert.equal(JSON.parse(rej.note).policy, "ARCH_STRICT"); assert.ok(JSON.parse(rej.note).codes.includes("ATT_ATTESTER"));
});

test("RECONSTRUCTED TEST [POLICY]: substantive handling is itself switchable (ARCHITECTURE_V1 + burn-cycle-needs-andy)", async () => {
  const run = await setup({ base: "ARCHITECTURE_V1", name: "ARCH_BURN_SUBST", substantiveProvenanceRejection: "burn-cycle-needs-andy" });
  const r = await gen(run, substantive()); assert.equal(r.burned, true); assert.equal(run.state.cyclesConsumed, 1);
});

// ---------------------------------------------------------------- overlay
async function toNormalized(callouts) {
  const run = newRun("ov"); const spec = { callouts, clearSpace: [] };
  await driveToQaPending(run, { spec }); passAll(run); run.admit(); run.normalize(); return run;
}
test("RECONSTRUCTED TEST: callouts need overlay QA before approval; PASS_OVERLAY unlocks it; reviewer must be independent", async () => {
  const run = await toNormalized([{ label: "Clamp", element: "fixture-clamp", required: true }]);
  refused(() => run.approve({ step: 99, presentation: { alt: "a", caption: "c" } }), "GATES_FAILED");
  refused(() => run.overlayCheck({ reviewer: { actor: "hermes", model: "m", system: "synthetic-generator" }, results: [{ callout: "Clamp", result: "PASS" }] }), "QR_NOT_INDEPENDENT");
  run.overlayCheck({ reviewer: INDEPENDENT_REVIEWER, results: [{ callout: "Clamp", result: "PASS" }] });
  const { registry } = run.approve({ step: 99, presentation: { alt: "a", caption: "c" }, authority: { approvedBy: "andy", approvedOn: "2026-10-04" } });
  assert.equal(registry.entry.provenance.generatedRaster.qa.overlayVerdict, "PASS_OVERLAY"); assert.equal(registry.entry.provenance.calloutsVerified, true);
});

test("RECONSTRUCTED TEST: overlay rounds are capped at 3, then NEEDS_ANDY", async () => {
  const run = await toNormalized([{ label: "Clamp", element: "fixture-clamp", required: true }]);
  const rev = INDEPENDENT_REVIEWER;
  for (let i = 0; i < 3; i++) run.overlayCheck({ reviewer: rev, results: [{ callout: "Clamp", result: "FAIL" }] });
  assert.equal(run.state.phase, "NEEDS_ANDY");
});

test("RECONSTRUCTED TEST: a contract with no callouts has overlay gates 'na' and overlay QA is refused", async () => {
  const run = await toNormalized([]);
  refused(() => run.overlayCheck({ reviewer: { actor: "hermes", model: "m", system: "x" }, results: [] }), "NO_CALLOUTS");
});

test("RECONSTRUCTED TEST: vehicleVerified is an objective registry match — an unregistered application is refused at approval", async () => {
  const run = new FactoryRun({ dir: fs.mkdtempSync("/tmp/gfr1-reg-") + "/v", visualId: "synthetic-fixture", application: APPLICATION, guideId: GUIDE_ID, registry: {}, clock: makeClock() });
  run.init(); await driveToQaPending(run); passAll(run); run.admit(); run.normalize();
  refused(() => run.approve({ step: 99, presentation: { alt: "a", caption: "c" } }), "GATES_FAILED");
});

test("RECONSTRUCTED TEST: approval requires alt text and caption; objects are immutable (rewriting a record is refused)", async () => {
  const run = newRun("imm"); await driveToQaPending(run); passAll(run); run.admit(); run.normalize();
  refused(() => run.approve({ step: 99, presentation: { alt: "", caption: "" } }), "PRESENTATION");
  const { writeJsonOnce } = await import("../src/store.mjs");
  refused(() => writeJsonOnce(run.dir, "evidence-packet.v1.json", {}), "IMMUTABLE");
});

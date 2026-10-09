// RECONSTRUCTED TEST suite — C-4 FACTORY HARDENING regressions (Andy's list). Deterministic. Behavior, not historical numerology:
// nothing here asserts a test count, an old 158/94/90 figure, or any number other than a rule's own constants.
// Method: build a CLEAN run, then attack its on-disk history/objects the way a faulty/malicious actor or bit-rot could, and require
// the verifier (or the command layer) to name the problem. "Forgery" helpers re-seal objects and re-chain events so the attack passes
// every purely-structural hash check — the only thing left to catch it is the SEMANTIC replay.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyRun } from "../src/verify.mjs";
import { readEvents, eventsPath, buildEvent, verifyChain } from "../src/eventlog.mjs";
import { listObjectFiles, abs, Refused, snapshot, LAYOUT } from "../src/store.mjs";
import { seal, stable, refOf, contentHashOf } from "../src/canon.mjs";
import { epProblems, referenceProblems } from "../src/evidence.mjs";
import { cdProblems } from "../src/qa.mjs";
import { normalizeRaster, NormalizationRefused } from "../src/normalize.mjs";
import { resizeBox, parsePng } from "../src/png.mjs";
import { independentFinalReview } from "../src/artifact.mjs";
import { FactoryRun } from "../src/machine.mjs";
import { resolvePolicy } from "../src/policy.mjs";
import { ScriptedGenerator, runGeneration } from "../src/actors.mjs";
import { verifyRecovered, loadRecoveredResolver } from "../integration/recovered-resolver.mjs";
import { newRun, driveToQaPending, passQA, failQA, passAll, independentQA, INDEPENDENT_REVIEWER, goodOutput, goodAttestation, synthPng, fixtureEPBody, makeClock, tmpDir, APPLICATION, GUIDE_ID, REGISTRY } from "./support/fixtures.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const T = (n, s) => `RECONSTRUCTED TEST [C-4 HARDENING #${n}]: ${s}`;
const AUTH = { approvedBy: "andy", approvedOn: "2026-10-04" };
const refused = (fn, code) => assert.throws(fn, (e) => e instanceof Refused && (code ? e.code === code : true), code);
const problems = (run) => verifyRun(run.dir).problems;
const has = (ps, re) => assert.ok(ps.some((p) => re.test(p)), `expected a problem matching ${re}; got:\n${ps.join("\n") || "(none)"}`);

async function approvedRun(name = "h", { callouts = false } = {}) {
  const run = newRun(name);
  await driveToQaPending(run, callouts ? { spec: { callouts: [{ label: "Clamp", element: "fixture-clamp", required: true }], clearSpace: [] } } : {});
  passAll(run); run.admit(); run.normalize();
  if (callouts) run.overlayCheck({ reviewer: INDEPENDENT_REVIEWER, results: [{ callout: "Clamp", result: "PASS" }] });
  run.approve({ step: 99, presentation: { alt: "a", caption: "c" }, authority: AUTH });
  return run;
}
async function setup(name = "hs") { const run = newRun(name); run.registerEP(fixtureEPBody()); run.evaluateEP(); run.compileContract({}); return run; }
const PNG = (seed) => synthPng(1600, 1000, { seed });
const badOut = (seed = 9) => goodOutput(PNG(seed), { attestation: { ...goodAttestation(), attestedBy: "claude-qa" } }); // metadata-class defect
const gen = (run, ...outs) => runGeneration(run, new ScriptedGenerator(outs), { promptText: "p\n" });

// ---- attack helpers -------------------------------------------------------------------------------------------------------------
/** Rebuild events.jsonl with a valid hash chain from whatever list `fn(events)` returns. */
function rechain(run, fn) {
  const list = fn(readEvents(run.dir).map((e) => structuredClone(e)));
  let prev = null; const out = [];
  for (const e of list) { const ev = buildEvent(prev, { ts: e.ts, actor: e.actor, type: e.type, ref: e.ref, from: e.from, to: e.to, note: e.note }); out.push(ev); prev = ev; }
  fs.writeFileSync(eventsPath(run.dir), out.map((e) => JSON.stringify(e)).join("\n") + "\n");
}
/** Mutate one object, re-seal it, cascade the new hash through every object/event that references it. After this, every STRUCTURAL check passes. */
function forge(run, id, mutate) {
  const byId = new Map(listObjectFiles(run.dir).map((f) => [f.obj.id, f]));
  const touched = new Set();
  const apply = (oid, fn) => {
    const f = byId.get(oid); const o = seal(fn(structuredClone(f.obj)));
    f.obj = o; touched.add(oid); fs.writeFileSync(abs(run.dir, f.rel), stable(o));
    for (const g of byId.values()) if (g.obj.refs?.some((r) => r.id === oid)) apply(g.obj.id, (x) => ({ ...x, refs: x.refs.map((r) => (r.id === oid ? { ...r, sha256: o.contentHash } : r)) }));
  };
  apply(id, mutate);
  rechain(run, (evs) => evs.map((e) => (e.ref && touched.has(e.ref.id) ? { ...e, ref: { id: e.ref.id, sha256: byId.get(e.ref.id).obj.contentHash } } : e)));
}
const flip = (file, at = -20) => { const b = fs.readFileSync(file); b[at < 0 ? b.length + at : at] ^= 1; fs.writeFileSync(file, b); };
const grPath = (run, n = 1) => abs(run.dir, LAYOUT.grFile(`GR-synthetic-fixture-${String(n).padStart(3, "0")}`));

// =============================================================================================================================
test(T(0, "a clean run verifies clean under the hardened verifier (baseline: every attack below starts from a verified-clean directory)"), async () => {
  assert.deepEqual(problems(await approvedRun("base")), []);
  assert.deepEqual(problems(await approvedRun("base2", { callouts: true })), []);
});

// ---------------------------------------------------------------- LOCKED POLICIES (decisions 1, 2, 3)
test(T("L1", "ARCHITECTURE_V1 is canonical; any deviation needs allowNonCanonical, cannot be laundered by renaming, is recorded in policy.json, and can never be approved"), async () => {
  const mk = (policy, allow) => new FactoryRun({ dir: path.join(tmpDir("pol"), "v"), visualId: "synthetic-fixture", application: APPLICATION, guideId: GUIDE_ID, registry: REGISTRY, clock: makeClock(), policy, allowNonCanonical: allow });
  assert.throws(() => mk("BRICK_C_REPORT"), /NON_CANONICAL_POLICY/);
  assert.throws(() => mk({ base: "ARCHITECTURE_V1", name: "ARCHITECTURE_V1", provenanceRetryCap: 99 }), /NON_CANONICAL_POLICY/, "renaming an override must not make it canonical");
  const ok = mk(undefined); ok.init();
  const rec = JSON.parse(fs.readFileSync(abs(ok.dir, LAYOUT.policy), "utf8"));
  assert.equal(rec.canonical, true); assert.equal(rec.policy.provenanceRetryCap, 3); assert.match(rec.retryCapLabel, /NEW reconstructed behavior/); assert.match(rec.retryCapLabel, /NOT recovered original/);
  // the policy of an existing run cannot change underneath it
  assert.throws(() => new FactoryRun({ dir: ok.dir, visualId: "synthetic-fixture", application: APPLICATION, guideId: GUIDE_ID, registry: REGISTRY, clock: makeClock(), policy: { base: "ARCHITECTURE_V1", name: "X", provenanceRetryCap: 0 }, allowNonCanonical: true }), (e) => e instanceof Refused && e.code === "POLICY_MISMATCH");
  // a non-canonical run works for diagnostics but can never be approved
  const nc = newRun("nc", { policy: { base: "ARCHITECTURE_V1", name: "X", provenanceRetryCap: 5 } });
  await driveToQaPending(nc); passAll(nc); nc.admit(); nc.normalize();
  refused(() => nc.approve({ step: 99, presentation: { alt: "a", caption: "c" }, authority: AUTH }), "POLICY_NON_CANONICAL");
  assert.equal(nc.state.phase, "NORMALIZED");
});

test(T("L2", "verifier: a run approved under a non-canonical policy (policy.json edited after the fact) is flagged; missing policy.json is flagged"), async () => {
  const run = await approvedRun("polv");
  const p = abs(run.dir, LAYOUT.policy); const rec = JSON.parse(fs.readFileSync(p, "utf8"));
  fs.writeFileSync(p, JSON.stringify({ ...rec, canonical: false, policy: { ...rec.policy, provenanceRetryCap: 5 } }));
  has(problems(run), /approved under non-canonical policy/);
  fs.rmSync(p); has(problems(run), /policy\.json missing/);
});

// ---------------------------------------------------------------- 1 corrupted reference hash
test(T(1, "corrupted reference hash — a cross-reference {id, sha256}, an event ref, and the recovered SHA256SUMS entry are each caught"), async () => {
  const run = await approvedRun("ref1");
  const vcRel = "visual-contract.v1.json";
  const vcPath = abs(run.dir, vcRel); const vc = JSON.parse(fs.readFileSync(vcPath, "utf8"));
  fs.writeFileSync(vcPath, stable(seal({ ...vc, refs: [{ ...vc.refs[0], sha256: "f".repeat(64) }] }))); // consistent object, WRONG reference hash
  has(problems(run), /VC-synthetic-fixture-v1: ref EP-synthetic-fixture-v1 hash mismatch/);
  const run2 = await approvedRun("ref1b");
  rechain(run2, (evs) => evs.map((e) => (e.type === "GEN_SUBMITTED" ? { ...e, ref: { ...e.ref, sha256: "0".repeat(64) } } : e)));
  has(problems(run2), /event \d+: ref GR-synthetic-fixture-001 hash differs/);
  // recovered tree: a corrupted hash line in SHA256SUMS.txt is itself an integrity failure
  const copy = fs.mkdtempSync(path.join(os.tmpdir(), "gfr1-rec-")); fs.cpSync(path.join(here, "..", "recovered"), copy, { recursive: true });
  fs.chmodSync(path.join(copy, "SHA256SUMS.txt"), 0o644);
  const sums = fs.readFileSync(path.join(copy, "SHA256SUMS.txt"), "utf8").replace(/^[0-9a-f]{8}/, "deadbeef"); fs.writeFileSync(path.join(copy, "SHA256SUMS.txt"), sums);
  assert.ok(verifyRecovered(copy).some((m) => /content differs from SHA256SUMS/.test(m)));
});

// ---------------------------------------------------------------- 2 mutated recovered contract file
test(T(2, "mutated recovered contract file — the harness refuses to bundle a recovered tree whose bytes differ from SHA256SUMS.txt"), async () => {
  assert.deepEqual(verifyRecovered(), [], "the real recovered tree must be intact");
  const copy = fs.mkdtempSync(path.join(os.tmpdir(), "gfr1-rec-")); fs.cpSync(path.join(here, "..", "recovered"), copy, { recursive: true });
  const f = path.join(copy, "src", "lib", "guideVisuals.ts"); fs.chmodSync(f, 0o644);
  fs.appendFileSync(f, "\n// one stray byte of drift\n");
  const bad = verifyRecovered(copy); assert.ok(bad.some((m) => m.startsWith("src/lib/guideVisuals.ts: content differs")), bad.join("\n"));
  const R = await loadRecoveredResolver({ root: copy });
  assert.equal(R.available, false); assert.match(R.reason, /integrity check FAILED/);
  fs.writeFileSync(path.join(copy, "src", "lib", "extra.ts"), "export {}"); // an added file is also drift
  assert.ok(verifyRecovered(copy).some((m) => /extra\.ts: present but not listed/.test(m)));
});

// ---------------------------------------------------------------- 3 duplicate evidence IDs
test(T(3, "duplicate evidence IDs — duplicate reference ids, ledger rows, mustNotDepict ids, element ids, QA check ids, and duplicate object ids on disk are all refused/flagged"), async () => {
  const run = newRun("dup"); const mk = (over) => { const r = newRun("dupmk"); return () => { r.registerEP(fixtureEPBody(over)); }; };
  const body = fixtureEPBody();
  const codes = (over) => { const ep = { ...JSON.parse(JSON.stringify(body)), ...over }; return epProblems(seal({ schema: "guide-factory.evidence-packet", schemaVersion: "reconstructed-1", id: "EP-x-v1", visualId: "x", application: APPLICATION, createdBy: { actor: "claude-research", role: "r" }, createdAt: "2026-10-04T00:00:00Z", refs: [], ...ep })).map((p) => p.code); };
  assert.ok(codes({ references: [body.references[0], body.references[0]] }).includes("REF_DUPLICATE_ID"));
  assert.ok(codes({ ledger: [...body.ledger, body.ledger[0]] }).includes("LEDGER_DUPLICATE_ROW"));
  assert.ok(codes({ mustNotDepict: [...body.mustNotDepict, body.mustNotDepict[0]] }).includes("MND_DUPLICATE_ID"));
  assert.ok(codes({ elements: [...body.elements, body.elements[0]] }).includes("ELEMENT_SHAPE"));
  assert.ok(!codes({}).some((c) => /DUPLICATE/.test(c)), "a clean packet has no duplicate findings");
  refused(mk({ references: [body.references[0], body.references[0]] }), "EP_INVALID");
  // QA: the same contract item checked twice
  await driveToQaPending(run);
  const p = passQA(run); refused(() => run.submitQA({ ...p, checks: [...p.checks, p.checks[0]] }), "QR_INVALID");
  // on disk: the same object id in two files
  const ok = await approvedRun("dupdisk");
  fs.copyFileSync(abs(ok.dir, "evidence-packet.v1.json"), abs(ok.dir, "evidence-packet.v2.json"));
  const ps = problems(ok); has(ps, /duplicate object id EP-synthetic-fixture-v1/); has(ps, /evidence-packet\.v2\.json: file name does not match object id/);
});

// ---------------------------------------------------------------- 4 broken event-chain link
test(T(4, "broken event-chain link — an edited prev link, a deleted event, and a CONSISTENTLY re-chained rewrite (caught by the head pinned in the registry preview) are all caught"), async () => {
  const a = await approvedRun("chain4a");
  const evs = readEvents(a.dir); evs[4] = { ...evs[4], prevSha256: "a".repeat(64) }; fs.writeFileSync(eventsPath(a.dir), evs.map((e) => JSON.stringify(e)).join("\n") + "\n");
  has(problems(a), /events: event 5: prevSha256 does not match/);
  const b = await approvedRun("chain4b");
  const lines = fs.readFileSync(eventsPath(b.dir), "utf8").trim().split("\n"); lines.splice(3, 1); fs.writeFileSync(eventsPath(b.dir), lines.join("\n") + "\n");
  has(problems(b), /events: event \d+: (seq is|prevSha256)/);
  const c = await approvedRun("chain4c"); // attacker re-chains perfectly after changing a timestamp: structurally valid, but the preview pinned the old head
  rechain(c, (e) => e.map((x, i) => (i === 2 ? { ...x, ts: "2030-01-01T00:00:00.000Z" } : x)));
  assert.deepEqual(verifyChain(readEvents(c.dir)), []);
  has(problems(c), /registry preview pins event \d+ head .*history was rewritten or truncated/);
});

// ---------------------------------------------------------------- 5 out-of-order events
test(T(5, "out-of-order events — swapped lines break the chain; a validly RE-CHAINED reorder or injected event is caught by transition legality"), async () => {
  const a = await approvedRun("ord5a");
  const lines = fs.readFileSync(eventsPath(a.dir), "utf8").trim().split("\n"); [lines[8], lines[9]] = [lines[9], lines[8]]; fs.writeFileSync(eventsPath(a.dir), lines.join("\n") + "\n");
  has(problems(a), /events: event/);
  const b = await approvedRun("ord5b"); // swap GEN_ACCEPTED and NORMALIZED, chain rebuilt: hashes all valid
  rechain(b, (e) => { const i = e.findIndex((x) => x.type === "GEN_ACCEPTED"); [e[i], e[i + 1]] = [e[i + 1], e[i]]; return e; });
  assert.deepEqual(verifyChain(readEvents(b.dir)), []);
  has(problems(b), /illegal transition/);
  const c = await setup("ord5c"); // APPROVED injected straight after VC_LOCKED, chain valid
  const ap = { ts: "2026-10-04T13:00:00.000Z", actor: "factory-code", type: "APPROVED", ref: null, from: null, to: "APPROVED", note: "" };
  rechain(c, (e) => [...e, ap]);
  has(problems(c), /event \d+ \(APPROVED\): illegal transition/);
  const d = await approvedRun("ord5d"); // anything after a terminal state
  rechain(d, (e) => [...e, { ...e[0], type: "EP_SUFFICIENT" }]);
  has(problems(d), /occurs after the run reached APPROVED/);
});

// ---------------------------------------------------------------- 6 admitted output without required provenance
test(T(6, "admitted output without required provenance — a re-sealed, re-chained forgery of the generation's attestation is caught by re-checking the stored bytes"), async () => {
  const run = await approvedRun("prov6");
  forge(run, "GR-synthetic-fixture-001", (o) => ({ ...o, attestation: { ...o.attestation, noTracing: false } }));
  assert.deepEqual(verifyChain(readEvents(run.dir)), []);
  const ps = problems(run);
  has(ps, /admitted output GR-synthetic-fixture-001 lacks required provenance/); has(ps, /marked provenance-valid but fails the provenance re-check/);
  const r2 = await setup("prov6b"); await gen(r2, badOut()); // a rejected generation must never be admitted by an injected GEN_ACCEPTED
  const grRef = readEvents(r2.dir).find((e) => e.type === "PROVENANCE_REJECTED").ref;
  rechain(r2, (e) => [...e, { ts: "2026-10-04T13:00:00.000Z", actor: "factory-code", type: "GEN_ACCEPTED", ref: grRef, from: "QA_PASSED", to: "ACCEPTED", note: "" }]);
  has(problems(r2), /GEN_ACCEPTED\): illegal transition/);
  // command layer: bytes swapped under an already provenance-valid record => admit refuses
  const r3 = newRun("prov6c"); await driveToQaPending(r3); passAll(r3);
  fs.writeFileSync(grPath(r3), PNG(77));
  refused(() => r3.admit(), "ADMISSION_REFUSED");
});

// ---------------------------------------------------------------- 7 artifact bytes no longer matching manifest
test(T(7, "artifact bytes no longer matching the manifest — candidate bytes, normalized bytes, and the registry preview are each checked"), async () => {
  const a = await approvedRun("byt7a"); flip(grPath(a)); has(problems(a), /candidate file hash differs from its record/);
  const b = await approvedRun("byt7b"); flip(abs(b.dir, LAYOUT.normalized("synthetic-fixture"))); const ps = problems(b); has(ps, /published-candidate file hash differs|normalized file hash differs/);
  const c = await approvedRun("byt7c"); fs.appendFileSync(abs(c.dir, LAYOUT.registryPreview), " "); has(problems(c), /registry preview hash differs/);
  const d = newRun("byt7d"); await driveToQaPending(d); passAll(d); flip(grPath(d)); refused(() => d.admit(), "ADMISSION_REFUSED");
});

// ---------------------------------------------------------------- 8 normalization unexpectedly changing dimensions
test(T(8, "normalization unexpectedly changing dimensions — a faulty resizer is refused; real inputs always land on exactly the frame; a wrong-size derivative on disk is flagged"), async () => {
  const src = synthPng(1600, 1000, { seed: 3 });
  const faulty = (img, w, h) => resizeBox(img, w - 1, h); // off-by-one resizer
  assert.throws(() => normalizeRaster(src, { _resize: faulty }), (e) => e instanceof NormalizationRefused && e.code === "DIMENSIONS_CHANGED");
  for (const [w, h] of [[1600, 1000], [3200, 2000]]) { const n = normalizeRaster(synthPng(w, h, { seed: 4 })); assert.deepEqual([n.normalized.width, n.normalized.height], [1600, 1000]); const p = parsePng(n.bytes); assert.deepEqual([p.width, p.height], [1600, 1000]); }
  for (const [w, h] of [[1599, 999], [1600, 1001], [1920, 1200 - 1]]) assert.throws(() => normalizeRaster(synthPng(w, h)), NormalizationRefused);
  const run = await approvedRun("dim8");
  fs.writeFileSync(abs(run.dir, LAYOUT.normalized("synthetic-fixture")), synthPng(1600, 1000, { seed: 5 }).subarray(0)); // same size, different bytes -> hash differs
  has(problems(run), /normalized file hash differs/);
  const small = synthPng(800, 500, { seed: 5 }); fs.writeFileSync(abs(run.dir, LAYOUT.normalized("synthetic-fixture")), small);
  has(problems(run), /normalized file is 800x500, expected exactly 1600x1000/);
});

// ---------------------------------------------------------------- 9 QA verdict tampering
test(T(9, "QA verdict tampering — a naive edit, a re-sealed edit, and a fully re-sealed + re-chained forgery (verdict recomputed from the QR's own checks) are all caught"), async () => {
  const mk = async (n) => { const r = newRun(n); await driveToQaPending(r); r.submitQA(failQA(r)); return r; }; // CORRECTIONS_REQUIRED + delta
  const a = await mk("qa9a"); const qp = abs(a.dir, "qa/QR-synthetic-fixture-001.result.json");
  fs.writeFileSync(qp, fs.readFileSync(qp, "utf8").replace("CORRECTIONS_REQUIRED", "PASS_FOR_OVERLAY_QA")); has(problems(a), /contentHash does not match content/);
  const b = await mk("qa9b"); forge(b, "QR-synthetic-fixture-001", (o) => ({ ...o, verdict: "PASS_FOR_OVERLAY_QA" }));
  rechain(b, (e) => e.map((x) => (x.type === "QA_RECORDED" ? { ...x, note: JSON.stringify({ ...JSON.parse(x.note), verdict: "PASS_FOR_OVERLAY_QA" }) } : x)));
  const ps = problems(b); has(ps, /QA verdict tampered — QR-synthetic-fixture-001 says PASS_FOR_OVERLAY_QA, its own checks\/findings compute CORRECTIONS_REQUIRED/);
  const c = await mk("qa9c"); forge(c, "QR-synthetic-fixture-001", (o) => ({ ...o, failedGates: [] })); has(problems(c), /failedGates do not match its findings/);
  const d = await mk("qa9d"); rechain(d, (e) => e.map((x) => (x.type === "QA_RECORDED" ? { ...x, note: JSON.stringify({ ...JSON.parse(x.note), verdict: "PASS_FOR_OVERLAY_QA" }) } : x))); has(problems(d), /event note verdict PASS_FOR_OVERLAY_QA differs from the QR/);
});

// ---------------------------------------------------------------- 10 correction delta referencing nonexistent prior artifact
test(T(10, "correction delta referencing a nonexistent prior artifact — refused at creation (cdProblems with a store) and flagged on disk (re-sealed forgery)"), async () => {
  const run = newRun("cd10"); await driveToQaPending(run); const { qr, cd } = run.submitQA(failQA(run));
  assert.ok(cd.protected.length > 0);
  const store = run.store();
  assert.deepEqual(cdProblems(cd, qr, store), []);
  const ghost = seal({ ...cd, protected: cd.protected.map((p) => ({ ...p, priorPassRef: "QR-synthetic-fixture-099" })) });
  assert.ok(cdProblems(ghost, qr, store).some((p) => p.code === "CD_PRIOR_MISSING"));
  const ghostRef = seal({ ...cd, refs: [...cd.refs, { id: "GR-synthetic-fixture-099", sha256: "1".repeat(64) }] });
  assert.ok(cdProblems(ghostRef, qr, store).some((p) => p.code === "CD_REF_MISSING"));
  forge(run, cd.id, (o) => ({ ...o, protected: o.protected.map((p) => ({ ...p, priorPassRef: "QR-synthetic-fixture-099" })) }));
  has(problems(run), /CD_PRIOR_MISSING: protected element .* cites prior pass QR-synthetic-fixture-099, which does not exist/);
  const run2 = newRun("cd10b"); await driveToQaPending(run2); const r2 = run2.submitQA(failQA(run2));
  forge(run2, r2.cd.id, (o) => ({ ...o, cycle: 3 })); has(problems(run2), /delta cycle 3 should be 1/);
});

// ---------------------------------------------------------------- 11 fourth metadata retry forcing NEEDS_ANDY
test(T(11, "fourth metadata retry forces NEEDS_ANDY — exact counting (initial + 3 resubmissions), no cycle burned, 5th submission refused, labelled NEW reconstructed behavior, and an un-escalated history is flagged"), async () => {
  const run = await setup("cap11");
  for (let i = 1; i <= 3; i++) { const r = await gen(run, badOut(i)); assert.equal(r.provenance, "rejected"); assert.equal(r.needsAndy, false, `rejection ${i} must still allow a resubmission`); assert.equal(run.state.phase, "PROVENANCE_REJECTED"); }
  const r4 = await gen(run, badOut(4));
  assert.equal(r4.needsAndy, true); assert.equal(run.state.phase, "NEEDS_ANDY"); assert.equal(run.state.cyclesConsumed, 0); assert.equal(run.state.provenanceRetries, 4);
  const last = run.events.at(-1); assert.equal(last.type, "NEEDS_ANDY"); assert.match(JSON.parse(last.note).reason, /retry cap/);
  const s0 = snapshot(run.dir);
  refused(() => run.requestGeneration(), "WRONG_STATE"); refused(() => run.submitGeneration(goodOutput(PNG(5)), { promptText: "p\n" }), "WRONG_STATE");
  assert.deepEqual(snapshot(run.dir), s0, "refused commands after NEEDS_ANDY leave the directory byte-identical");
  assert.deepEqual(problems(run), []);
  assert.match(fs.readFileSync(abs(run.dir, LAYOUT.policy), "utf8"), /NEW reconstructed behavior/);
  rechain(run, (e) => e.slice(0, -1)); // history in which the cap was exceeded but nobody escalated
  has(problems(run), /retry cap exceeded but the run was not escalated to NEEDS_ANDY/);
  // a good resubmission after rejections 1..3 still succeeds in the SAME cycle (the cap does not block legitimate recovery)
  const ok = await setup("cap11b"); for (let i = 0; i < 3; i++) await gen(ok, badOut(i + 1));
  const r = await gen(ok, goodOutput(PNG(8))); assert.equal(r.provenance, "valid"); assert.equal(r.gr.cycle, 1);
});

// ---------------------------------------------------------------- 12 Claude self-QA presented as independent QA
test(T(12, "Claude self-QA presented as independent QA — refused by actor, by model/system name, by class claim, by admission, by approval, by overlay, and by the verifier"), async () => {
  const run = newRun("self12"); await driveToQaPending(run); const s0 = snapshot(run.dir);
  const codesOf = (fn) => { try { fn(); } catch (e) { return e.problems?.map((p) => p.code) ?? [e.code]; } return []; };
  assert.ok(codesOf(() => run.submitIndependentReview(passQA(run))).includes("QR_SELF_QA_NOT_INDEPENDENT"), "claude-qa as independent");
  assert.ok(codesOf(() => run.submitIndependentReview(independentQA(run, { reviewer: { actor: "hermes", model: "claude-opus-whatever", system: "synthetic-independent-system" } }))).includes("QR_SELF_QA_NOT_INDEPENDENT"), "hermes label on a Claude model");
  assert.ok(codesOf(() => run.submitIndependentReview(independentQA(run, { reviewer: { actor: "hermes", model: "m", system: "Anthropic API relay" } }))).includes("QR_SELF_QA_NOT_INDEPENDENT"), "hermes label on an Anthropic system");
  assert.ok(codesOf(() => run.submitIndependentReview(independentQA(run, { reviewer: { actor: "maze", model: "m", system: "other-system" } }))).includes("QR_SELF_QA_NOT_INDEPENDENT"), "only hermes may be the independent reviewer (not maze, andy, factory-code...)");
  assert.ok(codesOf(() => run.submitQA({ ...passQA(run), reviewClass: "independent" })).includes("QR_SELF_QA_NOT_INDEPENDENT"), "internal channel claiming independent");
  assert.ok(codesOf(() => run.submitQA(independentQA(run))).includes("QR_REVIEWER"), "hermes cannot masquerade as the internal reviewer either");
  assert.deepEqual(snapshot(run.dir), s0, "every refusal wrote nothing");
  // internal PASS alone does not admit or approve
  run.submitQA(passQA(run)); assert.equal(run.state.phase, "INTERNAL_QA_PASSED");
  refused(() => run.admit(), "WRONG_STATE"); refused(() => run.approve({ step: 99, presentation: { alt: "a", caption: "c" } }), "WRONG_STATE");
  assert.equal(independentFinalReview(run.store().get(run.state.internalQR.id)), false);
  run.submitIndependentReview(independentQA(run)); run.admit(); run.normalize(); assert.equal(run.state.phase, "NORMALIZED");
  // overlay stage: Claude is not an independent overlay reviewer either
  const ov = newRun("self12o"); await driveToQaPending(ov, { spec: { callouts: [{ label: "Clamp", element: "fixture-clamp", required: true }], clearSpace: [] } }); passAll(ov); ov.admit(); ov.normalize();
  refused(() => ov.overlayCheck({ reviewer: { actor: "claude-qa", model: "m", system: "synthetic-qa-system" }, results: [{ callout: "Clamp", result: "PASS" }] }), "QR_NOT_INDEPENDENT");
  // forgery: re-sealed, re-chained history in which the final QR is Claude but labelled independent
  const f = await approvedRun("self12f");
  forge(f, "QR-synthetic-fixture-002", (o) => ({ ...o, reviewer: { ...o.reviewer, actor: "claude-qa" }, createdBy: { ...o.createdBy, actor: "claude-qa" } }));
  const ps = problems(f); has(ps, /QR_SELF_QA_NOT_INDEPENDENT/); has(ps, /admitted on a non-independent QR/); has(ps, /approved without an independent final review/);
});

// ---------------------------------------------------------------- 13 provenance rejection incorrectly consuming a correction cycle
test(T(13, "provenance rejection must not consume a correction cycle — behavior, replayed history, forged burn flag, and forged cycle number"), async () => {
  const run = await setup("cyc13");
  const r1 = await gen(run, badOut()); assert.equal(r1.burned, false);
  assert.equal(run.state.cyclesConsumed, 0); assert.equal(run.state.correctionsIssued, 0);
  const r2 = await gen(run, goodOutput(PNG(2)));
  assert.equal(r2.gr.cycle, 1, "the retry is in the SAME cycle"); assert.equal(r2.gr.id, "GR-synthetic-fixture-002");
  assert.deepEqual(run.store().get(r2.gr.id).cycle, 1);
  assert.equal([...run.store().values()].filter((o) => o.id.startsWith("CD-")).length, 0, "no correction delta was issued by a provenance rejection");
  assert.deepEqual(problems(run), []);
  // a genuine correction afterwards still gets cycle 2 (rejections neither consume nor skip cycles)
  run.submitQA(failQA(run)); assert.equal(run.state.cyclesConsumed, 1);
  const r3 = await gen(run, goodOutput(PNG(3), { deltaRef: refOf(run.store().get("CD-synthetic-fixture-001")), deltaAddressed: ["F1"] })); assert.equal(r3.gr.cycle, 2);
  assert.deepEqual(problems(run), []);
  // forged: the rejection event claims it burned a cycle
  const a = await setup("cyc13a"); await gen(a, badOut());
  rechain(a, (e) => e.map((x) => (x.type === "PROVENANCE_REJECTED" ? { ...x, note: JSON.stringify({ ...JSON.parse(x.note), burn: true }) } : x)));
  has(problems(a), /burned a correction cycle under the canonical policy/);
  // forged: the next generation was numbered as if the rejection had consumed a cycle
  const b = await setup("cyc13b"); await gen(b, badOut()); await gen(b, goodOutput(PNG(2)));
  forge(b, "GR-synthetic-fixture-002", (o) => ({ ...o, cycle: 2 }));
  has(problems(b), /claims cycle 2 but cycle 1 was current \(a provenance rejection must not consume a cycle\)/);
});

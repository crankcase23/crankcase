// RECONSTRUCTED TEST suite — C-5 owner/Hermes locks: U-22 retry count, independent reviewer identity, generated-output ownership, U-24 (kept OPEN).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Refused, abs, LAYOUT, snapshot } from "../src/store.mjs";
import { verifyRun } from "../src/verify.mjs";
import { sha256 } from "../src/canon.mjs";
import { readEvents } from "../src/eventlog.mjs";
import { ScriptedGenerator, runGeneration } from "../src/actors.mjs";
import { INDEPENDENT_IDENTITY, GENERATED_ASSET_CLASS, RIGHTS_BASIS } from "../src/enums.mjs";
import { newRun, driveToQaPending, passQA, independentQA, passAll, INDEPENDENT_REVIEWER, goodOutput, goodAttestation, synthPng, fixtureEPBody } from "./support/fixtures.mjs";
import { forge, rechain } from "./support/attacks.mjs";
import { loadRecoveredResolver, allowNoResolver } from "../integration/recovered-resolver.mjs";

const T = (n, s) => `RECONSTRUCTED TEST [C-5 LOCK ${n}]: ${s}`;
const AUTH = { approvedBy: "andy", approvedOn: "2026-10-04" };
const problems = (run) => verifyRun(run.dir).problems;
const has = (ps, re) => assert.ok(ps.some((p) => re.test(p)), `expected ${re}; got:\n${ps.join("\n") || "(none)"}`);
const codesOf = (fn) => { try { fn(); } catch (e) { return e.problems?.map((p) => p.code) ?? [e.code]; } return []; };
async function approved(name) { const r = newRun(name); await driveToQaPending(r); passAll(r); r.admit(); r.normalize(); r.approve({ step: 99, presentation: { alt: "a", caption: "c" }, authority: AUTH }); return r; }
async function setup(name) { const r = newRun(name); r.registerEP(fixtureEPBody()); r.evaluateEP(); r.compileContract({}); return r; }
const bad = (seed) => goodOutput(synthPng(1600, 1000, { seed }), { attestation: { ...goodAttestation(), attestedBy: "claude-qa" } });
const gen = (run, ...o) => runGeneration(run, new ScriptedGenerator(o), { promptText: "p\n" });

test(T(1, "U-22 canonical: initial submission + up to 3 resubmissions; the 4th rejection escalates to NEEDS_ANDY; labelled canonical reconstructed behavior"), async () => {
  const run = await setup("u22");
  for (let i = 1; i <= 3; i++) { const r = await gen(run, bad(i)); assert.equal(r.needsAndy, false, `rejection ${i}`); }
  const r4 = await gen(run, bad(4)); assert.equal(r4.needsAndy, true); assert.equal(run.state.phase, "NEEDS_ANDY"); assert.equal(run.state.cyclesConsumed, 0);
  const label = JSON.parse(fs.readFileSync(abs(run.dir, LAYOUT.policy), "utf8")).retryCapLabel;
  assert.match(label, /NEW reconstructed behavior/); assert.match(label, /CANONICAL/); assert.match(label, /4th rejection escalates/); assert.match(label, /NOT recovered original/);
});

test(T(2, "independent reviewer identity: Hermes / ChatGPT / GPT-5.6 Sol — relabelling a Claude result 'Hermes' does not satisfy independent review"), async () => {
  assert.equal(INDEPENDENT_IDENTITY.canonicalName, "Hermes / ChatGPT / GPT-5.6 Sol");
  const run = newRun("id"); await driveToQaPending(run); const s0 = snapshot(run.dir);
  const attempt = (reviewer) => codesOf(() => run.submitIndependentReview(independentQA(run, { reviewer })));
  const ok = INDEPENDENT_REVIEWER;
  assert.ok(attempt({ ...ok, model: "claude-opus-4" }).includes("QR_SELF_QA_NOT_INDEPENDENT"), "a Claude model labelled hermes");
  assert.ok(attempt({ ...ok, system: "Claude (relabelled as Hermes)" }).includes("QR_SELF_QA_NOT_INDEPENDENT"), "a Claude system labelled hermes");
  assert.ok(attempt({ ...ok, model: "some-unknown-model" }).includes("QR_REVIEWER_IDENTITY"), "a non-GPT model string");
  assert.ok(attempt({ ...ok, system: "synthetic-qa-system" }).includes("QR_REVIEWER_IDENTITY"), "a non-Hermes/ChatGPT/OpenAI system");
  assert.ok(attempt({ actor: "hermes", model: ok.model, system: ok.system }).includes("QR_REVIEWER_RAW_HASH"), "no raw-response hash");
  assert.ok(attempt({ ...ok, rawResponseSha256: "abc" }).includes("QR_REVIEWER_RAW_HASH"), "malformed raw-response hash");
  assert.ok(attempt({ ...ok, actor: "claude-qa" }).includes("QR_SELF_QA_NOT_INDEPENDENT"), "claude-qa actor");
  assert.deepEqual(snapshot(run.dir), s0, "every refusal wrote nothing");
  run.submitQA(passQA(run)); run.submitIndependentReview(independentQA(run)); // the canonical identity is accepted
  assert.equal(run.state.phase, "QA_PASSED"); assert.deepEqual(problems(run), []);
});

test(T(2, "identity is re-validated by the VERIFIER: a re-sealed, re-chained history whose independent QR is relabelled is flagged (identity, raw hash, Claude model)"), async () => {
  for (const [mutate, re] of [
    [(r) => ({ ...r, model: "claude-opus-4" }), /QR_SELF_QA_NOT_INDEPENDENT/],
    [(r) => ({ ...r, system: "internal tool" }), /QR_REVIEWER_IDENTITY/],
    [(r) => { const { rawResponseSha256: _x, ...rest } = r; return rest; }, /QR_REVIEWER_RAW_HASH/],
  ]) {
    const run = await approved("idv"); forge(run, "QR-synthetic-fixture-002", (o) => ({ ...o, reviewer: mutate(o.reviewer) }));
    const ps = problems(run); has(ps, re); has(ps, /admitted on a non-independent QR|approved without an independent final review|QR-synthetic-fixture-002/);
  }
});

test(T(2, "Claude may do internal QA but cannot certify its own output: internal PASS never admits, and the final registry QA reviewer is the independent one"), async () => {
  const run = newRun("self"); await driveToQaPending(run); run.submitQA(passQA(run));
  assert.equal(run.state.phase, "INTERNAL_QA_PASSED"); assert.throws(() => run.admit(), (e) => e.code === "WRONG_STATE");
  run.submitIndependentReview(independentQA(run)); run.admit(); run.normalize();
  const { registry } = run.approve({ step: 99, presentation: { alt: "a", caption: "c" }, authority: AUTH });
  const qa = registry.entry.provenance.generatedRaster.qa;
  assert.equal(qa.reviewer.actor, "hermes"); assert.equal(qa.reviewClass, "independent");
});

test(T(3, "generated output ownership: project asset subject to the provider's usage rights; the factory records the provider's terms and asserts no ownership beyond them"), async () => {
  assert.equal(GENERATED_ASSET_CLASS, "Redline Origin / Crankcase project asset, subject to the generation provider's applicable usage rights");
  const run = await approved("own");
  const gr = run.store().get("GR-synthetic-fixture-001");
  assert.equal(gr.license.status, "generated-original"); assert.equal(gr.license.ownershipAsserted, false);
  assert.equal(gr.license.assetClass, GENERATED_ASSET_CLASS); assert.equal(gr.license.rightsBasis, RIGHTS_BASIS); assert.ok(gr.license.terms.summary.length > 0);
  assert.deepEqual(problems(run), []);
  const reg = JSON.parse(fs.readFileSync(abs(run.dir, LAYOUT.registryPreview), "utf8")).entry.provenance;
  assert.equal(reg.generatedRaster.license.ownershipAsserted, false); assert.equal(reg.license.status, "generated-original");
  // no provider terms recorded -> provenance rejection (nothing is claimed in the absence of a granted right)
  const s = await setup("own2"); const r = await gen(s, goodOutput(synthPng(1600, 1000, { seed: 3 }), { licenseTerms: { summary: "" } }));
  assert.equal(r.provenance, "rejected"); assert.ok(r.problems.some((p) => p.code === "GR_LICENSE_TERMS"));
  // forged: ownership asserted / classification altered -> verifier flags (re-sealed and re-chained)
  for (const [mutate, re] of [[(l) => ({ ...l, ownershipAsserted: true }), /GR_OWNERSHIP_CLAIM/], [(l) => ({ ...l, assetClass: "Owned outright by Redline Origin" }), /GR_ASSET_CLASS/]]) {
    const f = await approved("own3"); forge(f, "GR-synthetic-fixture-001", (o) => ({ ...o, license: mutate(o.license) })); has(problems(f), re);
  }
});

test(T(3, "the RECOVERED resolver still accepts the record (it requires generated-original and no ownership assertion) — the ownership posture does not break recovered rules"), async () => {
  const R = await loadRecoveredResolver(); if (!R.available) { assert.ok(allowNoResolver(), `recovered resolver unavailable: ${R.reason}`); return; }
  const run = await approved("rr"); const entry = structuredClone(JSON.parse(fs.readFileSync(abs(run.dir, LAYOUT.registryPreview), "utf8")).entry);
  const set = { guideId: "admin-test-charger-2016-sxt-multi-job", application: entry.application, steps: {} };
  assert.equal(R.visualRefusal(set, entry, { id: "admin-test-charger-2016-sxt-multi-job" }, entry.application), null);
});

test(T(4, "U-24 stays OPEN and documented: a pre-approval truncated tail is NOT detected today (known gap); once approved, the pinned head catches it"), async () => {
  const run = await setup("u24"); await gen(run, goodOutput(synthPng(1600, 1000, { seed: 2 }))); // ... PROVENANCE_VALID is the last event
  rechain(run, (e) => e.slice(0, -1)); // tail removed, chain rebuilt consistently
  assert.deepEqual(problems(run), [], "KNOWN GAP U-24: a truncated, consistently re-chained, UNAPPROVED history verifies clean. If a future change closes this, update this test and the U-24 row together");
  const a = await approved("u24b"); rechain(a, (e) => e.slice(0, -1)); // truncation after approval IS caught
  assert.ok(problems(a).length > 0);
  const doc = fs.readFileSync(new URL("../docs/UNRESOLVED-DECISIONS.md", import.meta.url), "utf8");
  assert.match(doc, /U-24[^\n]*OPEN/);
});

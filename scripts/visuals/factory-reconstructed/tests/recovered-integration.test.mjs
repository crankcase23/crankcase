// RECONSTRUCTED TEST suite — does the RECOVERED visual-contract layer integrate cleanly with reconstructed output?
// Runs the recovered, unmodified src/lib/guideVisuals.ts (bundled with esbuild) against records the reconstruction produced.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadRecoveredResolver, allowNoResolver } from "../integration/recovered-resolver.mjs";
import { newRun, driveToQaPending, passQA, passAll, independentQA, INDEPENDENT_REVIEWER, APPLICATION, GUIDE_ID } from "./support/fixtures.mjs";

const R = await loadRecoveredResolver();
const skip = R.available ? false : `SKIPPED (not passed): ${R.reason}`;
// A missing/blocked resolver must FAIL by default; skipping is an explicit opt-out (GF_ALLOW_NO_ESBUILD=1).
test("RECONSTRUCTED TEST: the recovered resolver can be bundled (esbuild present, recovered tree intact) unless explicitly opted out", { skip: allowNoResolver() ? "SKIPPED by GF_ALLOW_NO_ESBUILD=1" : false }, () => {
  assert.equal(R.available, true, `recovered resolver unavailable: ${R.reason}`);
});
const set = { guideId: GUIDE_ID, application: APPLICATION, steps: {} };
const guide = { id: GUIDE_ID };

async function entry({ authority = { approvedBy: "andy", approvedOn: "2026-10-04" }, callouts = false } = {}) {
  const run = newRun("rec"); await driveToQaPending(run, { spec: { callouts: callouts ? [{ label: "Clamp", element: "fixture-clamp", required: true }] : [], clearSpace: [] } });
  passAll(run); run.admit(); run.normalize();
  if (callouts) run.overlayCheck({ reviewer: INDEPENDENT_REVIEWER, results: [{ callout: "Clamp", result: "PASS" }] });
  const { registry } = run.approve({ step: 99, presentation: { alt: "synthetic alt", caption: "synthetic caption" }, authority });
  return structuredClone(registry.entry);
}
const refusal = (e) => R.visualRefusal(set, e, guide, APPLICATION);

test("RECONSTRUCTED TEST: recovered resolver loads unmodified and exposes its public API", { skip }, () => {
  assert.equal(R.TREATMENT_VERSION, "cc-visual-1"); assert.equal(typeof R.visualRefusal, "function"); assert.equal(typeof R.resolveStepVisuals, "function");
});

test("RECONSTRUCTED TEST: a reconstructed, human-signed, QA-passed approval is ACCEPTED by the recovered resolver (SYNTHETIC fixture)", { skip }, async () => {
  assert.equal(refusal(await entry()), null);
});

test("RECONSTRUCTED TEST: the same record WITHOUT Andy's sign-off is refused as 'not verified' (no human, nothing shown)", { skip }, async () => {
  assert.equal(refusal(await entry({ authority: null })), "not verified");
});

test("RECONSTRUCTED TEST: a reconstructed record with overlay QA + callouts is accepted by the recovered resolver", { skip }, async () => {
  assert.equal(refusal(await entry({ callouts: true })), null);
});

test("RECONSTRUCTED TEST: the recovered resolver independently refuses each tampering of a reconstructed record (reconstruction and recovered rules agree)", { skip }, async () => {
  const cases = [
    ["caption lacks disclosure", (e) => { e.caption = "no disclosure"; }, /customer disclosure/],
    ["QA reviewer same system as generator", (e) => { e.provenance.generatedRaster.qa.reviewer.system = e.provenance.generatedRaster.generator.system; }, /not independent/],
    ["QA reviewer is the attester", (e) => { e.provenance.generatedRaster.qa.reviewer.actor = "image-generator"; }, /not independent/],
    ["image inputs present", (e) => { e.provenance.generatedRaster.imageInputs = [{}]; }, /image inputs/],
    ["attestation flag false", (e) => { e.provenance.generatedRaster.attestation.noTracing = false; }, /attestation missing or incomplete/],
    ["ownership asserted", (e) => { e.provenance.generatedRaster.license.ownershipAsserted = true; }, /must not assert ownership/],
    ["license owned", (e) => { e.provenance.license.status = "owned"; }, /generated-original/],
    ["source hash mismatch", (e) => { e.provenance.rawSha256 = "0".repeat(64); }, /source artifact hash inconsistent/],
    ["final hash mismatch", (e) => { e.provenance.finalSha256 = "0".repeat(64); }, /normalized artifact hash inconsistent/],
    ["source == normalized", (e) => { e.provenance.generatedRaster.normalizedArtifact.sha256 = e.provenance.generatedRaster.sourceArtifact.sha256; e.provenance.finalSha256 = e.provenance.rawSha256; }, /must be distinct/],
    ["metadata remains on derivative", (e) => { e.provenance.generatedRaster.normalizedArtifact.metadataChunks = ["caBX"]; }, /embedded metadata/],
    ["QA not PASS", (e) => { e.provenance.generatedRaster.qa.verdict = "CORRECTIONS_REQUIRED"; }, /independent passing technical QA/],
    ["factory ref missing", (e) => { delete e.provenance.generatedRaster.epRef; }, /factory references/],
    ["wrong vehicle", (e) => { e.application = { ...e.application, year: 2017 }; }, /application does not match/],
    ["bad path", (e) => { e.src = "/elsewhere/x.png"; }, /bad path/],
    ["treatment version", (e) => { e.provenance.treatment.version = "other"; }, /current Crankcase pipeline/],
  ];
  for (const [name, mutate, re] of cases) { const e = await entry(); mutate(e); assert.match(String(refusal(e)), re, name); }
});

test("RECONSTRUCTED TEST: callouts shown without a passing overlay QA are refused by the recovered resolver", { skip }, async () => {
  const e = await entry(); e.provenance.calloutsVerified = true;
  assert.match(String(refusal(e)), /overlay QA/);
});

test("RECONSTRUCTED TEST: the recovered Charger registry is empty, so step 10 shows nothing (consistent with the proving run)", { skip }, () => {
  assert.deepEqual(JSON.parse(fs.readFileSync(new URL("../recovered/src/data/guide-visuals/charger-2016-sxt-multi-job.visuals.json", import.meta.url), "utf8")), { visuals: [] });
  assert.deepEqual(R.resolveStepVisuals(guide, APPLICATION, 10), []);
  assert.equal(R.applicationMatches(R.chargerVisuals.application, APPLICATION), true);
});

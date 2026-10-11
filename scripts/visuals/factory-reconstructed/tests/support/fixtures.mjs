// RECONSTRUCTED-V1 TEST SUPPORT | everything here is SYNTHETIC. None of it is Charger artwork or real evidence.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { encodePng, makeChunk, PNG_SIG, parsePng } from "../../src/png.mjs";
import { FactoryRun } from "../../src/machine.mjs";
import { sha256 } from "../../src/canon.mjs";

export const APPLICATION = { year: 2016, make: "Dodge", model: "Charger", trim: "SXT", engine: "3.6L Pentastar V6" };
export const GUIDE_ID = "admin-test-charger-2016-sxt-multi-job";
export const REGISTRY = { [GUIDE_ID]: APPLICATION }; // same content as recovered visual-sources/applications.json (asserted in a test)

export const makeClock = (startIso = "2026-10-04T12:00:00.000Z") => { let t = Date.parse(startIso); return () => { const s = new Date(t).toISOString(); t += 1000; return s; }; };
export const tmpDir = (name) => fs.mkdtempSync(path.join(os.tmpdir(), `gfr1-${name}-`));

/** Deterministic synthetic raster: a smooth gradient plus seed-dependent block. NOT an illustration of anything. */
export function synthPng(w = 1600, h = 1000, { seed = 1, chunks = [], level = 1 } = {}) {
  const px = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = (y * w + x) * 3; px[o] = (x * 255 / w + seed * 7) & 255; px[o + 1] = (y * 255 / h + seed * 13) & 255; px[o + 2] = ((x + y) * 255 / (w + h)) & 255; }
  return encodePng({ width: w, height: h, channels: 3, pixels: px }, { level, extraChunks: chunks });
}
export const caBX = (text = "synthetic-c2pa-manifest") => ({ type: "caBX", data: Buffer.from(text) });
export const tEXt = (k = "Software", v = "synthetic") => ({ type: "tEXt", data: Buffer.from(`${k}\0${v}`) });
export function insertChunk(png, type, data) { const p = parsePng(png); void p; const idx = png.length - 12; return Buffer.concat([png.subarray(0, idx), makeChunk(type, data), png.subarray(idx)]); }
export const corrupt = (png, at = 100) => { const b = Buffer.from(png); b[at] ^= 0xff; return b; };
export { PNG_SIG, sha256 };

export const goodAttestation = (on = "2026-10-04") => ({ generatedFromTextOnly: true, noReferenceImageInputs: true, noTracing: true, noThirdPartyCompositing: true, noBakedText: true, attestedBy: "image-generator", attestedOn: on, statement: "SYNTHETIC TEST ATTESTATION: generated from text only." });
export const goodOutput = (bytes, over = {}) => ({ bytes, mediaType: "png", generator: { system: "synthetic-generator", model: "synthetic-model-1", provider: "synthetic-provider" }, requestId: "req-synthetic", generationId: "gen-synthetic", attestation: goodAttestation(), imageInputs: [], inputHashes: [], contractAck: { mustNotDepictAcknowledged: true }, licenseTerms: { summary: "SYNTHETIC terms; no real provider terms recorded" }, ...over });

/** Synthetic Evidence Packet body. References are obviously fake; this exercises rules, it asserts nothing about any vehicle. */
export function fixtureEPBody(over = {}) {
  return {
    canonicalStep: { stepNumber: 99, title: "SYNTHETIC step", actions: ["synthetic action"] },
    references: [{ id: "ref-1", kind: "oem-text", source: "SYNTHETIC FIXTURE", sourceRef: "synthetic://fixture/1", usage: "reference-only", establishes: ["synthetic existence and location"], rights: "synthetic; no pixels used" }],
    elements: [
      { id: "fixture-hose", role: "hero", criticality: "critical" },
      { id: "fixture-clamp", role: "target", criticality: "critical" },
      { id: "fixture-bg", role: "context", criticality: "cosmetic" },
      { id: "fixture-cover", role: "context", criticality: "cosmetic" },
    ],
    ledger: [
      { element: "fixture-hose", attribute: "existence", status: "established", evidence: ["ref-1"], render: "draw", note: "synthetic" },
      { element: "fixture-hose", attribute: "location", status: "established", evidence: ["ref-1"], render: "draw", note: "synthetic" },
      { element: "fixture-clamp", attribute: "existence", status: "established", evidence: ["ref-1"], render: "draw", note: "synthetic" },
      { element: "fixture-clamp", attribute: "location", status: "established", evidence: ["ref-1"], render: "draw", note: "synthetic" },
      { element: "fixture-clamp", attribute: "fastener-position", status: "not-established", render: "omit", note: "synthetic: screw side not established" },
      { element: "fixture-cover", attribute: "existence", status: "not-established", render: "omit", note: "synthetic: must not be shown" },
    ],
    mustNotDepict: [{ id: "fixture-cover", element: "fixture-cover", reason: "synthetic exclusion", trace: { element: "fixture-cover", attribute: "existence" } }],
    sufficiencyProposal: { proposedBy: "claude-research", basis: "SYNTHETIC: all hero/target facts cited" },
    ...over,
  };
}

export function newRun(name, { policy, registry = REGISTRY, visualId = "synthetic-fixture" } = {}) {
  const dir = path.join(tmpDir(name), visualId);
  // allowNonCanonical only when a test explicitly asks for a non-default policy (diagnostic use; such runs can never be approved)
  const run = new FactoryRun({ dir, visualId, application: APPLICATION, guideId: GUIDE_ID, registry, clock: makeClock(), policy, allowNonCanonical: policy !== undefined });
  run.init();
  return run;
}

/** QA submission where everything passes (SYNTHETIC reviewer). */
export function passQA(run, over = {}) {
  const vc = run.store().get(run.state.vc.ref.id);
  const checks = [...vc.mustDepict.map((m) => ({ contractItemId: m.id, result: "PASS" })), ...vc.mustNotDepict.map((m) => ({ contractItemId: m.id, result: "PASS" })), { contractItemId: "PROVENANCE", result: "PASS" }];
  return { reviewer: { actor: "claude-qa", model: "synthetic-qa-model", system: "synthetic-qa-system" }, rubricVersion: "CG-QA-v1.0", provenanceCheck: { validated: true, notes: "synthetic" }, checks, findings: [], regressionCheck: [], ...over };
}
export const INDEPENDENT_REVIEWER = { actor: "hermes", model: "GPT-5.6 Sol", system: "Hermes / ChatGPT", rawResponseSha256: sha256(Buffer.from("SYNTHETIC raw independent review transcript")) }; // SYNTHETIC identity strings in the canonical shape
/** INDEPENDENT (hermes) QA submission where everything passes (SYNTHETIC reviewer). */
export const independentQA = (run, over = {}) => passQA(run, { reviewer: { ...INDEPENDENT_REVIEWER }, ...over });
/** Internal claude-qa PASS followed by the independent hermes PASS (the only path that can admit output). */
export function passAll(run) { run.submitQA(passQA(run)); return run.submitIndependentReview(independentQA(run)); }

/** QA submission failing one must-depict item with a CONTRACT finding. */
export function failQA(run, itemId = "MD-fixture-clamp", over = {}) {
  const base = passQA(run);
  base.checks = base.checks.map((c) => (c.contractItemId === itemId ? { ...c, result: "FAIL" } : c));
  base.findings = [{ id: "F1", severity: "CONTRACT", contractItemRef: itemId, element: itemId.replace(/^MD-/, ""), attribute: "location", description: "synthetic defect", requiredChange: "synthetic fix", fixType: "modify", region: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 }, evidenceDeficiency: false, regression: false, gate: "VISUAL_ACCURACY" }];
  return { ...base, ...over };
}

export async function driveToQaPending(run, { bytes = synthPng(1600, 1000, { seed: 1, chunks: [caBX()] }), out = {}, epBody = fixtureEPBody(), spec = null } = {}) {
  const { ScriptedGenerator, runGeneration } = await import("../../src/actors.mjs");
  run.registerEP(epBody); run.evaluateEP(); run.compileContract({ spec });
  const gen = new ScriptedGenerator([goodOutput(bytes, out)]);
  const r = await runGeneration(run, gen, { promptText: "SYNTHETIC PROMPT\n" });
  return { gen, r };
}

// Hermes QA export/import + FileDrop import. Everything here is SYNTHETIC (fixtures from the factory test support):
// no real image, no real review, no real vehicle claim. These tests exercise the rules, not any car.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const FIX = path.join(ROOT, "scripts/visuals/factory-reconstructed/tests/support/fixtures.mjs");
const { newRun, driveToQaPending, synthPng, caBX, goodAttestation } = await import(FIX);
const { snapshot } = await import(path.join(ROOT, "scripts/visuals/factory-reconstructed/src/store.mjs"));
const { sha256 } = await import(path.join(ROOT, "scripts/visuals/factory-reconstructed/src/canon.mjs"));
const { exportPacket, importReview, extractReplyJson, writeDropTemplate, importDrop, buildPacket } = await import(path.join(ROOT, "scripts/bmw/hermes-qa.mjs"));

const tmp = (n) => fs.mkdtempSync(path.join(os.tmpdir(), `bmw-${n}-`));
const IDENT = { model: "GPT-5.6 Sol (SYNTHETIC test identity)", system: "Hermes / ChatGPT (SYNTHETIC)" };

/** A reply the way a reviewer would write it, from the exported packet. */
function reply(packet, over = {}) {
  const r = {
    candidateSha256: packet.candidate.sha256, rubricVersion: "CG-QA-v1.0", provenanceCheck: { validated: true, notes: "synthetic" },
    checks: packet.items.map((i) => ({ contractItemId: i.contractItemId, result: "PASS" })), findings: [], regressionCheck: [], ...over,
  };
  return "Here is my review.\n\n```json\n" + JSON.stringify(r, null, 2) + "\n```\n";
}

async function pendingRun(name) {
  const run = newRun(name);
  await driveToQaPending(run);
  return run;
}

test("export builds a QA packet from the locked contract and excludes internal QA", async () => {
  const run = await pendingRun("exp");
  run.submitQA({ reviewer: { actor: "claude-qa", model: "synthetic-qa", system: "synthetic-qa" }, rubricVersion: "CG-QA-v1.0", provenanceCheck: { validated: true, notes: "INTERNAL-NOTE-MARKER" }, checks: run.store().get(run.state.vc.ref.id).mustDepict.map((m) => ({ contractItemId: m.id, result: "PASS" })).concat(run.store().get(run.state.vc.ref.id).mustNotDepict.map((m) => ({ contractItemId: m.id, result: "PASS" })), [{ contractItemId: "PROVENANCE", result: "PASS" }]), findings: [], regressionCheck: [] });
  assert.equal(run.state.phase, "INTERNAL_QA_PASSED");
  const out = tmp("pkt");
  const r = exportPacket(run, out);
  assert.ok(r.ok);
  for (const f of ["QA-PACKET.md", "packet.json", "candidate.png", "response.template.json"]) assert.ok(fs.existsSync(path.join(r.dir, f)), f);
  const md = fs.readFileSync(path.join(r.dir, "QA-PACKET.md"), "utf8");
  assert.ok(!md.includes("INTERNAL-NOTE-MARKER") && !/claude-qa/.test(md + JSON.stringify(r.packet)), "internal QA must not leak into the independent packet");
  assert.equal(sha256(fs.readFileSync(path.join(r.dir, "candidate.png"))), r.packet.candidate.sha256);
  const ids = r.packet.items.map((i) => i.contractItemId);
  assert.ok(ids.includes("PROVENANCE") && ids.some((i) => i.startsWith("MD-")) && ids.some((i) => i.startsWith("MN-")));
  assert.ok(r.packet.replyFormat.checks.length === ids.length);
});

test("export is refused when there is no candidate awaiting QA", async () => {
  const run = newRun("early");
  run.registerEP((await import(FIX)).fixtureEPBody()); run.evaluateEP(); run.compileContract({});
  const r = buildPacket(run);
  assert.equal(r.ok, false);
  assert.equal(r.code, "WRONG_STATE");
});

test("a valid independent reply is recorded: hashed raw text, hermes actor, run advances to QA_PASSED, then admit + normalize work", async () => {
  const run = await pendingRun("imp");
  const out = tmp("pkt");
  const { packet } = exportPacket(run, out);
  const raw = reply(packet);
  const r = importReview(run, { rawText: raw, packetDir: out, ...IDENT });
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.verdict, "PASS_FOR_OVERLAY_QA");
  assert.equal(run.state.phase, "QA_PASSED");
  const qr = run.store().get(run.state.lastQR.id);
  assert.equal(qr.reviewClass, "independent");
  assert.equal(qr.reviewer.actor, "hermes");
  assert.equal(qr.reviewer.rawResponseSha256, sha256(Buffer.from(raw, "utf8")));
  assert.ok(fs.existsSync(path.join(out, run.visualId, "responses", `${qr.reviewer.rawResponseSha256}.txt`)), "raw reply archived for audit");
  run.admit();
  run.normalize();
  assert.equal(run.state.phase, "NORMALIZED");
  assert.equal(run.state.approved, false, "import never approves; owner sign-off is separate");
});

test("import refuses bad replies and leaves the run directory byte-identical", async () => {
  const run = await pendingRun("bad");
  const { packet } = exportPacket(run, tmp("pkt"));
  const before = snapshot(run.dir);
  const cases = {
    "reply for another image": [reply(packet, { candidateSha256: "0".repeat(64) }), IDENT, "WRONG_CANDIDATE"],
    "no JSON": ["I think it looks fine.", IDENT, "REPLY_JSON"],
    "two JSON objects": [reply(packet) + "\n" + reply(packet), IDENT, "REPLY_JSON"],
    "missing identity": [reply(packet), { model: "", system: "" }, "REVIEWER_IDENTITY"],
    "claude identity": [reply(packet), { model: "claude-opus", system: "Hermes" }, "QR_INVALID"],
    "not a gpt model": [reply(packet), { model: "some-other-model", system: "Hermes / ChatGPT" }, "QR_INVALID"],
    "unknown check id": [reply(packet, { checks: [...packet.items.map((i) => ({ contractItemId: i.contractItemId, result: "PASS" })), { contractItemId: "MD-made-up", result: "PASS" }] }), IDENT, "REPLY_SHAPE"],
    "item not checked": [reply(packet, { checks: packet.items.slice(1).map((i) => ({ contractItemId: i.contractItemId, result: "PASS" })) }), IDENT, "QR_INVALID"],
    "fail without a finding": [reply(packet, { checks: packet.items.map((i, n) => ({ contractItemId: i.contractItemId, result: n === 0 && i.kind === "must-depict" ? "FAIL" : "PASS" })) }), IDENT, "QR_INVALID"],
    "wrong rubric": [reply(packet, { rubricVersion: "CG-QA-v0" }), IDENT, "QR_INVALID"],
  };
  for (const [name, [rawText, id, code]] of Object.entries(cases)) {
    const r = importReview(run, { rawText, ...id });
    assert.equal(r.ok, false, name);
    assert.equal(r.code, code, `${name}: got ${r.code}`);
    assert.deepEqual(snapshot(run.dir), before, `${name}: directory changed`);
  }
});

test("a failing independent review issues a correction delta and does not admit", async () => {
  const run = await pendingRun("fail");
  const { packet } = exportPacket(run, tmp("pkt"));
  const target = packet.items.find((i) => i.kind === "must-depict");
  const raw = reply(packet, {
    checks: packet.items.map((i) => ({ contractItemId: i.contractItemId, result: i.contractItemId === target.contractItemId ? "FAIL" : "PASS" })),
    findings: [{ id: "F1", severity: "CONTRACT", contractItemRef: target.contractItemId, element: target.element, attribute: "location", description: "synthetic defect", requiredChange: "synthetic fix", fixType: "modify", gate: "VISUAL_ACCURACY", evidenceDeficiency: false, regression: false }],
  });
  const r = importReview(run, { rawText: raw, ...IDENT });
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.verdict, "CORRECTIONS_REQUIRED");
  assert.ok(r.delta, "delta issued");
  assert.throws(() => run.admit(), /WRONG_STATE|not allowed/);
});

test("extractReplyJson accepts a fenced or bare object only", () => {
  assert.ok(extractReplyJson('```json\n{"a":1}\n```').ok);
  assert.ok(extractReplyJson('{"a":1}').ok);
  assert.equal(extractReplyJson("[1,2]").ok, false);
  assert.equal(extractReplyJson("nothing").ok, false);
});

test("FileDrop: template has nothing pre-attested; incomplete, wrong-state and good drops behave", async () => {
  const dir = tmp("drop");
  const tpl = JSON.parse(fs.readFileSync(writeDropTemplate(dir), "utf8"));
  assert.ok(Object.values(tpl.attestation).filter((v) => typeof v === "boolean").length === 0, "attestation flags must start null");
  const run = newRun("dropimp");
  const prompt = "SYNTHETIC PROMPT\n";
  run.registerEP((await import(FIX)).fixtureEPBody()); run.evaluateEP(); run.compileContract({});
  // no candidate yet
  let r = await importDrop(run, { dropDir: dir, promptText: prompt });
  assert.equal(r.code, "NO_CANDIDATE");
  // candidate with an unfilled template is refused before anything is written
  fs.writeFileSync(path.join(dir, "candidate.png"), synthPng(1600, 1000, { seed: 3, chunks: [caBX()] }));
  fs.copyFileSync(path.join(dir, "candidate.claims.template.json"), path.join(dir, "candidate.claims.json"));
  const before = snapshot(run.dir);
  r = await importDrop(run, { dropDir: dir, promptText: prompt });
  assert.equal(r.code, "CLAIMS_INCOMPLETE");
  assert.deepEqual(snapshot(run.dir), before);
  // a false attestation is accepted as a record but rejected by provenance
  const claims = { generator: { system: "synthetic-generator", model: "synthetic-model-1", provider: "synthetic-provider" }, requestId: "r1", generationId: "g1", attestation: { ...goodAttestation(), noTracing: false }, imageInputs: [], inputHashes: [], contractAck: { mustNotDepictAcknowledged: true }, licenseTerms: { summary: "SYNTHETIC terms" } };
  fs.writeFileSync(path.join(dir, "candidate.claims.json"), JSON.stringify(claims));
  r = await importDrop(run, { dropDir: dir, promptText: prompt });
  assert.ok(r.ok);
  assert.equal(r.provenance, "rejected");
  assert.ok(r.problems.some((p) => p.code === "ATT_FLAG_FALSE"));
});

test("FileDrop: a truthful candidate becomes provenance-valid and awaits QA", async () => {
  const dir = tmp("drop2");
  fs.writeFileSync(path.join(dir, "candidate.png"), synthPng(1600, 1000, { seed: 5, chunks: [caBX()] }));
  const claims = { generator: { system: "synthetic-generator", model: "synthetic-model-1", provider: "synthetic-provider" }, requestId: "r2", generationId: "g2", attestation: goodAttestation(), imageInputs: [], inputHashes: [], contractAck: { mustNotDepictAcknowledged: true }, licenseTerms: { summary: "SYNTHETIC terms" } };
  fs.writeFileSync(path.join(dir, "candidate.claims.json"), JSON.stringify(claims));
  const run = newRun("drop2");
  run.registerEP((await import(FIX)).fixtureEPBody()); run.evaluateEP(); run.compileContract({});
  const r = await importDrop(run, { dropDir: dir, promptText: "SYNTHETIC PROMPT\n" });
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.provenance, "valid");
  assert.equal(run.state.phase, "QA_PENDING");
});

test("preview packet: a locked contract with a prompt but no image yields a scaffold that cannot be reviewed; kit writes prompt and instructions", async () => {
  const { writeGenKit } = await import(path.join(ROOT, "scripts/bmw/hermes-qa.mjs"));
  const run = newRun("prev");
  run.registerEP((await import(FIX)).fixtureEPBody()); run.evaluateEP(); run.compileContract({});
  const promptText = "SYNTHETIC PROMPT TEXT";
  run.requestGeneration({ promptText });
  assert.equal(run.state.phase, "GEN_REQUESTED");
  fs.writeFileSync(path.join(run.dir, "generation-prompt.txt"), promptText);
  // without preview: refused as before
  assert.equal(buildPacket(run).ok, false);
  const out = tmp("prevout");
  const r = exportPacket(run, out, { preview: true });
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.packet.status, "AWAITING_CANDIDATE_IMAGE");
  assert.ok(fs.existsSync(path.join(r.dir, "QA-PACKET.PREVIEW.md")));
  assert.ok(!fs.existsSync(path.join(r.dir, "candidate.png")) && !fs.existsSync(path.join(r.dir, "QA-PACKET.md")), "no image, no reviewable packet");
  assert.match(fs.readFileSync(path.join(r.dir, "QA-PACKET.PREVIEW.md"), "utf8"), /PREVIEW/);
  const k = writeGenKit(run, tmp("kit"));
  assert.ok(k.ok);
  for (const f of ["PROMPT.txt", "INSTRUCTIONS.md", "candidate.claims.template.json"]) assert.ok(fs.existsSync(path.join(k.dir, f)), f);
  assert.equal(fs.readFileSync(path.join(k.dir, "PROMPT.txt"), "utf8"), promptText);
  assert.equal(k.promptSha256, sha256(Buffer.from(promptText, "utf8")));
});

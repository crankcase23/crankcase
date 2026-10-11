// RECONSTRUCTED TEST suite — provenance, no-source-pixels attestation, admission gate.
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkGeneration, noSourcePixelsProblems, attestationProblems, describeRaster } from "../src/provenance.mjs";
import { Refused, snapshot } from "../src/store.mjs";
import { sha256 } from "../src/canon.mjs";
import { newRun, driveToQaPending, synthPng, goodAttestation, caBX, tEXt, passQA, passAll, corrupt, fixtureEPBody } from "./support/fixtures.mjs";
import { ScriptedGenerator, runGeneration } from "../src/actors.mjs";
import { goodOutput } from "./support/fixtures.mjs";

const codes = (r) => r.problems.map((p) => p.code);
async function submitWith(over, bytes = synthPng(1600, 1000, { seed: 2 }), policy) {
  const run = newRun("prov", { policy });
  run.registerEP(fixtureEPBody()); run.evaluateEP(); run.compileContract({});
  const r = await runGeneration(run, new ScriptedGenerator([goodOutput(bytes, over)]), { promptText: "p\n" });
  return { run, r };
}

test("RECONSTRUCTED TEST: a clean generation passes provenance and records its C2PA presence without requiring it", async () => {
  const { r } = await submitWith({}, synthPng(1600, 1000, { seed: 1 }));
  assert.equal(r.provenance, "valid");
  assert.equal(r.gr.artifact.c2pa.present, false);
  const { r: r2 } = await submitWith({}, synthPng(1600, 1000, { seed: 1, chunks: [caBX("x"), tEXt()] }));
  assert.equal(r2.provenance, "valid");
  assert.equal(r2.gr.artifact.c2pa.present, true);
  assert.match(r2.gr.artifact.c2pa.manifestSha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(r2.gr.artifact.metadataChunks.sort(), ["caBX", "tEXt"]);
});

test("RECONSTRUCTED TEST: provenance failure — generation used image inputs (substantive) is rejected", async () => {
  const { r } = await submitWith({ imageInputs: [{ file: "ref.jpg" }] });
  assert.equal(r.provenance, "rejected"); assert.ok(codes(r).includes("GR_IMAGE_INPUTS"));
});

test("RECONSTRUCTED TEST: provenance failure — attestation flags false (substantive) / missing (metadata) / wrong attester", async () => {
  for (const f of ["generatedFromTextOnly", "noReferenceImageInputs", "noTracing", "noThirdPartyCompositing"]) {
    const { r } = await submitWith({ attestation: { ...goodAttestation(), [f]: false } });
    assert.equal(r.provenance, "rejected", f); assert.ok(codes(r).includes("ATT_FLAG_FALSE"), f);
  }
  const { r: a } = await submitWith({ attestation: undefined }); assert.ok(codes(a).includes("ATT_MISSING"));
  const { r: b } = await submitWith({ attestation: { ...goodAttestation(), attestedBy: "claude-qa" } }); assert.ok(codes(b).includes("ATT_ATTESTER"));
  const { r: c } = await submitWith({ attestation: { ...goodAttestation(), noBakedText: undefined } }); assert.ok(codes(c).includes("ATT_INCOMPLETE"));
  const { r: d } = await submitWith({ contractAck: { mustNotDepictAcknowledged: false } }); assert.ok(codes(d).includes("GR_CONTRACT_ACK"));
});

test("RECONSTRUCTED TEST: provenance failure — wrong magic bytes, corrupt PNG, wrong aspect, too small, animated, too large, wrong media type", async () => {
  assert.ok(codes((await submitWith({}, Buffer.from("GIF89a....."))).r).includes("GR_MAGIC"));
  assert.ok(codes((await submitWith({}, corrupt(synthPng(1600, 1000), 60))).r).includes("GR_MAGIC"));
  assert.ok(codes((await submitWith({}, synthPng(1600, 1200))).r).includes("GR_ASPECT"));
  assert.ok(codes((await submitWith({}, synthPng(1280, 800))).r).includes("GR_TOO_SMALL"));
  assert.ok(codes((await submitWith({}, synthPng(1600, 1000, { chunks: [{ type: "acTL", data: Buffer.alloc(8) }] }))).r).includes("GR_ANIMATED"));
  assert.ok(codes((await submitWith({ mediaType: "webp" })).r).includes("GR_MEDIA_TYPE"));
  const { run, r } = await submitWith({});
  const vc = run.store().get(run.state.vc.ref.id);
  const tiny = checkGeneration({ gr: r.gr, bytes: synthPng(1600, 1000, { seed: 2 }), vc: { ...vc, output: { ...vc.output, maxBytes: 100 } }, promptText: "p\n" });
  assert.ok(tiny.problems.some((p) => p.code === "GR_TOO_LARGE"));
});

test("RECONSTRUCTED TEST: provenance failure — recorded hash/dimensions that disagree with the real file are caught on re-check", async () => {
  const { run, r } = await submitWith({});
  const bytes = synthPng(1600, 1000, { seed: 2 });
  const vc = run.store().get(run.state.vc.ref.id);
  const tampered = { ...r.gr, artifact: { ...r.gr.artifact, sha256: "b".repeat(64), width: 1700 } };
  const res = checkGeneration({ gr: tampered, bytes, vc, promptText: "p\n" });
  assert.ok(res.problems.some((p) => p.code === "GR_HASH") && res.problems.some((p) => p.code === "GR_DIMENSIONS_RECORD"));
  const res2 = checkGeneration({ gr: r.gr, bytes, vc, promptText: "different prompt" });
  assert.ok(res2.problems.some((p) => p.code === "GR_PROMPT"));
  assert.equal(sha256(bytes), describeRaster(bytes).sha256);
});

test("RECONSTRUCTED TEST: provenance — attestation by the QA actor is refused", async () => {
  const { run, r } = await submitWith({});
  const vc = run.store().get(run.state.vc.ref.id);
  const res = checkGeneration({ gr: r.gr, bytes: synthPng(1600, 1000, { seed: 2 }), vc, promptText: "p\n", qaActor: "image-generator" });
  assert.ok(res.problems.some((p) => p.code === "GR_ATTESTER_IS_QA"));
});

test("RECONSTRUCTED TEST: no-source-pixels attestation is REQUIRED for original artwork where documented", () => {
  const ok = { attested: true, by: "artist", on: "2026-10-04", statement: "drawn from the spec", referenceImageInputs: [], tracedFrom: [] };
  assert.deepEqual(noSourcePixelsProblems(ok), []);
  assert.equal(noSourcePixelsProblems(undefined)[0].code, "NSP_MISSING");
  assert.equal(noSourcePixelsProblems({ ...ok, attested: false })[0].code, "NSP_MISSING");
  assert.equal(noSourcePixelsProblems({ ...ok, by: "" })[0].code, "NSP_MISSING");
  assert.equal(noSourcePixelsProblems({ ...ok, referenceImageInputs: ["ref.jpg"] })[0].code, "NSP_DERIVED");
  assert.equal(noSourcePixelsProblems({ ...ok, tracedFrom: ["oem-fig-3"] })[0].code, "NSP_DERIVED");
  assert.equal(noSourcePixelsProblems({ ...ok, statement: "" })[0].code, "NSP_MISSING");
});

test("RECONSTRUCTED TEST: the raster-path attestation (the generated-raster analogue) is required and complete", () => {
  assert.deepEqual(attestationProblems(goodAttestation()), []);
  assert.ok(attestationProblems(undefined).length);
  assert.ok(attestationProblems({ ...goodAttestation(), statement: "" }).length);
  assert.ok(attestationProblems({ ...goodAttestation(), attestedOn: "not a date" }).length);
});

test("RECONSTRUCTED TEST: a provenance-rejected generation cannot become admitted output (QA, admit, normalize, approve all refused)", async () => {
  const { run, r } = await submitWith({ attestation: { ...goodAttestation(), noTracing: false } });
  assert.equal(r.provenance, "rejected");
  const before = snapshot(run.dir);
  for (const call of [() => run.submitQA(passQA({ store: () => run.store(), state: run.state })), () => run.admit(), () => run.normalize(), () => run.approve({ step: 10, presentation: { alt: "a", caption: "c" } })]) {
    assert.throws(call, (e) => e instanceof Refused && ["WRONG_STATE", "QR_INVALID"].includes(e.code));
  }
  assert.deepEqual(snapshot(run.dir), before); // refusals wrote nothing
  assert.equal(run.state.grStatus[r.gr.id], "PROVENANCE_REJECTED");
});

test("RECONSTRUCTED TEST: a rejected GR is still recorded as immutable evidence but never reaches approved.json", async () => {
  const { run, r } = await submitWith({ imageInputs: [{ file: "ref.jpg" }] });
  assert.ok(run.store().has(r.gr.id));
  assert.ok(!run.store().has("AA-synthetic-fixture"));
});

test("RECONSTRUCTED TEST: admission gate refuses when the candidate file no longer matches its record", async () => {
  const run = newRun("adm");
  await driveToQaPending(run);
  passAll(run);
  const fs = await import("node:fs");
  const gr = run.store().get(run.state.pendingGR.id);
  const p = run.dir + "/" + gr.artifact.file; const b = fs.readFileSync(p); b[b.length - 20] ^= 1; fs.writeFileSync(p, b);
  assert.throws(() => run.admit(), (e) => e instanceof Refused && e.code === "ADMISSION_REFUSED" && /hash no longer matches/.test(e.message));
});

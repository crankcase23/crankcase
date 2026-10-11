// RECONSTRUCTED TEST suite — Step 10 evidence package: AVAILABLE items exist and are intact; MISSING items are really missing; blockers are real codes.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ITEMS, STATUS, byStatus } from "../charger-step10/evidence-package.mjs";
import { CONFLICTS } from "../charger-step10/conflicts.mjs";
import { runStep10Proving } from "../charger-step10/run-proving.mjs";
import { verifyRecovered } from "../integration/recovered-resolver.mjs";
import { makeClock, newRun, driveToQaPending, passQA, independentQA, synthPng, goodOutput, goodAttestation, fixtureEPBody } from "./support/fixtures.mjs";
import { ScriptedGenerator, runGeneration } from "../src/actors.mjs";
import { Refused } from "../src/store.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const byId = (id) => ITEMS.find((i) => i.id === id);

test("RECONSTRUCTED TEST [STEP10 EVIDENCE]: every item has a legal status, a unique id, and the four required groups are all present", () => {
  assert.equal(new Set(ITEMS.map((i) => i.id)).size, ITEMS.length);
  for (const i of ITEMS) assert.ok(STATUS.includes(i.status), i.id);
  for (const s of STATUS) assert.ok(byStatus(s).length > 0, s);
});

test("RECONSTRUCTED TEST [STEP10 EVIDENCE]: AVAILABLE items point at files that exist, and the recovered ones are intact", () => {
  assert.deepEqual(verifyRecovered(), []);
  for (const i of byStatus("AVAILABLE")) for (const p of i.where.split(/ and |, /)) { const f = path.join(root, p.replace(/ \(.*$/, "").trim()); assert.ok(fs.existsSync(f), `${i.id}: ${p} does not exist`); }
});

test("RECONSTRUCTED TEST [STEP10 EVIDENCE]: MISSING items with a named file are genuinely absent (nothing was fabricated to fill them)", () => {
  for (const i of byStatus("MISSING").filter((x) => x.file)) assert.equal(fs.existsSync(path.join(root, i.file)), false, `${i.id}: ${i.file} exists`);
  assert.equal(fs.existsSync(path.join(root, "charger-step10", "drop")), false, "no candidate drop folder");
  assert.equal(fs.readdirSync(path.join(root, "recovered/visual-sources/2016-dodge-charger-sxt-36")).includes("raw"), false);
});

test("RECONSTRUCTED TEST [STEP10 EVIDENCE]: the blocker codes named for M-01/M-02/M-05 are exactly what the proving run really emits today", async () => {
  const r = await runStep10Proving({ outDir: fs.mkdtempSync(path.join(os.tmpdir(), "gfr1-s10e-")), clock: makeClock() });
  const codes = r.stages.find((s) => s.stage.startsWith("3b")).problemCodes;
  for (const c of [...byId("M-01").blocks.codes, ...byId("M-02").blocks.codes]) assert.ok(codes.includes(c), c);
  assert.match(r.stages.find((s) => s.stage.startsWith("5 ")).detail, /no generator output/);
  assert.equal(r.verdict.step10Passes, false);
});

test("RECONSTRUCTED TEST [STEP10 EVIDENCE]: the other named blocker codes are real codes the factory emits (PRESENTATION, QR_SELF_QA_NOT_INDEPENDENT, ACTOR_UNAVAILABLE, GR_GENERATOR)", async () => {
  const run = newRun("s10e"); await driveToQaPending(run);
  assert.throws(() => run.submitIndependentReview(passQA(run)), (e) => e instanceof Refused && e.problems.some((p) => p.code === "QR_SELF_QA_NOT_INDEPENDENT"));
  run.submitQA(passQA(run)); run.submitIndependentReview(independentQA(run)); run.admit(); run.normalize();
  assert.throws(() => run.approve({ step: 99, presentation: { alt: "", caption: "" } }), (e) => e.code === "PRESENTATION");
  const { FileDropGenerator, ActorUnavailable } = await import("../src/actors.mjs");
  await assert.rejects(() => new FileDropGenerator("/nonexistent").generate({}), ActorUnavailable);
  const { checkGeneration } = await import("../src/provenance.mjs");
  assert.ok(checkGeneration({ gr: { generator: {} }, bytes: Buffer.alloc(0) }).problems.some((p) => p.code === "GR_GENERATOR"));
});

test("RECONSTRUCTED TEST [STEP10 EVIDENCE]: every CONFLICTING item cites real conflict-table rows, and every conflict row is covered by a CONFLICTING item or D-01", () => {
  const ids = new Set(CONFLICTS.map((c) => c.id));
  const cited = new Set(byStatus("CONFLICTING").flatMap((i) => i.conflicts));
  for (const c of cited) assert.ok(ids.has(c), c);
  for (const id of ids) assert.ok(cited.has(id), `${id} is not covered by any CONFLICTING item`);
});

test("RECONSTRUCTED TEST [STEP10 EVIDENCE]: MISSING and CONFLICTING items name who supplies/decides them; human decisions name a decider", () => {
  for (const i of byStatus("MISSING")) assert.ok(i.suppliedBy && i.acceptance && i.blocks?.stage && i.absentProof, i.id);
  for (const i of byStatus("REQUIRES_HUMAN_DECISION")) assert.ok(i.decider, i.id);
});

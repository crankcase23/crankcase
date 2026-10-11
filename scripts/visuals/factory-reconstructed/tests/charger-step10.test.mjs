// RECONSTRUCTED TEST suite — Charger #001 Step 10 proving scenario, from SURVIVING evidence only. Expected result is a PRINCIPLED BLOCK, not green.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runStep10Proving, draftEPFromSpec } from "../charger-step10/run-proving.mjs";
import { allowNoResolver } from "../integration/recovered-resolver.mjs";
import { makeClock } from "./support/fixtures.mjs";
import { parseVisualSpecPrompt } from "../src/spec-intake.mjs";
import { verifyRun } from "../src/verify.mjs";
import { epProblems, sufficiencyProblems } from "../src/evidence.mjs";
import { makeObject } from "../src/objects.mjs";

const out = () => fs.mkdtempSync(path.join(os.tmpdir(), "gfr1-s10-"));
const byStage = (r, prefix) => r.stages.find((s) => s.stage.startsWith(prefix));

test("RECONSTRUCTED TEST: Step 10 — spec intake passes; evidence/ledger/sufficiency/contract/generation and everything downstream are BLOCKED; Step 10 does NOT pass", async () => {
  const r = await runStep10Proving({ outDir: out(), clock: makeClock() });
  assert.equal(r.verdict.step10Passes, false);
  assert.equal(byStage(r, "0 ").status, "PASS"); assert.equal(byStage(r, "1 visual").status, "PASS");
  for (const p of ["2 ", "3 ", "3b", "4 ", "5 ", "6 ", "7 ", "8 ", "9 ", "10 ", "11 "]) assert.equal(byStage(r, p).status, "BLOCKED", p);
  assert.equal(byStage(r, "12").status, "PASS"); assert.deepEqual(r.verdict.stagesFail, []);
  assert.deepEqual(byStage(r, "3b").problemCodes.sort(), ["EP_HERO_NOT_ESTABLISHED", "EP_NO_REFERENCES"]);
});

test("RECONSTRUCTED TEST: Step 10 — nothing is fabricated: zero references, no generation record, no candidate/normalized/approved file, no registry entry", async () => {
  const dir = out(); const r = await runStep10Proving({ outDir: dir, clock: makeClock() });
  assert.equal(byStage(r, "2 ").referencesRecovered, 0);
  const files = fs.readdirSync(path.join(dir, "step-10-intake-duct"), { recursive: true }).map(String);
  assert.deepEqual(files.filter((f) => /generations|qa|deltas|normalized|approved|registry|visual-contract/.test(f)), []);
  const ep = JSON.parse(fs.readFileSync(path.join(dir, "step-10-intake-duct/evidence-packet.v1.json"), "utf8"));
  assert.deepEqual(ep.references, []); assert.ok(ep.ledger.every((l) => l.status === "not-established"));
  assert.match(ep.canonicalStep.title, /RECONSTRUCTION DRAFT/); assert.equal(ep.createdBy.role, "reconstruction-draft-from-documentation");
});

test("RECONSTRUCTED TEST: Step 10 — the draft EP is structurally VALID (so the block is for missing evidence, not malformed input)", () => {
  const spec = parseVisualSpecPrompt(fs.readFileSync(new URL("../recovered/doc-derived/step-10-handoff-prompt.txt", import.meta.url), "utf8")).spec;
  const ep = makeObject("EP", { id: "EP-step-10-intake-duct-v1", visualId: "step-10-intake-duct", application: { year: 2016, make: "Dodge", model: "Charger", trim: "SXT", engine: "3.6L Pentastar V6" }, createdBy: { actor: "claude-research", role: "x" }, createdAt: "2026-10-04T12:00:00.000Z", refs: [], body: draftEPFromSpec(spec) });
  assert.deepEqual(epProblems(ep), []);
  assert.ok(sufficiencyProblems(ep).length > 0);
});

test("RECONSTRUCTED TEST: Step 10 — surviving sources conflict and the conflict is REPORTED, not resolved (grommet/resonator vs MUST NOT SHOW; callout lists differ)", async () => {
  const r = await runStep10Proving({ outDir: out(), clock: makeClock() });
  assert.equal(byStage(r, "1b").status, "PASS_WITH_CONFLICTS");
  const a = r.conflicts.find((c) => c.id === "U-10a"), b = r.conflicts.find((c) => c.id === "U-10b");
  assert.match(a.what, /grommet/); assert.match(a.what, /resonator/); assert.ok(!/snorkel|breather|coolant/.test(a.what));
  assert.deepEqual(b.slotTargets, ["IAT connector", "Throttle-body clamp", "Air-box clamp", "Intake hose"]);
  assert.ok(b.manifestTargets.includes("Retaining grommet")); assert.ok(r.conflicts.every((c) => /NEEDS_ANDY/.test(c.status)));
});

test("RECONSTRUCTED TEST: Step 10 — event log + directory of the blocked run verify clean, and the recovered resolver integrates (shows nothing)", async () => {
  const dir = out(); const r = await runStep10Proving({ outDir: dir, clock: makeClock() });
  assert.deepEqual(verifyRun(path.join(dir, "step-10-intake-duct")).problems, []);
  assert.ok((allowNoResolver() ? ["PASS", "NOT_RUN"] : ["PASS"]).includes(byStage(r, "13").status), `stage 13 was ${byStage(r, "13").status}`);
});

test("RECONSTRUCTED TEST: Step 10 — deterministic repeated execution (identical report bytes)", async () => {
  const a = out(), b = out();
  await runStep10Proving({ outDir: a, clock: makeClock() }); await runStep10Proving({ outDir: b, clock: makeClock() });
  const strip = (d) => fs.readFileSync(path.join(d, "PROVING-RUN-REPORT.json"), "utf8");
  assert.equal(strip(a), strip(b));
  assert.equal(fs.readFileSync(path.join(a, "step-10-intake-duct/events.jsonl"), "utf8"), fs.readFileSync(path.join(b, "step-10-intake-duct/events.jsonl"), "utf8"));
});

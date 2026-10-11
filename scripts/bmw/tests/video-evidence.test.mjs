import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateVideoEvidence, DEFAULT_DIR } from "../video-evidence.mjs";

function tmpWith(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vid-"));
  for (const f of fs.readdirSync(DEFAULT_DIR)) fs.copyFileSync(path.join(DEFAULT_DIR, f), path.join(dir, f));
  const p = path.join(dir, "guide-01.json");
  const d = JSON.parse(fs.readFileSync(p, "utf8"));
  mutate(d);
  fs.writeFileSync(p, JSON.stringify(d));
  return dir;
}
const viewedBase = (v) => { v.basis = "chapter-title"; v.viewed = true; };

test("committed video evidence is valid", () => {
  const r = validateVideoEvidence();
  assert.deepEqual(r.errors, []);
  assert.equal(r.summary.length, 16);
});
test("title-only record cannot claim a config MATCH", () => {
  const r = validateVideoEvidence(tmpWith((d) => { d.videos[0].configMatch = { status: "MATCH", evidence: "x" }; }));
  assert.ok(r.errors.some((e) => /MATCH|viewed basis/.test(e)));
});
test("video cannot certify torque or safety", () => {
  const r = validateVideoEvidence(tmpWith((d) => { const v = d.videos[0]; viewedBase(v); v.observations = [{ kind: "torque", component: "caliper bolt", timestamp: "1:00" }]; }));
  assert.ok(r.errors.some((e) => /cannot certify torque/.test(e)));
});
test("observation with a number-and-unit figure is rejected", () => {
  const r = validateVideoEvidence(tmpWith((d) => { const v = d.videos[0]; viewedBase(v); v.observations = [{ kind: "action", component: "bolt at 35 Nm", timestamp: "1:00" }]; }));
  assert.ok(r.errors.some((e) => /torque\/capacity/.test(e)));
});
test("unviewed record cannot raise confidence or carry observations", () => {
  const r = validateVideoEvidence(tmpWith((d) => { d.videos[0].confidence = "high"; d.videos[0].observations = [{ kind: "component", component: "caliper", timestamp: "0:30" }]; }));
  assert.ok(r.errors.some((e) => /confidence/.test(e)));
  assert.ok(r.errors.some((e) => /without a viewed basis/.test(e)));
});
test("MATCH is refused when the title carries a conflicting engine signal", () => {
  const r = validateVideoEvidence(tmpWith((d) => { const v = d.videos[0]; viewedBase(v); v.titleConflictSignals = ["N54"]; v.configMatch = { status: "MATCH", evidence: "chapter says N52" }; }));
  assert.ok(r.errors.some((e) => /conflicting title signals/.test(e)));
});

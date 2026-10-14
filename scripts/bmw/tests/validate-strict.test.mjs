// Regression coverage for the strict evidence-claim rules in scripts/bmw/validate-evidence.mjs.
// Origin: the F-150 pilot mutation-probed the validator and found that (1) a VERIFIED / VERIFIED_SECONDARY part, tool, fluid or step
// with an empty sources array passed, (2) hardware named nut / pin / stud / clip / spring / hose was allowed to be cosmetic, and
// (3) VERIFIED passed while the ledger said no primary document was read. Each test below injects one fault into a scratch copy of a
// clean ledger and requires the validator to fail on exactly that.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { validateEvidence, strictFindings, findingKey, isHardwareId } from "../validate-evidence.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const BMW_DIR = path.join(ROOT, "docs/bmw-e90/evidence");
const clean = () => JSON.parse(fs.readFileSync(path.join(BMW_DIR, "guide-01.json"), "utf8"));

function scratch(mutate, baseline) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strict-"));
  const g = clean();
  mutate?.(g);
  fs.writeFileSync(path.join(dir, "guide-01.json"), JSON.stringify(g));
  if (baseline) fs.writeFileSync(path.join(dir, "STRICT-BASELINE.json"), JSON.stringify({ ceiling: baseline.length, findings: baseline }));
  return dir;
}
const run = (mutate, baseline) => validateEvidence(scratch(mutate, baseline), { expectedGuides: null });
const codes = (r) => r.errors.map((e) => /\[(\w+)\]/.exec(e)?.[1]).filter(Boolean);

test("control: the untouched ledger is clean under the strict rules", () => {
  const r = run();
  assert.deepEqual(r.errors, []);
});

test("REGRESSION: VERIFIED part with empty sources fails (was silently accepted)", () => {
  const r = run((g) => { g.parts[0].status = "VERIFIED"; g.parts[0].sources = []; g.primarySourceFound = true; });
  assert.ok(codes(r).includes("UNSOURCED_VERIFIED"), r.errors.join("\n"));
});

test("REGRESSION: VERIFIED step with empty sources fails; VERIFIED_SECONDARY tool with no sources fails", () => {
  const r = run((g) => { g.steps[0].status = "VERIFIED"; g.steps[0].sources = []; g.tools[0].status = "VERIFIED_SECONDARY"; g.tools[0].sources = []; g.primarySourceFound = true; });
  assert.ok(codes(r).filter((c) => c === "UNSOURCED_VERIFIED").length >= 2, r.errors.join("\n"));
});

test("REGRESSION: VERIFIED_SECONDARY on a single host fails", () => {
  const r = run((g) => { g.fluids[0].status = "VERIFIED_SECONDARY"; g.fluids[0].sources = ["https://a.example/x", "https://a.example/y"]; });
  assert.ok(codes(r).includes("SECONDARY_ONE_HOST"), r.errors.join("\n"));
});

test("REGRESSION: VERIFIED while primarySourceFound is false fails, and primary:true does too", () => {
  const r = run((g) => { g.primarySourceFound = false; g.parts[0].status = "VERIFIED"; g.parts[0].sources = ["https://a.example/x"]; g.tools[0].primary = true; });
  const c = codes(r);
  assert.ok(c.includes("VERIFIED_NO_PRIMARY") && c.includes("PRIMARY_FLAG_NO_PRIMARY"), r.errors.join("\n"));
});

test("REGRESSION: a torque tagged VERIFIED with no number in its value fails", () => {
  const r = run((g) => { g.torque.push({ fastener: "probe bolt", value: "snug", status: "VERIFIED", primary: true, sources: ["https://a.example/x", "https://b.example/y"] }); g.primarySourceFound = true; });
  assert.ok(codes(r).includes("TORQUE_NO_NUMBER"), r.errors.join("\n"));
});

test("REGRESSION: nuts, pins, studs, clips, springs, hoses, calipers, brackets, valves, caps and washers cannot be cosmetic", () => {
  for (const id of ["lug-nuts", "guide-pins", "wheel-stud", "retaining-clip", "return-spring", "brake-hose", "caliper-body", "caliper-bracket", "drain-valve", "filler-cap", "crush-washer", "drain-plug"]) {
    assert.ok(isHardwareId(id), id);
    const r = run((g) => { g.visuals[0].elements.push({ id, role: "context", criticality: "cosmetic", describe: "probe" }); });
    assert.ok(codes(r).includes("HARDWARE_COSMETIC"), `${id}: ${r.errors.join("\n")}`);
  }
});

test("hardware match is on whole id tokens: spinner, pinstripe and capacity are not hardware", () => {
  for (const id of ["spinner", "pinstripe", "capacity", "capture"]) assert.equal(isHardwareId(id), false, id);
});

test("baseline: a listed finding is reported as baselined, not as an error", () => {
  const mutate = (g) => { g.parts[0].status = "VERIFIED"; g.parts[0].sources = []; g.primarySourceFound = true; };
  const f = strictFindings((() => { const g = clean(); mutate(g); return g; })());
  assert.equal(f.length, 1);
  const r = run(mutate, [{ key: findingKey(f[0]), risk: "LOW", rationale: "probe entry long enough to count" }]);
  assert.deepEqual(r.errors, []);
  assert.equal(r.baselined.length, 1);
});

test("baseline may only shrink: a stale entry fails", () => {
  const r = run(undefined, [{ key: "1|UNSOURCED_VERIFIED|parts[0] gone", risk: "LOW", rationale: "stale entry long enough to count" }]);
  assert.ok(r.errors.some((e) => /no longer matches/.test(e)), r.errors.join("\n"));
});

test("a directory without a baseline file gets no exemptions (new vehicles start strict)", () => {
  const r = run((g) => { g.steps[0].status = "VERIFIED"; g.steps[0].sources = []; g.primarySourceFound = true; });
  assert.ok(r.errors.length > 0);
});

test("BMW set: passes only through the triaged baseline; every entry has a risk and rationale; none is HIGH", () => {
  const r = validateEvidence(BMW_DIR);
  assert.deepEqual(r.errors, []);
  const b = JSON.parse(fs.readFileSync(path.join(BMW_DIR, "STRICT-BASELINE.json"), "utf8")).findings;
  assert.equal(b.length, r.baselined.length);
  for (const e of b) {
    assert.ok(["LOW", "MEDIUM", "HIGH"].includes(e.risk) && e.rationale?.length > 20, e.key);
    assert.notEqual(e.risk, "HIGH", `${e.key}: a HIGH finding must be fixed, not baselined`);
  }
});

// ---- the BMW exceptions are frozen: visible, counted, and impossible to extend quietly ----
test("FROZEN: the BMW baseline is exactly these 33 triaged findings; adding an exception means editing this test in review", () => {
  const raw = JSON.parse(fs.readFileSync(path.join(BMW_DIR, "STRICT-BASELINE.json"), "utf8"));
  const keys = raw.findings.map((f) => f.key).sort();
  assert.equal(keys.length, 33);
  assert.equal(raw.ceiling, 33);
  assert.equal(crypto.createHash("sha256").update(keys.join("\n")).digest("hex"), "b476a12e727c8197b8cc6046520a4edefc55f4fc876048caa418b208dcb2eab0",
    "baseline key set changed: shrinking is allowed (update this hash and count in the same commit); growing is not");
});

test("baseline cannot grow: more entries than the ceiling, a duplicate, a HIGH entry, or a missing rationale each fail", () => {
  const mutate = (g) => { g.parts[0].status = "VERIFIED"; g.parts[0].sources = []; g.primarySourceFound = true; };
  const key = findingKey(strictFindings((() => { const g = clean(); mutate(g); return g; })())[0]);
  const withMeta = (findings, ceiling) => {
    const dir = scratch(mutate);
    fs.writeFileSync(path.join(dir, "STRICT-BASELINE.json"), JSON.stringify({ ceiling, findings }));
    return validateEvidence(dir, { expectedGuides: null }).errors.join("\n");
  };
  const ok = { key, risk: "LOW", rationale: "probe entry long enough to count" };
  assert.equal(withMeta([ok], 1), "");
  assert.match(withMeta([ok], 0), /may not grow/);
  assert.match(withMeta([ok, ok], 2), /duplicate/);
  assert.match(withMeta([{ ...ok, risk: "HIGH" }], 1), /HIGH must be fixed/);
  assert.match(withMeta([{ ...ok, rationale: "" }], 1), /needs key, risk/);
});

test("the CLI prints every baselined BMW finding so the exceptions stay visible", () => {
  const out = spawnSync(process.execPath, [path.join(ROOT, "scripts/bmw/validate-evidence.mjs")], { encoding: "utf8" }).stdout;
  assert.equal(out.split("\n").filter((l) => l.startsWith("BASELINED [")).length, 33);
  assert.match(out, /33 baselined/);
});

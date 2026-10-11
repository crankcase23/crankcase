// BMW 328i (E90) package tests: drafts, evidence rules, isolation from the customer catalog, Wrench Mode, image-pipeline honesty.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const esbuild = createRequire(path.join(ROOT, "package.json"))("esbuild");
const EVID = path.join(ROOT, "docs/bmw-e90/evidence");
const evidence = fs.readdirSync(EVID).filter((f) => /^guide-\d\d\.json$/.test(f)).sort().map((f) => JSON.parse(fs.readFileSync(path.join(EVID, f), "utf8")));

async function bundle(entry) {
  const out = await esbuild.build({ entryPoints: [path.join(ROOT, entry)], bundle: true, write: false, format: "esm", platform: "node", logLevel: "silent", alias: { "@": path.join(ROOT, "src") } });
  return import("data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64"));
}

test("all 16 guide categories have evidence files and an admin-only draft", async () => {
  assert.deepEqual(evidence.map((g) => g.guide), Array.from({ length: 16 }, (_, i) => i + 1));
  const { bmwDraftGuides } = await bundle("src/data/admin-test-guides/bmw-2010-328i-drafts.ts");
  assert.equal(bmwDraftGuides.length, 16);
  assert.equal(new Set(bmwDraftGuides.map((g) => g.slug)).size, 16);
  assert.equal(new Set(bmwDraftGuides.map((g) => g.guide.jobType)).size, 16);
  for (const { guide, vehicle } of bmwDraftGuides) {
    assert.equal(vehicle.id, "2010-bmw-328i-3.0l");
    assert.ok(guide.id.startsWith("admin-draft-"), guide.id);
    assert.match(guide.title, /DRAFT/);
    assert.match(guide.summary, /not published and not certified/);
    assert.ok(guide.steps.length >= 3 && guide.safety.length > 0 && guide.tools.length > 0, guide.id);
  }
});

test("generated drafts and evidence summary are not stale", () => {
  execFileSync("node", [path.join(ROOT, "scripts/bmw/build-drafts.mjs"), "--check"], { stdio: "pipe" });
});

test("a torque number is printed only when its evidence is VERIFIED; everything else shows the VERIFY warning", async () => {
  const { bmwDraftGuides } = await bundle("src/data/admin-test-guides/bmw-2010-328i-drafts.ts");
  const byNo = new Map(evidence.map((e) => [e.guide, e]));
  const drafts = bmwDraftGuides.map((x) => x.guide);
  assert.equal(drafts.length, byNo.size);
  let numeric = 0, warned = 0;
  for (const guide of drafts) {
    const ev = evidence.find((e) => guide.title.startsWith(e.name));
    assert.ok(ev, `no evidence for ${guide.title}`);
    assert.equal(guide.torqueSpecs.length, ev.torque.length, guide.id);
    guide.torqueSpecs.forEach((t, i) => {
      const src = ev.torque[i];
      const verified = /^\s*verified/i.test(src.status) && !/conflict/i.test(src.status);
      if (t.value.includes("VERIFY EXACT TORQUE")) { warned++; assert.ok(!verified || /missing/i.test(src.value ?? ""), `${guide.id}: verified torque hidden unexpectedly`); }
      else { numeric++; assert.ok(verified, `${guide.id}: ${t.fastener} printed a number without VERIFIED evidence`); assert.equal(t.value, src.value); }
    });
  }
  assert.ok(numeric > 0 && warned > 0, `numeric=${numeric} warned=${warned}`);
});

test("every step that is not VERIFIED carries a visible warning", async () => {
  const { bmwDraftGuides } = await bundle("src/data/admin-test-guides/bmw-2010-328i-drafts.ts");
  for (const { guide } of bmwDraftGuides) {
    const ev = evidence.find((e) => guide.title.startsWith(e.name));
    const offset = guide.steps.length - ev.steps.length; // 0 or 1 (the leading configuration step)
    assert.ok(offset === 0 || offset === 1);
    ev.steps.forEach((s, i) => {
      if (!/^\s*verified/i.test(s.status)) assert.ok(guide.steps[i + offset].warning, `${guide.id} step ${i + 1} (${s.status.slice(0, 20)}) has no warning`);
    });
  }
});

test("Wrench Mode builds a plan for every draft", async () => {
  const [{ bmwDraftGuides }, wrench] = await Promise.all([bundle("src/data/admin-test-guides/bmw-2010-328i-drafts.ts"), bundle("src/lib/wrenchSteps.ts")]);
  for (const { guide } of bmwDraftGuides) {
    const plan = wrench.buildWrenchPlan(guide);
    const n = plan.steps?.length ?? plan.phases?.reduce((a, p) => a + p.steps.length, 0);
    assert.ok(n >= 3, `${guide.id}: wrench plan has ${n} steps`);
  }
});

test("drafts are isolated from the customer catalog", () => {
  const allowed = (f) => f.startsWith("src/app/admin/") || f.startsWith("src/data/admin-test-guides/");
  const hits = [];
  (function walk(d) {
    for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
      const rel = path.posix.join(d, e.name);
      if (e.isDirectory()) walk(rel);
      else if (/\.(ts|tsx)$/.test(e.name) && /admin-test-guides/.test(fs.readFileSync(path.join(ROOT, rel), "utf8")) && !allowed(rel)) hits.push(rel);
    }
  })("src");
  assert.deepEqual(hits, [], "admin-test-guides imported outside /admin");
  for (const f of fs.readdirSync(path.join(ROOT, "src/data")).filter((x) => /^repairs.*\.ts$/.test(x))) {
    assert.ok(!/2010-bmw-328i/.test(fs.readFileSync(path.join(ROOT, "src/data", f), "utf8")), `${f} references the BMW vehicle: a guide would be live`);
  }
  const vehicles = fs.readFileSync(path.join(ROOT, "src/data/vehicles.ts"), "utf8");
  assert.ok(!/id:\s*"2010-bmw-328i-3\.0l"[\s\S]{0,400}keys:/.test(vehicles), "BMW record must not carry fitment keys");
});

test("pipeline: every cited source exists in the evidence pull, and 'established' needs 2+ independent hosts", async () => {
  const { buildEP } = await import(path.join(ROOT, "scripts/bmw/pipeline-oil-change.mjs"));
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/bmw-e90/image-evidence/visuals.json"), "utf8"));
  for (const v of cfg.visuals) {
    const ep = buildEP(v);
    for (const row of ep.ledger) {
      if (row.status !== "established") continue;
      const hosts = new Set(row.evidence.map((id) => new URL(ep.references.find((r) => r.id === id).sourceRef).hostname));
      assert.ok(hosts.size >= 2, `${v.visualId} ${row.element}/${row.attribute} established with <2 hosts`);
    }
  }
  assert.throws(() => buildEP({ ...cfg.visuals[0], facts: [{ element: "drain-plug", attribute: "existence", urls: ["https://example.invalid/made-up"] }] }), /unknown source/);
});

test("pipeline: drain-plug visual reaches the generation boundary; filter-cap is blocked on evidence; no image, nothing certified", async () => {
  const { runAll } = await import(path.join(ROOT, "scripts/bmw/pipeline-oil-change.mjs"));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bmw-pipe-"));
  const r = await runAll({ out: tmp });
  const by = Object.fromEntries(r.visuals.map((v) => [v.visualId, v]));
  assert.equal(by["oil-drain-plug-access"].phase, "GEN_REQUESTED");
  assert.equal(by["oil-filter-cap"].phase, "EP_INSUFFICIENT");
  assert.ok(by["oil-filter-cap"].stages.some((s) => /lacks established location/.test(s.detail)));
  assert.ok(by["oil-drain-plug-access"].stages.find((s) => s.stage.startsWith("5 ")).status === "BLOCKED");
  assert.ok(r.visuals.every((v) => v.certified === false && v.imageProduced === false) && r.certified === false);
  const files = [];
  (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) (e.isDirectory() ? walk(path.join(d, e.name)) : files.push(e.name)); })(tmp);
  assert.ok(!files.some((f) => /\.(png|jpe?g|webp|svg)$/i.test(f)), "no image may exist");
  // the committed run record matches a fresh run (deterministic)
  assert.equal(fs.readFileSync(path.join(tmp, "PIPELINE-REPORT.json"), "utf8"), fs.readFileSync(path.join(ROOT, "docs/bmw-e90/image-evidence/output/PIPELINE-REPORT.json"), "utf8"));
});

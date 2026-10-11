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

test("evidence ledgers pass the schema/consistency validator", async () => {
  const { validateEvidence } = await import(path.join(ROOT, "scripts/bmw/validate-evidence.mjs"));
  const r = validateEvidence(EVID);
  assert.deepEqual(r.errors, []);
});

test("a torque number is printed only when its evidence is VERIFIED or VERIFIED_SECONDARY; everything else shows the VERIFY warning", async () => {
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
      const verified = /^\s*verified/i.test(src.status) && !/conflict|missing/i.test(src.status);
      if (t.value.includes("VERIFY EXACT TORQUE")) { warned++; assert.ok(!verified || !/\d/.test(src.value ?? "") || /no torque|not found|missing/i.test(src.value ?? ""), `${guide.id}: verified torque hidden unexpectedly`); }
      else { numeric++; assert.ok(verified, `${guide.id}: ${t.fastener} printed a number without VERIFIED/VERIFIED_SECONDARY evidence`); assert.equal(t.value, src.value); }
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

test("pipeline: guide slugs match the draft table and every visual's cited URLs are catalogued", async () => {
  const pv = await import(path.join(ROOT, "scripts/bmw/pipeline-visuals.mjs"));
  const { bmwDraftGuides } = await bundle("src/data/admin-test-guides/bmw-2010-328i-drafts.ts");
  const slugs = new Set(bmwDraftGuides.map((g) => g.slug));
  for (const [n, s] of Object.entries(pv.GUIDE_SLUG)) assert.ok(slugs.has(`bmw-2010-328i-${s}`), `guide ${n} slug ${s} not in drafts`);
  const vs = pv.loadVisuals();
  assert.ok(vs.length >= 30);
  for (const v of vs) pv.buildEP(v); // throws on an uncatalogued URL
  const v0 = { ...vs[0], facts: [{ element: vs[0].elements[0].id, attribute: "existence", urls: ["https://example.invalid/made-up"] }] };
  assert.throws(() => pv.buildEP(v0), /unknown source/);
});

test("pipeline: the evidence rule (critical needs 2 hosts; others 2 hosts or 1 BMW-document/catalog source)", async () => {
  const { establishes } = await import(path.join(ROOT, "scripts/bmw/pipeline-visuals.mjs"));
  const src = { "https://a.com/1": { kind: "third-party-guide" }, "https://a.com/2": { kind: "third-party-guide" }, "https://b.com/1": { kind: "third-party-guide" }, "https://m.com/1": { kind: "oem-text" } };
  assert.equal(establishes(["https://a.com/1", "https://a.com/2"], src, "critical").ok, false, "same host twice is one host");
  assert.equal(establishes(["https://a.com/1", "https://b.com/1"], src, "critical").ok, true);
  assert.equal(establishes(["https://m.com/1"], src, "critical").ok, false, "critical needs 2 hosts even with a BMW document");
  assert.equal(establishes(["https://m.com/1"], src, "identification").ok, true);
  assert.equal(establishes(["https://a.com/1"], src, "procedure").ok, false);
  assert.equal(establishes([], src, "identification").ok, false);
});

test("pipeline: every visual is run; contract-locked ones stop at the generation boundary; nothing is imaged or certified; deterministic", async () => {
  const { runAll, loadVisuals } = await import(path.join(ROOT, "scripts/bmw/pipeline-visuals.mjs"));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bmw-pipe-"));
  const r = await runAll({ out: tmp });
  assert.equal(r.visuals.length, loadVisuals().length);
  assert.ok(r.summary.contractLocked > 0 && r.summary.evidenceInsufficient > 0);
  for (const v of r.visuals) {
    assert.ok(["GEN_REQUESTED", "EP_INSUFFICIENT"].includes(v.phase), `${v.visualId}: ${v.phase}`);
    assert.ok(!v.stages.some((s) => s.status === "FAIL"), `${v.visualId} has a FAIL stage: ${JSON.stringify(v.stages.filter((s) => s.status === "FAIL"))}`);
    if (v.phase === "GEN_REQUESTED") assert.equal(v.stages.find((s) => s.stage.startsWith("5 ")).status, "BLOCKED");
  }
  assert.ok(r.visuals.every((v) => v.certified === false && v.imageProduced === false) && r.certified === false);
  // insufficient visuals list their exact deficits (the work list)
  for (const v of r.visuals.filter((x) => x.phase === "EP_INSUFFICIENT")) assert.ok(r.gaps.some((g) => g.visualId === v.visualId && g.deficits.length), `${v.visualId} has no recorded deficits`);
  const files = [];
  (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.isDirectory()) walk(path.join(d, e.name)); else files.push(e.name); } })(tmp);
  assert.ok(!files.some((f) => /\.(png|jpe?g|webp|svg)$/i.test(f)), "no image may exist");
  // The committed report also records runs that already hold a real generated image (in-flight runs are preserved, never rebuilt),
  // so compare only the visuals that are still pure contract-locked/blocked; in-flight ones must be in a legal post-image phase and never certified.
  const committed = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/bmw-e90/image-evidence/output/PIPELINE-REPORT.json"), "utf8"));
  const inFlightIds = new Set(committed.visuals.filter((v) => v.imageProduced).map((v) => v.visualId));
  for (const v of committed.visuals.filter((x) => inFlightIds.has(x.visualId))) {
    assert.ok(["GEN_ACCEPTED", "QA_PASSED", "NORMALIZED", "OVERLAY_PASSED", "NEEDS_ANDY"].includes(v.phase), `in-flight ${v.visualId} in unexpected phase ${v.phase}`);
    assert.equal(v.certified, false, `${v.visualId} must not be recorded as certified before owner sign-off`);
  }
  const sortKeys = (_k, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v);
  const strip = (rep) => JSON.stringify({ visuals: rep.visuals.filter((v) => !inFlightIds.has(v.visualId)), gaps: rep.gaps.filter((g) => !inFlightIds.has(g.visualId)), standard: rep.visualStandard }, sortKeys);
  assert.equal(strip(r), strip(committed), "committed run record is stale: run npm run bmw:pipeline");
});

test("PCV guide stays inspection/diagnosis only: no valve-cover job, no torque, no standalone valve replacement", async () => {
  const fs = await import("node:fs");
  const g = JSON.parse(fs.readFileSync(new URL("../../../docs/bmw-e90/evidence/guide-11.json", import.meta.url), "utf8"));
  assert.match(g.name, /Inspection/);
  assert.deepEqual(g.torque, [], "nothing in this guide tightens a torqued fastener");
  const text = g.steps.map((s) => `${s.title} ${s.instruction}`).join(" ");
  assert.ok(!/ADVANCED|remove the Valvetronic motor and the cover|tighten in a centre/i.test(text));
  assert.match(g.steps.at(-1).title, /does not cover/i);
  assert.ok(g.parts.every((p) => !/gasket|fastener|sleeve|seal|kit|Febi|URO/i.test(p.item)));
});

test("withdrawn visuals are not proposed and carry a reason", async () => {
  const fs = await import("node:fs");
  for (const [n, id] of [[2, "headlight-halo-cap-engine-bay"], [3, "comfort-access-key-opening"]]) {
    const g = JSON.parse(fs.readFileSync(new URL(`../../../docs/bmw-e90/evidence/guide-${String(n).padStart(2, "0")}.json`, import.meta.url), "utf8"));
    assert.ok(!g.visuals.some((v) => v.id === id), `${id} still proposed`);
    assert.ok(g.withdrawnVisuals.some((v) => v.id === id && v.reason.length > 20));
  }
});

test("visual standard CG-VS-1.0: every visual has a type, prompts follow the type rules, overlay is editable vector and never invents positions", async () => {
  const { runAll, loadVisuals, buildPrompt } = await import(path.join(ROOT, "scripts/bmw/pipeline-visuals.mjs"));
  const { renderOverlaySvg, overlaySpec, TYPES, STANDARD } = await import(path.join(ROOT, "scripts/bmw/visual-standard.mjs"));
  const vs = loadVisuals();
  assert.ok(vs.every((v) => TYPES[v.imageType]), "every visual has LOCATE/IDENTIFY/DO");
  const by = Object.fromEntries(vs.map((v) => [v.id, v]));
  const loc = buildPrompt(by["oil-drain-hatch-locate"]), idn = buildPrompt(by["oil-drain-plug-identify"]), doo = buildPrompt(by["oil-drain-plug-loosen"]);
  for (const p of [loc, idn, doo]) {
    assert.match(p, /light neutral studio background/);
    assert.ok(!/dark graphite/i.test(p), "old dark style gone");
    assert.match(p, /highlight outlines, banners/, "no baked highlights or banners");
    assert.match(p, /top 3%-17% of the height/);
  }
  assert.match(loc, /wrench or socket/, "LOCATE excludes tools");
  assert.match(idn, /wrench or socket/, "IDENTIFY excludes tools");
  assert.ok(!/wrench or socket/.test(doo) && /17 mm socket/.test(doo), "DO shows its listed tool only");
  assert.match(idn, /Do NOT depict its orientation/);
  assert.ok(!/rectangular/.test(loc), "hatch shape is not asserted");
  // overlay: empty regions draw nothing but the banner; regions render as editable vector
  const spec = overlaySpec(by["oil-drain-hatch-locate"], { stepNumber: 4 });
  assert.equal(spec.highlights[0].region, null);
  const empty = renderOverlaySvg(spec);
  assert.ok(!/class="highlight"/.test(empty) && /LOCATE/.test(empty) && /<text/.test(empty));
  spec.highlights[0].region = [0.4, 0.4, 0.2, 0.2]; spec.highlights[0].arrowFrom = [0.8, 0.3]; spec.highlights[0].label = "HATCH";
  const full = renderOverlaySvg(spec);
  assert.match(full, /class="highlight" data-element="access-hatch"/);
  assert.ok(full.includes(STANDARD.palette.orange) && !/<image/.test(full), "vector only, orange from the standard");
  // pipeline writes the stamp and an overlay spec per locked contract
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "bmw-vs-"));
  const r = await runAll({ out, only: ["oil-drain-plug-loosen"] });
  assert.equal(r.visualStandard.id, "CG-VS-1.0");
  assert.ok(fs.existsSync(path.join(out, "oil-drain-plug-loosen", "overlay.spec.json")));
});

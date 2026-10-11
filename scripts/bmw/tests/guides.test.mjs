// REGRESSIONS for the owner-facing BMW guide package (priority: working guides). Each test names the real defect it guards.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const esbuild = createRequire(path.join(ROOT, "package.json"))("esbuild");
const EVID = path.join(ROOT, "docs/bmw-e90/evidence");
const evidence = fs.readdirSync(EVID).filter((f) => /^guide-\d\d\.json$/.test(f)).sort().map((f) => JSON.parse(fs.readFileSync(path.join(EVID, f), "utf8")));
async function bundle(entry) {
  const out = await esbuild.build({ entryPoints: [path.join(ROOT, entry)], bundle: true, write: false, format: "esm", platform: "node", logLevel: "silent", alias: { "@": path.join(ROOT, "src") } });
  return import("data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64"));
}
const { bmwDraftGuides } = await bundle("src/data/admin-test-guides/bmw-2010-328i-drafts.ts");
const BLOCK = "⛔ BLOCKED — ";
const bySlug = (s) => bmwDraftGuides.find((g) => g.slug === `bmw-2010-328i-${s}`).guide;
const everyString = (guide) => [guide.title, guide.summary, ...guide.safety, ...guide.parts, ...guide.tools.map((t) => t.name + (t.note ?? "")), ...guide.torqueSpecs.map((t) => `${t.fastener} ${t.value} ${t.notes ?? ""}`), ...guide.steps.flatMap((s) => [s.title, s.instructions, s.warning ?? ""])];

test("REGRESSION phone overflow: no raw URL reaches any customer-facing text (an unbroken URL ran off the phone screen on step 1)", () => {
  for (const { guide } of bmwDraftGuides) for (const t of everyString(guide)) assert.ok(!/https?:\/\//i.test(t), `${guide.id}: raw URL in "${t.slice(0, 80)}"`);
});

test("REGRESSION step 1 readability: the configuration step is a checklist of short sentences, not a pipe-joined wall of text", () => {
  for (const { guide } of bmwDraftGuides) {
    const s1 = guide.steps[0];
    if (!/^Confirm your car's configuration/.test(s1.title)) continue;
    assert.ok(!/ \| /.test(s1.instructions), `${guide.id}: pipe-joined step 1`);
    const sentences = s1.instructions.split(/(?<=[.!?])\s+(?=[A-Z⚠])/);
    assert.ok(sentences.length >= 3, `${guide.id}: step 1 does not split into sentences`);
  }
});

test("every ledger step that is CONFLICT or MISSING has a recorded decision (BLOCKED / INAPPLICABLE / ACCEPTED); the builder refuses an undecided one", () => {
  const src = fs.readFileSync(path.join(ROOT, "scripts/bmw/build-drafts.mjs"), "utf8");
  assert.match(src, /has no DISPOSITION/);
  const norm = (s) => (/conflict/i.test(s) ? "conflict" : /missing/i.test(String(s)) ? "missing" : "other");
  for (const g of evidence) for (const s of g.steps) if (norm(s.status) !== "other") {
    const covered = /^\s*\{ g: (\d+), re: \/(.+?)\/i, kind: "(BLOCKED|INAPPLICABLE|ACCEPTED)"/gm;
    let m, ok = false;
    while ((m = covered.exec(src))) if (+m[1] === g.guide && new RegExp(m[2].replace(/\\\//g, "/"), "i").test(s.title)) ok = true;
    assert.ok(ok, `guide ${g.guide} step "${s.title}" (${s.status}) has no disposition`);
  }
});

test("BLOCKED steps: unresolved safety-critical procedures are not shown; the reader gets the reason and a safe alternative", () => {
  const idler = bySlug("serpentine-belt").steps.find((s) => s.title.startsWith(BLOCK));
  assert.match(idler.title, /idler pulley/i);
  assert.match(idler.instructions, /Skip this step/);
  assert.ok(!/16 mm|deep-socket|hand to avoid cross/i.test(idler.instructions), "idler removal procedure must not be shown while its torque is unresolved");
  assert.ok(!bySlug("serpentine-belt").torqueSpecs.some((t) => /idler/i.test(t.fastener) && /\d+\s*Nm/.test(t.value)), "no idler torque number may be published");
  const fuse = bySlug("fuse-bulb").steps.filter((s) => s.title.startsWith(BLOCK));
  assert.equal(fuse.length, 2);
  for (const s of fuse) assert.match(s.warning, /BLOCKED/);
  const xenon = fuse.find((s) => /xenon/i.test(s.title));
  assert.ok(!/T20|retaining clips|wheel and fender liner/i.test(xenon.instructions), "xenon DIY procedure must not be shown: BMW says workshop only");
  assert.match(xenon.instructions, /BMW center or qualified workshop/);
});

test("INAPPLICABLE: xDrive-only transfer case / front differential is not a walkthrough step on a rear-wheel-drive car, and the summary says so", () => {
  const g = bySlug("differential-fluid");
  assert.ok(!g.steps.some((s) => /xDrive/i.test(s.title)), "xDrive step still in the walkthrough");
  assert.match(g.summary, /not applicable/i);
  assert.match(g.summary, /transfer case/i);
  assert.equal(g.steps.length, 8, "configuration step + 7 procedure steps");
});

test("the blocked count in each summary matches the blocked steps (so Planning Mode and Wrench Mode agree)", () => {
  for (const { guide } of bmwDraftGuides) {
    const n = guide.steps.filter((s) => s.title.startsWith(BLOCK)).length;
    if (n) assert.match(guide.summary, new RegExp(`Blocked steps \\(unresolved safety-critical\\): ${n}\\.`), guide.id);
    else assert.ok(!/Blocked steps/.test(guide.summary), guide.id);
  }
});

test("all 16 categories: vehicle applicability is the VIN-decoded 2010 BMW 328i and every guide is complete enough to walk", () => {
  assert.equal(bmwDraftGuides.length, 16);
  for (const { guide, vehicle } of bmwDraftGuides) {
    assert.equal(vehicle.year, 2010); assert.equal(vehicle.make, "BMW"); assert.match(vehicle.model, /328i/);
    assert.equal(guide.vehicleId, vehicle.id);
    assert.ok(guide.estTime && guide.difficulty, `${guide.id}: missing time/difficulty`);
    assert.ok(guide.tools.length > 0 && guide.parts.length > 0 && guide.safety.length > 0, `${guide.id}: tools/parts/safety missing`);
    guide.steps.forEach((s, i) => { assert.equal(s.number, i + 1, `${guide.id}: step numbering`); assert.ok(s.title.trim() && s.instructions.trim(), `${guide.id} step ${i + 1} empty`); });
    // every torque row either prints a number or the house VERIFY warning; none is blank
    for (const t of guide.torqueSpecs) assert.ok(/\d/.test(t.value) || /VERIFY EXACT TORQUE/.test(t.value), `${guide.id}: blank torque ${t.fastener}`);
  }
});

test("images never gate rendering: no BMW draft step carries an image path, and no BMW visual set is registered for display", () => {
  for (const { guide } of bmwDraftGuides) for (const s of guide.steps) assert.ok(!s.image, `${guide.id} step ${s.number} has an image dependency`);
  const reg = fs.readFileSync(path.join(ROOT, "src/lib/guideVisuals.ts"), "utf8");
  assert.ok(!/bmw/i.test(reg.split("\n").find((l) => l.includes("const REGISTRY")) ?? ""), "REGISTRY (hash-locked) must not be edited to enable the hatch image");
});

test("a CONFLICT torque never leaks either candidate number into the guide", () => {
  const row = bySlug("serpentine-belt").torqueSpecs.find((t) => /idler/i.test(t.fastener));
  assert.match(row.value, /VERIFY EXACT TORQUE/);
  assert.ok(!/\d+\s*(Nm|lb)/i.test(row.notes), `idler notes leak a figure: ${row.notes}`);
  assert.match(row.notes, /conflict/i);
});

test("navigation: the admin catalog resolves every BMW slug and nothing else; an unknown slug resolves to nothing (route then 404s)", async () => {
  const { findAdminTestGuide, listAdminTestGuides } = await bundle("src/data/admin-test-guides/index.ts");
  for (const { slug } of bmwDraftGuides) assert.equal(findAdminTestGuide(slug)?.slug, slug);
  assert.equal(findAdminTestGuide("bmw-2010-328i-nope"), undefined);
  assert.equal(findAdminTestGuide(""), undefined);
  assert.equal(listAdminTestGuides().filter((g) => g.vehicle.id === "2010-bmw-328i-3.0l").length, 16);
  const route = fs.readFileSync(path.join(ROOT, "src/app/admin/guides/test/[slug]/page.tsx"), "utf8");
  assert.match(route, /if \(!entry\) notFound\(\)/);
  assert.match(route, /requireAdmin\("guides\.view"\)/);
});

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

test("REGRESSION step 1 readability: the configuration checklist is a few short 'Before you start' steps, not one pipe-joined wall of text", () => {
  for (const { guide } of bmwDraftGuides) {
    const cfg = guide.steps.filter((s) => /^Before you start: check your car's build \(\d+ of \d+\)$/.test(s.title));
    assert.ok(cfg.length >= 1, `${guide.id}: no configuration steps`);
    assert.deepEqual(guide.steps.slice(0, cfg.length).map((s) => s.title), cfg.map((s) => s.title), "configuration steps come first");
    cfg.forEach((s, i) => {
      assert.ok(!/ \| /.test(s.instructions), `${guide.id}: pipe-joined configuration text`);
      assert.ok(s.instructions.length <= 1800, `${guide.id} config step ${i + 1} is ${s.instructions.length} chars`);
      assert.equal(!!s.warning, i === 0, "the build-not-confirmed warning sits on the first configuration step");
    });
  }
});

test("wording: no internal evidence terminology reaches customer-facing text, and uncertainty is still visible", () => {
  const banned = [/\[(verified|secondary|single|conflict|missing)\]/, /BUILDABLE/, /VERIFIED_SECONDARY/, /\.md\b/, /\bledger\b/i, /evidence summary/i, /variantDependencies/, /SECONDARY SOURCES ONLY/, /\bETK\b/, /\bTIS\b/, /\bCONFLICT\b/];
  for (const { guide } of bmwDraftGuides) for (const t of everyString(guide)) for (const re of banned) assert.ok(!re.test(t), `${guide.id}: internal term ${re} in "${t.slice(0, 90)}"`);
  // ...but nothing was concealed: unconfirmed items still say so
  const all = bmwDraftGuides.flatMap(({ guide }) => everyString(guide)).join("\n");
  for (const phrase of ["sources disagree", "one source only", "not confirmed", "independent websites", "VERIFY EXACT TORQUE", "Confirm before relying"]) assert.ok(all.includes(phrase), `uncertainty wording lost: ${phrase}`);
});

test("long steps are broken up: no non-blocked step is over 900 characters unless it is a single long sentence", () => {
  const sentences = (t) => t.split(/(?<=[.!?])\s+(?=[A-Z⚠])/);
  for (const { guide } of bmwDraftGuides) for (const s of guide.steps) {
    if (s.instructions.length > 900) assert.ok(sentences(s.instructions).length < 2, `${guide.id} step ${s.number} is ${s.instructions.length} chars in ${sentences(s.instructions).length} sentences`);
  }
  const split = bmwDraftGuides.flatMap(({ guide }) => guide.steps).filter((s) => / \(part \d of 2\)$/.test(s.title));
  assert.ok(split.length >= 10, "expected the long steps to have been split");
  for (const s of split) assert.ok(s.instructions.length <= 700, `split part still long: ${s.title}`);
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
  assert.equal(g.steps.filter((s) => !/^Before you start/.test(s.title)).length, 7, "7 procedure steps (xDrive step removed)");
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
    for (const t of guide.torqueSpecs) assert.ok(/\d/.test(t.value) || /VERIFY EXACT TORQUE|^Not a torque value: /.test(t.value), `${guide.id}: blank torque ${t.fastener}`);
  }
});

test("images never gate rendering: no BMW draft step carries an image path, and no BMW visual set is registered for display", () => {
  for (const { guide } of bmwDraftGuides) for (const s of guide.steps) assert.ok(!s.image, `${guide.id} step ${s.number} has an image dependency`);
  const reg = fs.readFileSync(path.join(ROOT, "src/lib/guideVisuals.ts"), "utf8");
  assert.ok(!/bmw/i.test(reg.split("\n").find((l) => l.includes("const REGISTRY")) ?? ""), "REGISTRY (hash-locked) must not be edited to enable the hatch image");
});

test("rows that are not torque figures say so, and real unknown torques keep the VERIFY warning", () => {
  const rows = bmwDraftGuides.flatMap(({ guide }) => guide.torqueSpecs.map((t) => ({ g: guide.id, ...t })));
  const nt = rows.filter((t) => t.value.startsWith("Not a torque value: "));
  assert.equal(nt.length, 7, "expected exactly the 7 reviewed non-torque rows");
  for (const t of nt) assert.ok(!/\d/.test(t.value), `${t.g}: label carries a number`);
  // genuinely unknown, safety-relevant torques must still shout
  const must = [["serpentine-belt", /idler/i], ["rear-brake-pads", /caliper guide/i], ["battery", /terminal/i], ["differential-fluid", /differential plug/i]];
  for (const [slug, re] of must) {
    const guide = bySlug(slug);
    const hit = guide.torqueSpecs.filter((t) => re.test(t.fastener) && !/xDrive/i.test(t.fastener));
    assert.ok(hit.length, `${slug}: row ${re} missing`);
    for (const t of hit) if (!/\d+\s*Nm/.test(t.value)) assert.match(t.value, /VERIFY EXACT TORQUE/, `${slug}: ${t.fastener} lost its warning`);
  }
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

test("GUARD for later image work: the staged hatch picture may only be registered if its step number is the hatch step (it is keyed to step 4 today; the hatch step moved)", () => {
  const staged = JSON.parse(fs.readFileSync(path.join(ROOT, "src/data/guide-visuals/bmw-2010-328i-oil-change.visuals.json"), "utf8"));
  const hatch = bySlug("oil-change").steps.find((s) => /undertray access hatch/i.test(s.title));
  const registered = /const REGISTRY[^\n]*bmw/i.test(fs.readFileSync(path.join(ROOT, "src/lib/guideVisuals.ts"), "utf8"));
  for (const v of staged.visuals) if (/hatch/i.test(v.id)) {
    if (registered) assert.equal(v.step, hatch.number, `hatch picture is keyed to step ${v.step} but the hatch step is ${hatch.number}`);
    else assert.ok(true); // not registered: nothing can display it. Remap v.step to ${hatch.number} BEFORE wiring.
  }
  assert.ok(hatch, "hatch step exists");
});

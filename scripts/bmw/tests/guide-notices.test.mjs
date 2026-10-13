// Regression for the BMW polish pass: the warning cleanup must be a pure re-presentation. Every original warning, safety line and
// evidence sentence stays reachable; BLOCKED steps stay fully enforced; only the fixed source-limit boilerplate moves out of the red boxes.
// Plus the 2010 BMW 328i garage thumbnail (same file convention as the Jeep and Ford cards).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const require = createRequire(path.join(ROOT, "package.json"));
const esbuild = require("esbuild");
async function bundle(entry) {
  const out = await esbuild.build({ entryPoints: [path.join(ROOT, entry)], bundle: true, write: false, format: "esm", platform: "node", logLevel: "silent", alias: { "@": path.join(ROOT, "src") } });
  return import("data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64"));
}
const { bmwE90Guides } = await bundle("src/data/repairs-bmw-e90.ts");
const N = await bundle("src/lib/guideNotices.ts");
const words = (s) => String(s ?? "").split(/\s+/).filter(Boolean).sort();
const same = (original, parts) => assert.deepEqual(words(parts.join(" ")), words(original));
const BOILERPLATE = [/Based on independent websites, not a BMW document/, /Only one source supports this step/, /Sources disagree on this step/, /No source confirms this step/, /Check each item against your car/];

test("all 16 BMW guides use the consolidated presentation", () => {
  assert.equal(bmwE90Guides.length, 16);
  for (const g of bmwE90Guides) assert.equal(N.usesEvidenceNotices(g), true, g.id);
});

test("NO LOSS: every step warning is rebuilt exactly from its body plus its evidence sentences", () => {
  let checked = 0;
  for (const g of bmwE90Guides) for (const s of g.steps) {
    if (!s.warning) continue;
    const n = N.classifyStepWarning(s.warning);
    same(s.warning, [n.text, ...n.flags]);
    checked++;
  }
  assert.ok(checked > 150, `checked ${checked} warnings`);
});

test("NO LOSS: safety lines, the guide disclaimer and the safety evidence rebuild the original safety list", () => {
  for (const g of bmwE90Guides) {
    const n = N.buildGuideNotices(g);
    assert.ok(n.disclaimer, `${g.id} keeps its not-yet-verified disclaimer`);
    same(g.safety.join(" "), [n.disclaimer, ...n.safety, ...n.safetyEvidence.flatMap((e) => e.flags)]);
  }
});

test("NO LOSS: every step's evidence sentence is listed in the Evidence & Sources data, with its step number", () => {
  for (const g of bmwE90Guides) {
    const n = N.buildGuideNotices(g);
    for (const s of g.steps) {
      const flags = N.splitEvidence(s.warning).flags;
      if (!flags.length) continue;
      const hit = n.stepEvidence.find((e) => e.number === s.number);
      assert.ok(hit, `${g.id} step ${s.number}`);
      assert.deepEqual(hit.flags, flags);
    }
  }
});

test("BLOCKED steps stay fully enforced: same step, whole warning text unchanged, shown as the blocked (red alert) kind", () => {
  let blocked = 0;
  for (const g of bmwE90Guides) {
    const titles = g.steps.filter((s) => s.title.startsWith("⛔ BLOCKED — "));
    for (const s of titles) {
      const n = N.classifyStepWarning(s.warning);
      assert.equal(n.kind, "blocked", `${g.id} step ${s.number}`);
      assert.equal(n.text, s.warning);
      assert.deepEqual(n.flags, []);
      blocked++;
    }
    if (titles.length) assert.ok(N.buildGuideNotices(g).safety.some((l) => /BLOCKED in this guide/.test(l)), `${g.id} still announces its blocked steps in the safety notes`);
  }
  assert.equal(blocked, 6);
});

test("the red warning boxes no longer carry source-limit boilerplate, and real hazards stay red", () => {
  let red = 0, before = 0;
  for (const g of bmwE90Guides) for (const s of g.steps) {
    if (s.warning) before++;
    const n = N.classifyStepWarning(s.warning);
    if (n.kind === "caution" || n.kind === "blocked") red++;
    for (const re of BOILERPLATE) assert.doesNotMatch(n.text, re);
  }
  assert.ok(red < before * 0.65, `red boxes ${red} of ${before} warnings`);
  const k = (t) => N.classifyStepWarning(t).kind;
  assert.equal(k("Never work under a car held only by a jack. ⚠ Based on independent websites, not a BMW document. Confirm against your owner's manual before relying on it."), "caution");
  assert.equal(k("Never let the caliper hang by the brake hose."), "caution");
  assert.equal(k("Support the wheel; it is heavy."), "caution");
  assert.equal(k("Hot coolant escapes under pressure and can cause burns."), "caution");
  assert.equal(k("⚠ Check each item against your car before buying parts."), null);
  assert.equal(k("Check reservoir level."), "note");
});

test("unverified torque and spec values are flagged VERIFY: every placeholder is, and so is every figure with no BMW document", () => {
  let verify = 0;
  for (const g of bmwE90Guides) for (const t of g.torqueSpecs) {
    if (/VERIFY/.test(t.value)) { assert.equal(N.isUnverifiedTorque(t), true, `${g.id} ${t.fastener}`); verify++; }
    if (/no BMW document was available/.test(t.notes ?? "")) assert.equal(N.isUnverifiedTorque(t), true);
  }
  assert.ok(verify > 10);
  assert.equal(N.isUnverifiedTorque({ value: "10 Nm", notes: "Confirmed from BMW documentation or agreeing sources." }), false);
});

test("a guide with none of this machinery (a normal verified guide) is untouched", () => {
  assert.equal(N.usesEvidenceNotices({ safety: ["Never work under a car held only by a jack."], steps: [{ number: 1, title: "x", instructions: "y", warning: "Hot." }] }), false);
});

// ---- thumbnail ----
const IMG = path.join(ROOT, "public/images/vehicles/2010-bmw-328i-3.0l.jpg");
test("thumbnail: the 2010 BMW 328i card image exists at the catalog-id path, is a real JPEG the size of the Jeep and Ford images", async () => {
  const buf = fs.readFileSync(IMG);
  assert.deepEqual([...buf.subarray(0, 3)], [0xff, 0xd8, 0xff]);
  const sharp = require("sharp");
  const m = await sharp(buf).metadata();
  assert.equal(m.format, "jpeg");
  assert.equal(m.width, 1448);
  assert.equal(m.height, 1086);
  assert.ok(buf.length < 400_000, `${buf.length} bytes`);
  const jeep = await sharp(path.join(ROOT, "public/images/vehicles/2014-jeep-grand-cherokee-3.6l.jpg")).metadata();
  assert.equal(`${m.width}x${m.height}`, `${jeep.width}x${jeep.height}`);
});
test("thumbnail: GarageVehicleCard and VehicleBackdrop resolve images by vehicle.id, and the BMW id is the one in the catalog", () => {
  const card = fs.readFileSync(path.join(ROOT, "src/components/app/GarageVehicleCard.tsx"), "utf8");
  const backdrop = fs.readFileSync(path.join(ROOT, "src/components/app/VehicleBackdrop.tsx"), "utf8");
  assert.match(card, /\/images\/vehicles\/\$\{vehicle\.id\}\.jpg/);
  assert.match(backdrop, /images", "vehicles"|images\/vehicles/);
  assert.match(fs.readFileSync(path.join(ROOT, "src/data/vehicles.ts"), "utf8"), /id: "2010-bmw-328i-3\.0l"/);
});

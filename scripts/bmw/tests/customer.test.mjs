// CUSTOMER catalog regressions for the 16 BMW guides now spread into src/data/repairs.ts.
// Rule under test: the public copy is the admin draft with NOTHING loosened (same steps, same torque rows, same blocked steps),
// plus clear "incomplete" labelling, and with the owner's own VIN removed.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const esbuild = createRequire(path.join(ROOT, "package.json"))("esbuild");
async function bundle(entry) {
  const out = await esbuild.build({ entryPoints: [path.join(ROOT, entry)], bundle: true, write: false, format: "esm", platform: "node", logLevel: "silent", alias: { "@": path.join(ROOT, "src") } });
  return import("data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64"));
}
const { bmwDraftGuides } = await bundle("src/data/admin-test-guides/bmw-2010-328i-drafts.ts");
const catalog = await bundle("src/data/repairs.ts");
const { validateGuide } = await bundle("src/lib/admin/guides.ts");
const VID = "2010-bmw-328i-3.0l";
const BLOCK = "⛔ BLOCKED — ";
const mine = catalog.getRepairsForVehicle(VID);
const draftOf = (g) => bmwDraftGuides.find((d) => g.id === `bmw-2010-328i-${d.slug.replace("bmw-2010-328i-", "")}`)?.guide;

test("access: the vehicle page resolves exactly the 16 BMW guides, one per job type, with public ids", () => {
  assert.equal(mine.length, 16);
  assert.equal(new Set(mine.map((g) => g.id)).size, 16);
  assert.equal(new Set(mine.map((g) => g.jobType)).size, 16, "one guide per job category");
  for (const g of mine) { assert.match(g.id, /^bmw-2010-328i-[a-z-]+$/); assert.ok(!/admin|draft/i.test(g.id + g.title), `${g.id}: admin/draft leaked into the public id or title`); }
  assert.equal(catalog.getRepairById("bmw-2010-328i-oil-change")?.vehicleId, VID);
  assert.equal(catalog.getRepairById("admin-draft-bmw-2010-328i-oil-change"), undefined, "admin ids are never public");
});

test("nothing is loosened: public steps, torque rows and blocked steps equal the admin drafts", () => {
  for (const g of mine) {
    const d = draftOf(g);
    assert.ok(d, `${g.id}: no matching draft`);
    assert.equal(g.steps.length, d.steps.length, `${g.id}: step count`);
    g.steps.forEach((s, i) => {
      assert.equal(s.title, d.steps[i].title, `${g.id} step ${i + 1} title`);
      assert.equal(s.warning, d.steps[i].warning, `${g.id} step ${i + 1} warning`);
      assert.equal(s.title.startsWith(BLOCK), d.steps[i].title.startsWith(BLOCK));
    });
    assert.deepEqual(g.torqueSpecs.map((t) => [t.fastener.replace(/this car/g, "this VIN"), t.value]), d.torqueSpecs.map((t) => [t.fastener, t.value]), `${g.id}: torque values must be identical to the drafts`);
  }
});

test("restrictions survive publication: the three blocked steps are blocked, and no blocked step carries a procedure", () => {
  const blocked = mine.flatMap((g) => g.steps.filter((s) => s.title.startsWith(BLOCK)).map((s) => `${g.jobType}:${s.title.replace(BLOCK, "")}`));
  assert.deepEqual(blocked.sort(), ["fuse-bulb:Engine-bay fuses", "fuse-bulb:Xenon low-beam bulb", "serpentine-belt:Replace the idler pulley"].sort());
  for (const g of mine) for (const s of g.steps.filter((x) => x.title.startsWith(BLOCK))) assert.match(s.instructions, /This step is blocked/);
  assert.ok(!mine.find((g) => g.jobType === "serpentine-belt").torqueSpecs.some((t) => /idler/i.test(t.fastener) && /\d+\s*Nm/.test(t.value)), "no idler torque may be published (40 vs 80 Nm unresolved)");
});

test("unverified torque is never shown as a number: every public torque value is a figure that exists in a verified ledger row, a not-a-torque label, or the VERIFY warning", () => {
  const ledgers = fs.readdirSync(path.join(ROOT, "docs/bmw-e90/evidence")).filter((f) => /^guide-\d\d\.json$/.test(f)).map((f) => JSON.parse(fs.readFileSync(path.join(ROOT, "docs/bmw-e90/evidence", f), "utf8")));
  for (const g of mine) {
    const led = ledgers.find((l) => g.title.startsWith(l.name));
    g.torqueSpecs.forEach((t, i) => {
      if (/^⚠ VERIFY EXACT TORQUE/.test(t.value) || /^Not a torque value: /.test(t.value)) return;
      const src = led.torque[i];
      assert.ok(/^\s*verified/i.test(src.status) && !/conflict|missing/i.test(src.status), `${g.id}: ${t.fastener} prints a number without verified evidence`);
    });
  }
});

test("incomplete guides are clearly identified: summary lead, first safety warning, and a blocked-steps warning where relevant", () => {
  for (const g of mine) {
    assert.match(g.summary, /^Incomplete guide: not yet verified against BMW service data\./, g.id);
    assert.match(g.safety[0], /not yet verified against BMW repair data/, g.id);
    const n = g.steps.filter((s) => s.title.startsWith(BLOCK)).length;
    if (n) assert.ok(g.safety.some((x) => /BLOCKED in this guide/.test(x)), `${g.id}: blocked steps without a blocked-steps warning`);
    assert.ok(!/Draft for owner testing|not published and not certified/i.test(g.summary), `${g.id}: owner-testing wording leaked`);
  }
});

test("privacy: the owner's own VIN and VIN-tail serial appear nowhere in the public BMW guides", () => {
  const text = fs.readFileSync(path.join(ROOT, "src/data/repairs-bmw-e90.ts"), "utf8");
  assert.ok(!/WBAPH7C58AA175760|A175760/.test(text));
  assert.ok(!/\b[A-HJ-NPR-Z0-9]{17}\b/.test(text), "no 17-character VIN-shaped token");
  assert.ok(!/https?:\/\//i.test(text), "no raw URLs");
});

test("the catalog validator finds no REQUIRED gap in any public BMW guide (so none is listed as 'incomplete' in the admin build queue for structure)", () => {
  for (const g of mine) assert.deepEqual(validateGuide(g).filter((i) => i.severity === "required"), [], g.id);
});

test("entitlement: tiers follow the Get the Keys model (oil change free, rest premium) but every BMW guide is a PREVIEW, so none is sellable", async () => {
  const { isSellable, isPreview, readable } = await bundle("src/lib/guideAccess.ts");
  assert.deepEqual(mine.filter((g) => g.tier === "free").map((g) => g.jobType), ["oil-change"]);
  assert.equal(mine.filter((g) => g.tier === "premium").length, 15);
  for (const g of mine) {
    assert.equal(g.preview, true, `${g.id}: not marked preview`);
    assert.equal(isPreview(g), true);
    assert.equal(isSellable(g), false, `${g.id}: an uncertified guide must never be sellable`);
    assert.equal(readable(g), true);
  }
});

test("guideAccess: only a premium guide that is not a preview is sellable; other vehicles' guides are unaffected", async () => {
  const { isSellable } = await bundle("src/lib/guideAccess.ts");
  assert.equal(isSellable({ tier: "premium" }), true);
  assert.equal(isSellable({ tier: "premium", preview: false }), true);
  assert.equal(isSellable({ tier: "premium", preview: true }), false);
  assert.equal(isSellable({ tier: "free" }), false);
  const others = catalog.resolvedRepairs.filter((r) => r.vehicleId !== VID);
  assert.ok(others.every((r) => r.preview === undefined && r.wrenchMode === undefined), "no other vehicle's guide may carry preview/wrenchMode");
  assert.ok(others.some((r) => isSellable(r)), "existing premium guides are still sellable");
});

test("customer Wrench Mode is opt-in: exactly the 16 BMW guides carry wrenchMode", () => {
  assert.ok(mine.every((g) => g.wrenchMode === true));
  assert.equal(catalog.resolvedRepairs.filter((r) => r.wrenchMode).length, 16);
});

test("other vehicles still resolve their guides and none of them received a BMW guide", () => {
  const others = catalog.resolvedRepairs.filter((r) => r.vehicleId !== VID);
  assert.ok(others.length > 100, "other vehicles still resolve their guides");
  assert.ok(others.every((r) => !r.id.startsWith("bmw-")));
});

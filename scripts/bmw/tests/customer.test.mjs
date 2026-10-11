// CUSTOMER catalog regressions for the 16 BMW guides now spread into src/data/repairs.ts.
// Rule under test: the public copy is the admin draft with NOTHING loosened (same steps, same torque rows, same blocked steps),
// plus clear "incomplete" labelling, and with the owner's own VIN removed.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { denied, OWNER_SPECIFIC, INTERNAL } from "../customer-deny.mjs";

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
const markers = (w) => String(w ?? "").split(/(?<=[.!?\]])\s+(?=[A-Z⚠⛔\[])/).filter((x) => /^[⚠⛔]/.test(x));
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
      // Warning wording may be cleaned of owner-specific text, but every caution marker (⚠ / ⛔ sentence) must survive exactly, and a warning must not appear or vanish.
      assert.equal(Boolean(s.warning), Boolean(d.steps[i].warning), `${g.id} step ${i + 1}: warning present in one copy only`);
      assert.deepEqual(markers(s.warning), markers(d.steps[i].warning), `${g.id} step ${i + 1}: a ⚠/⛔ caution was changed or lost`);
      if (s.title.startsWith(BLOCK)) assert.equal(s.instructions, d.steps[i].instructions, `${g.id} step ${i + 1}: a blocked step's text must not change`);
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

// ---------------------------------------------------------------------------------------------------------------------------------
// Owner-specific language, internal instructions and step references (the 2026-10-11 production smoke test found all three live).
// ---------------------------------------------------------------------------------------------------------------------------------
const textFields = (g) => [
  ["summary", g.summary],
  ...g.safety.map((x, i) => [`safety ${i + 1}`, x]),
  ...g.tools.flatMap((t, i) => [[`tool ${i + 1}`, t.name], [`tool ${i + 1} note`, t.note ?? ""]]),
  ...g.parts.map((x, i) => [`part ${i + 1}`, x]),
  ...g.torqueSpecs.flatMap((t, i) => [[`torque ${i + 1}`, t.fastener], [`torque ${i + 1} value`, t.value], [`torque ${i + 1} notes`, t.notes]]),
  ...g.steps.flatMap((s) => [[`step ${s.number} title`, s.title], [`step ${s.number}`, s.instructions], [`step ${s.number} warning`, s.warning ?? ""]]),
];

test("customer text has no owner-specific language: no VIN decode results, owner-stated details, decoder runs or build month of the researched car", () => {
  for (const g of mine) for (const [f, t] of textFields(g)) {
    const hits = denied(t).filter((h) => OWNER_SPECIFIC.some((r) => r.name === h.rule));
    assert.deepEqual(hits, [], `${g.id} ${f}: owner-specific text "${hits[0]?.match}" in: ${t.slice(0, 160)}`);
  }
});

test("customer text has no internal research or build instructions (publish notes, ledger jargon, internal guide numbers)", () => {
  for (const g of mine) for (const [f, t] of textFields(g)) {
    const hits = denied(t).filter((h) => INTERNAL.some((r) => r.name === h.rule));
    assert.deepEqual(hits, [], `${g.id} ${f}: internal text "${hits[0]?.match}" in: ${t.slice(0, 160)}`);
  }
});

test("the deny list itself works: it flags the real defects found in production and leaves ordinary generic wording alone", () => {
  const bad = [
    "Drive: owner states rear-wheel drive (PH73 type code); xDrive not applicable.",
    "DECODED CONFIG: halogen headlights (no S522 xenon).",
    "[Decoded from the owner's VIN by one free decoder (bimmer.work option list) on 2026-10-10; Treat as probable.]",
    "This car is an automatic (owner-stated), so expect the extra fastener.",
    "The VIN decode shows no S322 option.",
    "Do not publish it as a BMW specification.",
    "Keep the pan a plain generic mass and keep orientation not established.",
    "Label stays UNRESOLVED as a name.",
    "see guide 16 (about 6.9 US qt total)",
    "The RealOEM VIN page does not state whether the 09/2009 production month is decoded from the VIN.",
    "Open vs limited-slip: RESOLVED to 'open, probable'.",
  ];
  for (const t of bad) assert.ok(denied(t).length > 0, `deny list missed: ${t}`);
  const fine = [
    "Find the fuse on the chart printed on the back of the glove-box fuse cover (BMW owner's manual p.236).",
    "Owner posts on xenon/adaptive cars reach the H8 from under the hood.",
    "Not an owner-serviceable item per BMW.",
    "Check which headlight type your car has: halogen or xenon (D1S).",
    "⚠ Your car's exact build is not confirmed from the VIN alone. Check every item in this section before buying parts.",
    "Compare the old pads and sensor with the new ones; a parts counter can confirm by VIN.",
    "Blade lengths for builds from 2009-09-01: driver 600 mm.",
    "see the Engine Oil & Filter Change guide",
  ];
  for (const t of fine) assert.deepEqual(denied(t), [], `deny list flagged ordinary text: ${t}`);
});

const STEP_REF = /\b[Ss]teps? (\d{1,2})(?:(?:\s*(?:to|-|–)\s*|\s+(?:and|or)\s+)(\d{1,2}))?/g;
const refsIn = (text) => [...String(text).matchAll(STEP_REF)].map((m) => [Number(m[1]), m[2] ? Number(m[2]) : null]);
const BEFORE = /^Before you start/;
function checkRefs(label, g) {
  const n = g.steps.length;
  for (const s of g.steps) for (const field of ["instructions", "warning"]) for (const [a, b] of refsIn(s[field])) {
    for (const t of [a, b].filter(Boolean)) {
      assert.ok(t >= 1 && t <= n, `${label} step ${s.number}: refers to step ${t}, but the guide has ${n} steps`);
      assert.ok(!BEFORE.test(g.steps[t - 1].title), `${label} step ${s.number}: refers to step ${t}, a "Before you start" check, which no ledger reference ever means`);
      assert.notEqual(t, s.number, `${label} step ${s.number}: refers to itself`);
    }
    if (b) assert.ok(b > a, `${label} step ${s.number}: range ${a}-${b} is backwards`);
  }
  for (const [f, t] of [...g.tools.map((x, i) => [`tool ${i + 1}`, x.name]), ...g.parts.map((x, i) => [`part ${i + 1}`, x]), ...g.safety.map((x, i) => [`safety ${i + 1}`, x])])
    for (const [a, b] of refsIn(t)) for (const x of [a, b].filter(Boolean)) assert.ok(x >= 1 && x <= n && !BEFORE.test(g.steps[x - 1].title), `${label} ${f}: bad step reference ${x}`);
}

test("every step reference in all 16 customer guides and all 16 admin drafts points at a step that exists (and is not a 'Before you start' check)", () => {
  for (const g of mine) checkRefs(g.id, g);
  for (const d of bmwDraftGuides) checkRefs(d.slug, d.guide);
});

test("step references point at the step they mean (the ones the smoke test found stale, and every other branch reference)", () => {
  const byJob = (job) => mine.find((g) => g.jobType === job);
  const sentence = (g, re) => { for (const s of g.steps) for (const x of [s.instructions, s.warning ?? ""].join(" ").split(/(?<=[.!?\]])\s+(?=[A-Z⚠⛔\[])/)) if (re.test(x)) return { s, x }; throw new Error(`${g.id}: no sentence matches ${re}`); };
  // every step number a sentence mentions, as the titles of the steps they point at
  const titles = (g, re) => refsIn(sentence(g, re).x).flat().filter(Boolean).map((n) => g.steps[n - 1].title);
  const fuse = byJob("fuse-bulb"), belt = byJob("serpentine-belt"), cool = byJob("coolant"), tire = byJob("tire-rotation");
  assert.match(titles(fuse, /^Halogen: go to step/)[0], /^Halogen H7/);
  assert.match(titles(fuse, /this guide blocks that step/)[0], /^⛔ BLOCKED — Xenon low-beam bulb/);
  assert.match(titles(fuse, /step \d+ note/)[0], /^Fog bulb H8/);
  assert.match(titles(belt, /re-inspect it at step/)[0], /^Inspect/);
  assert.match(titles(belt, /branch in step/)[0], /^Apply tension/);
  assert.match(titles(cool, /run the automatic venting routine \(step/)[0], /venting routine/i);
  assert.match(titles(cool, /run steps \d+-\d+ again/)[0], /venting routine/i);
  assert.match(titles(cool, /cap \(step \d+ method\)/)[0], /Release pressure and open/);
  const follow = titles(tire, /Then follow step/); assert.match(follow[0], /^SQUARE/); assert.match(follow[1], /^STAGGERED/);
  const chosen = titles(tire, /pattern chosen in step/); assert.match(chosen[0], /^SQUARE/); assert.match(chosen[1], /^STAGGERED/, "'step N or M' must re-point BOTH numbers");
});

test("a step reference that cannot be resolved removes its sentence instead of pointing at the wrong step (differential guide: the xDrive stop-sign remark)", () => {
  const diff = mine.find((g) => g.jobType === "driveline-fluid");
  assert.ok(!diff.steps.some((s) => /kept only as a stop sign/.test(s.instructions)));
});

test("guides refer to each other by name, never by internal number", () => {
  const fluid = mine.find((g) => g.jobType === "fluid-checks");
  const all = fluid.steps.map((s) => s.instructions).join(" ") + fluid.parts.join(" ");
  assert.match(all, /the Engine Oil & Filter Change guide/);
  assert.match(all, /the Cabin Air Filter guide/);
});

test("cleaning adds no numbers: every number in the customer text exists in the admin draft, apart from a short reviewed allowlist", () => {
  const num = (g) => new Set(textFields(g).flatMap(([, t]) => String(t).match(/\d+(?:[./]\d+)*/g) ?? []));
  const ALLOWED = new Set(["328", "2010", "03/2010", "09/2009", "09/2007"]); // build-date conditions: "a car built before 03/2010", "built from 09/2009", "a 2010 car"; all already in the guide text
  for (const g of mine) {
    const d = draftOf(g), before = num(d), added = [...num(g)].filter((x) => !before.has(x) && !ALLOWED.has(x));
    assert.deepEqual(added, [], `${g.id}: the customer copy contains numbers the admin draft does not: ${added.join(", ")}`);
  }
});

test("cleaning keeps every torque figure, blocked step and caution marker (spot-check of the numbers that matter)", () => {
  const belt = mine.find((g) => g.jobType === "serpentine-belt");
  assert.ok(belt.torqueSpecs.some((t) => /idler/i.test(t.fastener) && /VERIFY EXACT TORQUE/.test(t.value)));
  assert.ok(belt.steps.some((s) => s.title === `${BLOCK}Replace the idler pulley`));
  const fuse = mine.find((g) => g.jobType === "fuse-bulb");
  assert.deepEqual(fuse.steps.filter((s) => s.title.startsWith(BLOCK)).map((s) => s.title), [`${BLOCK}Engine-bay fuses`, `${BLOCK}Xenon low-beam bulb`]);
  const oil = mine.find((g) => g.jobType === "oil-change");
  assert.deepEqual(oil.torqueSpecs.map((t) => t.value), ["25 Nm (18 lb-ft); thread in by hand first", "25 Nm (18 lb-ft) with a new crush washer"]);
});

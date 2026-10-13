// REGRESSIONS from the 2010 BMW 328i certification audit (2026-10-12). Each test names the real defect it guards.
// These run against the CUSTOMER catalog (src/data/repairs-bmw-e90.ts, what a signed-in owner is shown) resolved through the real
// configuration resolver, as well as the admin drafts, so the two copies cannot drift apart again.
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const esbuild = createRequire(path.join(ROOT, "package.json"))("esbuild");
async function bundle(entry) {
  const out = await esbuild.build({ entryPoints: [path.join(ROOT, entry)], bundle: true, write: false, format: "esm", platform: "node", logLevel: "silent", alias: { "@": path.join(ROOT, "src") } });
  return import("data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64"));
}
const { bmwE90Guides } = await bundle("src/data/repairs-bmw-e90.ts");
const { bmwDraftGuides } = await bundle("src/data/admin-test-guides/bmw-2010-328i-drafts.ts");
const { resolveGuideForConfig } = await bundle("src/lib/guideConfig.ts");

const CONFIRMED = { transmission: "automatic", drivetrain: "rwd", confirmedAt: "2026-10-12T00:00:00Z" };
const customer = (job, cfg = CONFIRMED) => resolveGuideForConfig(bmwE90Guides.find((g) => g.jobType === job), cfg, "BMW");
const draft = (slug) => bmwDraftGuides.find((d) => d.slug === `bmw-2010-328i-${slug}`).guide;
const allText = (g) => [g.title, g.summary, ...g.safety, ...g.parts, ...g.tools.map((t) => t.name + " " + (t.note ?? "")), ...g.torqueSpecs.map((t) => `${t.fastener} ${t.value} ${t.notes ?? ""}`), ...g.steps.flatMap((s) => [s.title, s.instructions, s.warning ?? ""])].join("\n");
const BLOCK = "⛔ BLOCKED — ";

test("AUDIT-01 xenon leak: a guide that blocks xenon work (BMW: BMW center only) must not carry a xenon do-it-yourself route in its tools, parts or steps", () => {
  for (const g of [customer("fuse-bulb"), draft("fuse-bulb")]) {
    for (const t of g.tools) assert.ok(!/xenon|\bT20\b|\bT30\b|LUX|finned|cap tabs|angel-eye holder/i.test(t.name), `xenon/retrofit tool still listed: ${t.name}`);
    for (const p of g.parts) assert.ok(!/\bD1S\b|angel-eye\/halo bulb H8 35W \(xenon|cornering light bulb H3/i.test(p), `xenon/adaptive-only part still sold: ${p.slice(0, 80)}`);
    for (const s of g.steps) assert.ok(!/finned cap|unclipping the plastic panel|extra rubber washers/i.test(s.instructions), `xenon owner-post route in step "${s.title}"`);
    assert.ok(!/xenon or fog routes/i.test(g.safety.join(" ")), "safety note still names a xenon route");
    // the first step of each halogen-only job opens with the stop (a long step may be split in two; the stop leads the first half)
    for (const family of [/^Halogen H7/, /^Parking \/ halo/]) {
      const first = g.steps.find((s) => family.test(s.title));
      assert.ok(first, `expected a step for ${family}`);
      assert.match(first.instructions, /^Halogen headlights only: if your car has xenon or adaptive headlights, stop/, `step "${first.title}" is not gated to halogen cars`);
    }
  }
});

test("AUDIT-02 idler leak: with the idler replacement BLOCKED, no other tool, part or step may hand over that procedure", () => {
  for (const g of [customer("serpentine-belt"), draft("serpentine-belt")]) {
    const blocked = g.steps.filter((s) => s.title.startsWith(BLOCK));
    assert.equal(blocked.length, 1);
    assert.match(blocked[0].title, /idler/i);
    for (const t of g.tools) assert.ok(!/idler|deflection|\b16 mm\b/i.test(t.name), `idler tool still listed: ${t.name}`);
    for (const p of g.parts) assert.ok(!/11287535860|11287535867|11281435114|pulley protection caps|^Deflection \(idler\) pulley/i.test(p), `idler-only part still sold: ${p.slice(0, 80)}`);
    const insp = g.steps.find((s) => /^Inspect$/.test(s.title));
    assert.ok(insp, "inspect step exists");
    assert.ok(!/replace tensioner and idler/i.test(insp.instructions), "inspect step still tells the owner to replace the idler");
    assert.match(insp.instructions, /do not replace it from this guide/i);
    assert.ok(!g.torqueSpecs.some((t) => /idler/i.test(t.fastener) && /\d\s*Nm/i.test(t.value)), "an idler torque number appeared");
    for (const k of g.parts.filter((p) => /idler/i.test(p))) assert.match(k, /blocked in this guide/i, `kit that includes the idler is not labelled: ${k.slice(0, 80)}`);
  }
});

test("AUDIT-03 fitment: 13717556961 is the N54 (335i/135i/Z4 35i) air filter element and must not be offered for the N52 328i, in either copy", () => {
  for (const g of [customer("engine-air-filter"), draft("engine-air-filter")]) {
    assert.ok(!/13717556961/.test(allText(g)), "N54 element still listed");
    assert.match(g.parts.join("\n"), /13717542294/);
    const close = g.steps.find((s) => /^Close the airbox/.test(s.title));
    assert.ok(!/refit the six screws/i.test(close.instructions), "step still says six screws while sources say six or seven");
    assert.match(close.instructions, /every screw you removed/);
  }
});

test("AUDIT-04 front brakes: the rotor branch comes BEFORE the caliper is refitted (it needs the carrier off), and the retract step does not rely on pads already removed", () => {
  for (const g of [customer("brake-pads-front"), draft("front-brake-pads")]) {
    const at = (re) => { const i = g.steps.findIndex((s) => re.test(s.title)); assert.ok(i >= 0, `step ${re} missing`); return i; };
    const order = [/^Take the caliper off/, /^Remove the old pads/, /^Inspect and measure the rotor/, /^Optional branch: rotor replacement/, /^Clean and lubricate/, /^Retract the piston/, /^Fit the new pads/, /^Refit the caliper/, /^Refit the wheel/].map(at);
    assert.deepEqual(order, [...order].sort((a, b) => a - b), "front brake steps are out of order");
    const branch = g.steps[at(/^Optional branch: rotor replacement/)];
    assert.ok(!/continue from step \d+/i.test(branch.instructions), "branch still jumps back to a numbered step");
    assert.ok(!/parking brake/i.test(branch.instructions), "rear-axle parking-brake sentence is still in the FRONT job");
    const retract = g.steps[at(/^Retract the piston/)];
    assert.ok(!/clamp against the old inner pad,/.test(retract.instructions), "retract step still clamps against a pad that was already removed");
    assert.match(retract.instructions, /put back into the caliper as a spacer/);
  }
});

test("AUDIT-05 front wear sensor: the number depends on the build date (up to 03/2010 vs from 03/2010); no step may hard-code the older number as 'the' sensor", () => {
  for (const g of [customer("brake-pads-front"), draft("front-brake-pads")]) {
    const text = allText(g);
    assert.match(text, /34356789440/);
    assert.match(text, /34356792560/);
    for (const s of g.steps) {
      if (/34356789440/.test(s.instructions)) assert.match(s.instructions, /34356792560|03\/2010/, `step "${s.title}" names the older sensor without the build-date split`);
    }
    const fit = g.steps.find((s) => /^Fit the new pads and sensor/.test(s.title));
    assert.ok(!/34356789440/.test(fit.instructions), "fit step still hard-codes the older sensor number");
    assert.match(fit.instructions, /number for your build date/);
  }
});

test("AUDIT-06 oxygen sensor codes: P0031/P0037/P0051/P0057 are four different sensors, never 'typical bank 2 sensor 1' codes", () => {
  for (const g of [customer("o2-sensor"), draft("oxygen-sensor")]) {
    const s = g.steps.find((x) => /^Confirm which sensor is faulty/.test(x.title));
    assert.ok(!/typical bank 2 sensor 1/i.test(s.instructions), "codes still mislabelled as bank 2 sensor 1");
    for (const code of ["P0031", "P0037", "P0051", "P0057"]) assert.match(s.instructions, new RegExp(code));
    assert.match(s.instructions, /bank 1 sensor 1, bank 1 sensor 2, bank 2 sensor 1 and bank 2 sensor 2/);
    assert.match(s.instructions, /use the bank and sensor your scan tool reports/i);
  }
});

test("AUDIT-07 coolant shopping list covers the fill the guide asks for: a ~9 L 1:1 fill needs ~4.5 L of concentrate, so the single 1 US gal bottle (3.8 L) is called out as not enough", () => {
  for (const g of [customer("coolant"), draft("coolant")]) {
    const row = g.parts.find((p) => /82141467704/.test(p));
    assert.ok(row, "concentrate row exists");
    assert.match(row, /one gallon is not enough/i);
    assert.match(row, /4\.5 L/);
    assert.ok(4.5 > 3.785, "the arithmetic behind the warning");
    assert.ok(g.parts.some((p) => /82142209769/.test(p)), "the 1 L bottle alternative is listed");
  }
});

test("AUDIT-08 differential: the guide says BMW-approved gear oil only, so it must not sell a non-BMW oil kit", () => {
  for (const g of [customer("driveline-fluid"), draft("differential-fluid")]) {
    assert.match(g.safety.join(" "), /only BMW-approved/i);
    for (const p of g.parts) assert.ok(!/Red Line|Redline/i.test(p), `non-BMW oil kit still listed: ${p.slice(0, 80)}`);
  }
});

// ---- Wrench Mode / restricted-step behaviour, swept over every guide and every kind of saved configuration ----
const CONFIGS = {
  "automatic+rwd": CONFIRMED,
  "not set": null,
  "never confirmed": { transmission: null, drivetrain: null, confirmedAt: null },
  "not sure x2": { transmission: "unknown", drivetrain: "unknown", confirmedAt: "x" },
  "automatic only": { transmission: "automatic", drivetrain: null, confirmedAt: "x" },
  "rwd only": { transmission: null, drivetrain: "rwd", confirmedAt: "x" },
  "automatic+awd (xDrive)": { transmission: "automatic", drivetrain: "awd", confirmedAt: "x" },
  "manual+rwd": { transmission: "manual", drivetrain: "rwd", confirmedAt: "x" },
  "manual+awd": { transmission: "manual", drivetrain: "awd", confirmedAt: "x" },
};
const FIGURE = /\b\d+(\.\d+)?\s*(Nm|N·m|lb[- ]?ft|ft[- ]?lb|in[- ]?lb)\b/i;
const PART_NUMBER = /\b\d{8,}\b/;

test("SWEEP all 16 guides x 9 configurations: steps stay numbered 1..n, no dangling 'step N', and withheld content carries no figure, part number or procedure", () => {
  for (const guide of bmwE90Guides) for (const [name, cfg] of Object.entries(CONFIGS)) {
    const r = resolveGuideForConfig(guide, cfg, "BMW");
    const where = `${guide.jobType} / ${name}`;
    r.steps.forEach((s, i) => assert.equal(s.number, i + 1, `${where}: step numbering`));
    const refs = [...allText(r).matchAll(/\bsteps? (\d{1,2})\b/gi)].map((m) => +m[1]);
    for (const n of refs) assert.ok(n >= 1 && n <= r.steps.length, `${where}: dangling reference to step ${n} of ${r.steps.length}`);
    for (const s of r.steps.filter((x) => /^⛔ (RESTRICTED|NOT AVAILABLE) — /.test(x.title))) {
      assert.ok(!FIGURE.test(s.instructions) && !PART_NUMBER.test(s.instructions), `${where}: withheld step "${s.title}" leaks a figure or part number`);
    }
    for (const t of r.torqueSpecs.filter((x) => /CONFIRM YOUR CONFIGURATION/.test(x.value))) assert.ok(!FIGURE.test(t.notes ?? ""), `${where}: restricted torque row leaks a number`);
    if (r.configResolution.status === "unavailable") {
      assert.equal(r.steps.length, 1, `${where}: unavailable guide must show one stop step`);
      assert.deepEqual([r.tools.length, r.parts.length, r.torqueSpecs.length], [0, 0, 0], `${where}: unavailable guide still lists tools/parts/torque`);
      assert.ok(!FIGURE.test(r.safety.join(" ")), `${where}: unavailable guide still quotes a figure in safety notes`);
    }
    if (name === "automatic+rwd") {
      assert.equal(r.configResolution.status === "unavailable" || r.configResolution.status === "needs-confirmation", false, `${where}: the expected build must resolve fully`);
      assert.ok(!r.steps.some((s) => /xDrive/i.test(s.title)), `${where}: xDrive step shown to a rear-wheel-drive car`);
    }
  }
});

test("SWEEP blocked steps stay blocked and bare in every configuration where they are shown (no tool size, no figure, no procedure verbs)", () => {
  for (const guide of bmwE90Guides) for (const [name, cfg] of Object.entries(CONFIGS)) {
    const r = resolveGuideForConfig(guide, cfg, "BMW");
    for (const s of r.steps.filter((x) => x.title.startsWith(BLOCK))) {
      const where = `${guide.jobType} / ${name} / ${s.title}`;
      assert.match(s.warning ?? "", /BLOCKED/, where);
      assert.ok(!FIGURE.test(s.instructions), `${where}: figure in blocked step`);
      assert.ok(!/\b\d+\s*mm\b|Torx|T\d{2}\b|socket|unscrew|pry|pull the/i.test(s.instructions), `${where}: procedure detail in blocked step`);
    }
  }
  // every config shows the same blocked steps: restriction never removes a stop
  for (const guide of bmwE90Guides) {
    const sets = Object.entries(CONFIGS).map(([name, cfg]) => [name, resolveGuideForConfig(guide, cfg, "BMW")]).filter(([, r]) => r.configResolution.status !== "unavailable").map(([, r]) => r.steps.filter((s) => s.title.startsWith(BLOCK)).map((s) => s.title).join("|"));
    assert.equal(new Set(sets).size, 1, `${guide.jobType}: blocked steps differ between configurations`);
  }
});

test("customer catalog and admin drafts agree on the fixed facts (the two generated copies cannot drift)", () => {
  const pairs = [["fuse-bulb", "fuse-bulb"], ["serpentine-belt", "serpentine-belt"], ["engine-air-filter", "engine-air-filter"], ["o2-sensor", "oxygen-sensor"], ["coolant", "coolant"], ["driveline-fluid", "differential-fluid"]];
  for (const [job, slug] of pairs) {
    const c = customer(job), d = draft(slug);
    assert.equal(c.parts.some((p) => /13717556961|Red Line|11287535860|\bD1S\b.*63217217509/.test(p)), false, job);
    assert.equal(d.parts.some((p) => /13717556961|Red Line|11287535860|\bD1S\b.*63217217509/.test(p)), false, job);
  }
});

test("AUDIT-10 wording: no doubled brand words in customer text (\"BMW's BMW service manual\", \"BMW BMW parts catalog\") in either copy", () => {
  for (const g of [...bmwE90Guides.map((x) => customer(x.jobType)), ...bmwDraftGuides.map((d) => d.guide)]) {
    const t = allText(g);
    assert.ok(!/\bBMW(?:'s)? BMW\b/.test(t), `${g.id}: doubled brand word: ${(t.match(/.{30}\bBMW(?:'s)? BMW\b.{20}/) ?? [""])[0]}`);
  }
});

test("AUDIT-09 battery safety: jump-starting only from the engine-bay jump terminal (never the trunk battery or power box), and a recycling / core-return line", () => {
  for (const g of [customer("battery"), draft("battery")]) {
    const s = g.safety.join("\n");
    assert.match(s, /Jump-start only from the engine-compartment jump terminal/);
    assert.match(s, /never clamp onto the trunk battery or the rear power distribution box/);
    assert.match(s, /recycler or a parts-store core return/);
    assert.match(s, /sparks and flame away/);
  }
});

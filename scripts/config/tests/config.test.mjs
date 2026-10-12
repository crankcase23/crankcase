// Vehicle Configuration V1: platform-wide, cross-vehicle regression tests (pure logic; the browser and database flows are in tests/e2e/vehicle-config.spec.ts).
// Every failure we find later gets a test here. Run: npm run config:test
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { OUT_RE } from "../../bmw/config-axes.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const esbuild = createRequire(path.join(ROOT, "package.json"))("esbuild");
async function bundle(entry) {
  const out = await esbuild.build({ entryPoints: [path.join(ROOT, entry)], bundle: true, write: false, format: "esm", platform: "node", logLevel: "silent", alias: { "@": path.join(ROOT, "src") } });
  return import("data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64"));
}
const vc = await bundle("src/lib/vehicleConfig.ts");
const gc = await bundle("src/lib/guideConfig.ts");
const data = await bundle("src/lib/data.ts");
const catalog = await bundle("src/data/repairs.ts");

const BMW = "2010-bmw-328i-3.0l";
const bmw = data.findVehicle(BMW);
const cfg = (transmission, drivetrain) => ({ transmission, drivetrain, confirmedAt: "2026-10-11T00:00:00.000Z" });
const AUTO_RWD = cfg("automatic", "rwd"), AUTO_XDRIVE = cfg("automatic", "awd"), MANUAL_RWD = cfg("manual", "rwd"), UNSURE = cfg("unknown", "unknown");
const bmwGuides = catalog.getRepairsForVehicle(BMW);
const resolve = (g, c) => gc.resolveGuideForConfig(g, c, "BMW");
const SPLIT = /(?<=[.!?\]])\s+(?=[A-Z⚠⛔\[])/;
/** Every string a customer can read in a resolved guide (not the evidence metadata, which is only shown for an unavailable guide). */
const shown = (g) => [
  g.summary, ...g.safety, ...g.tools.flatMap((t) => [t.name, t.note ?? ""]), ...g.parts,
  ...g.torqueSpecs.flatMap((t) => [t.fastener, t.value, t.notes ?? ""]),
  ...g.steps.flatMap((s) => [s.title, s.instructions, s.warning ?? ""]),
];

// ---------------------------------------------------------------------------------------------------------------- model
test("config states: confirmed / partial / unknown / unset, and the identity key used to detect a stale session", () => {
  assert.equal(vc.configState(null), "unset");
  assert.equal(vc.configState(vc.EMPTY_CONFIG), "unset");
  assert.equal(vc.configState(AUTO_RWD), "confirmed");
  assert.equal(vc.configState(UNSURE), "unknown");
  assert.equal(vc.configState(cfg("automatic", "unknown")), "partial");
  assert.equal(vc.configKey(AUTO_RWD), "automatic|rwd");
  assert.equal(vc.configKey(cfg("automatic", "unknown")), "automatic|?");
  assert.equal(vc.configKey(null), "?|?");
  assert.notEqual(vc.configKey(AUTO_RWD), vc.configKey(AUTO_XDRIVE));
});

test("Confirm Your Ride options: only builds the model really offered; 'Not sure' is always allowed; labels fit the make", () => {
  const o = vc.configOptionsFor({ make: "BMW", vehicle: bmw });
  assert.deepEqual(o.transmission.options, ["automatic", "manual"]);
  assert.deepEqual(o.drivetrain.options, ["rwd", "awd"], "a 328i is never offered FWD or 4WD");
  assert.equal(vc.choiceLabel("drivetrain", "rwd", "BMW"), "Standard RWD");
  assert.equal(vc.choiceLabel("drivetrain", "awd", "BMW"), "xDrive AWD");
  assert.equal(vc.choiceLabel("drivetrain", "awd", "Toyota"), "AWD");
  assert.ok(vc.isAllowedChoice("drivetrain", "unknown", o) && !vc.isAllowedChoice("drivetrain", "4wd", o) && !vc.isAllowedChoice("transmission", "cvt", o));
  const jeep = vc.configOptionsFor({ make: "Jeep" });
  assert.deepEqual(jeep.drivetrain.options, ["2wd", "4wd"]);
  assert.equal(vc.choiceLabel("drivetrain", "2wd", "Jeep"), "2WD");
  const ford = vc.configOptionsFor({ make: "Ford" });
  assert.deepEqual(ford.drivetrain.options, ["fwd", "rwd", "awd", "4wd"]);
  assert.deepEqual(ford.transmission.options, ["automatic", "manual"]);
});

test("VIN data may preselect a choice but never confirms it, and never preselects something the model does not offer", () => {
  const awd = vc.configOptionsFor({ make: "BMW", vehicle: bmw, decoded: { driveType: "AWD/All-Wheel Drive" } });
  assert.equal(awd.drivetrain.preselect, "awd");
  const fwd = vc.configOptionsFor({ make: "BMW", vehicle: bmw, decoded: { driveType: "FWD/Front-Wheel Drive" } });
  assert.equal(fwd.drivetrain.preselect, undefined, "FWD is not a 328i build");
  const none = vc.configOptionsFor({ make: "BMW", vehicle: bmw, decoded: {} });
  assert.equal(none.drivetrain.preselect, undefined);
  assert.equal(none.transmission.preselect, undefined, "the BMW VIN decode says nothing, so the customer must answer");
  const civic = vc.configOptionsFor({ make: "Honda", vehicle: data.findVehicle("2018-honda-civic-1.5t") });
  assert.equal(civic.drivetrain.preselect, "fwd");
  assert.equal(civic.transmission.preselect, "cvt");
});

test("server validation: the add needs BOTH axes explicit; a value the model does not offer is rejected; Not sure is accepted", () => {
  assert.equal(vc.parseFullConfig({}, bmw).ok, false);
  assert.equal(vc.parseFullConfig({ transmission: "automatic" }, bmw).ok, false);
  assert.equal(vc.parseFullConfig({ transmission: "automatic", drivetrain: "4wd" }, bmw).ok, false);
  assert.equal(vc.parseFullConfig({ transmission: "cvt", drivetrain: "rwd" }, bmw).ok, false);
  assert.equal(vc.parseFullConfig({ transmission: "automatic", drivetrain: "rwd" }, bmw).ok, true);
  assert.equal(vc.parseFullConfig({ transmission: "unknown", drivetrain: "unknown" }, bmw).ok, true);
  assert.equal(vc.parseFullConfig({ transmission: "automatic", drivetrain: "banana" }, undefined).ok, false);
  assert.equal(vc.parseFullConfig({ transmission: "manual", drivetrain: "4wd" }, undefined).ok, true, "a vehicle with no model list accepts any real kind");
  assert.equal(vc.parsePartialConfig({}, bmw).ok, false, "an edit that changes nothing is refused");
  assert.deepEqual(vc.parsePartialConfig({ drivetrain: "awd" }, bmw), { ok: true, value: { drivetrain: "awd" } });
});

test("a malformed stored row can never become a configuration", () => {
  for (const bad of [null, undefined, 5, "x", { transmission: "bogus", drivetrain: 7 }, { transmission: "", drivetrain: "" }]) {
    const c = vc.normalizeConfig(bad);
    assert.equal(c.transmission, null); assert.equal(c.drivetrain, null);
  }
  assert.equal(vc.normalizeConfig({ transmission: "automatic", drivetrain: "rwd", confirmedAt: "x" }).drivetrain, "rwd");
});

// ---------------------------------------------------------------------------------------------------- garage card / specs
test("BMW garage card target: 2010 BMW 328i / 3.0L inline-six · Automatic · RWD; unresolved details are not on the card", () => {
  assert.equal(bmw.engine, "3.0L inline-six");
  const line = [bmw.trim, bmw.engine, ...vc.summaryLine(bmw, AUTO_RWD)].filter(Boolean).join(" · ");
  assert.match(line, /3\.0L inline-six · Automatic · RWD$/);
  assert.ok(!/xdrive|manual|awd|not confirmed|n5[12]/i.test(line), line);
  assert.deepEqual(vc.summaryLine(bmw, null), [], "unconfirmed: the card shows a confirm prompt, not a paragraph of uncertainty");
});

test("BMW specs and fluids for Automatic + RWD carry no xDrive or manual wording; the spec rows say what was confirmed", () => {
  const rows = vc.specRowsForConfig(bmw, AUTO_RWD), fluids = vc.fluidsForConfig(bmw, AUTO_RWD);
  assert.equal(rows.find((r) => r.label === "Drivetrain").value, "Standard RWD");
  assert.equal(rows.find((r) => r.label === "Transmission").value, "Automatic");
  const text = JSON.stringify([rows, fluids]);
  assert.ok(!OUT_RE.test(text), `out-of-build wording: ${text.match(OUT_RE)}`);
  assert.ok(fluids.some((f) => /Rear Axle/.test(f.name)), "a confirmed RWD car keeps its rear axle fluid");
  assert.ok(!vc.fluidsForConfig(bmw, AUTO_XDRIVE).some((f) => /Rear Axle/.test(f.name)), "the RWD-only fluid is not shown for a different drivetrain");
  const unconfirmed = vc.specRowsForConfig(bmw, null);
  assert.match(unconfirmed.find((r) => r.label === "Drivetrain").value, /Not confirmed yet/);
});

test("existing catalog vehicles keep their own wording until their owner confirms, then show the owner's answer", () => {
  const jeep = data.findVehicle("2014-jeep-grand-cherokee-3.6l");
  const before = vc.specRowsForConfig(jeep, null);
  assert.match(before.find((r) => r.label === "Drivetrain").value, /RWD \(2WD\)/);
  const after = vc.specRowsForConfig(jeep, cfg("automatic", "4wd"));
  assert.match(after.find((r) => r.label === "Drivetrain").value, /4WD/);
  assert.match(after.find((r) => r.label === "Transmission").value, /automatic/i);
});

// ------------------------------------------------------------------------------------------------------ resolver (generic)
const g = (over = {}) => ({
  id: "x", vehicleId: "v", jobType: "j", title: "T", summary: "S", difficulty: "easy", estTime: "1 h", tier: "free",
  tools: [{ name: "Wrench" }, { name: "Special tool", forConfig: { drivetrain: ["awd"] } }],
  parts: ["Part A"], safety: ["⚠ Jack stands."],
  torqueSpecs: [{ fastener: "Bolt RWD", value: "50 Nm", notes: "n", forConfig: { drivetrain: ["rwd"] } }, { fastener: "Bolt AWD", value: "70 Nm", notes: "n", forConfig: { drivetrain: ["awd"] } }, { fastener: "Common", value: "10 Nm", notes: "n" }],
  steps: [
    { number: 1, title: "Prep", instructions: "Park it." },
    { number: 2, title: "AWD only", instructions: "Do the AWD thing, then go to step 4.", forConfig: { drivetrain: ["awd"] } },
    { number: 3, title: "RWD only", instructions: "Do the RWD thing. See step 2.", forConfig: { drivetrain: ["rwd"] } },
    { number: 4, title: "⛔ BLOCKED — Danger", instructions: "This step is blocked.", warning: "⛔ BLOCKED" },
    { number: 5, title: "Finish", instructions: "Repeat step 3, then see step 4. Check step 1.", warning: "⚠ Careful." },
  ],
  ...over,
});
test("resolver: confirmed build keeps its steps, drops the other build's, renumbers and re-points references, keeps warnings and blocked steps", () => {
  const r = gc.resolveGuideForConfig(g(), cfg("automatic", "rwd"));
  assert.equal(r.configResolution.status, "applied");
  assert.deepEqual(r.steps.map((s) => s.title), ["Prep", "RWD only", "⛔ BLOCKED — Danger", "Finish"]);
  assert.deepEqual(r.steps.map((s) => s.number), [1, 2, 3, 4]);
  assert.ok(!/step 2\b/.test(r.steps[1].instructions), "a reference to a removed step is dropped, never left pointing elsewhere");
  assert.match(r.steps[3].instructions, /step 2/, "step 3 became step 2");
  assert.match(r.steps[3].instructions, /step 3/, "step 4 (blocked) became step 3");
  assert.deepEqual(r.tools.map((t) => t.name), ["Wrench"]);
  assert.deepEqual(r.torqueSpecs.map((t) => t.fastener), ["Bolt RWD", "Common"]);
  assert.equal(r.steps[3].warning, "⚠ Careful.");
  assert.deepEqual(r.safety, ["⚠ Jack stands."]);
});
test("resolver: an unconfirmed axis restricts instead of guessing: no procedure, no number, nothing defaults to the common build", () => {
  for (const c of [null, vc.EMPTY_CONFIG, UNSURE, cfg("automatic", "unknown")]) {
    const r = gc.resolveGuideForConfig(g(), c);
    assert.equal(r.configResolution.status, "needs-confirmation");
    assert.deepEqual(r.configResolution.pendingAxes, ["drivetrain"]);
    const restricted = r.steps.filter((s) => s.title.startsWith(gc.RESTRICTED_PREFIX));
    assert.equal(restricted.length, 2);
    for (const s of restricted) assert.ok(!/AWD thing|RWD thing/.test(s.instructions));
    const tq = r.torqueSpecs.filter((t) => t.value === gc.CONFIRM_TORQUE);
    assert.equal(tq.length, 2); for (const t of tq) assert.ok(!/\d+\s*Nm/.test(t.value + t.notes));
    assert.ok(r.steps.some((s) => s.title.startsWith("⛔ BLOCKED")), "blocked steps stay");
    assert.ok(!r.tools.some((t) => t.name === "Special tool"));
  }
});
test("resolver: a guide that does not depend on the build comes back unchanged (status none), for every config", () => {
  const plain = g({ tools: [{ name: "Wrench" }], torqueSpecs: [{ fastener: "Common", value: "10 Nm", notes: "n" }], steps: [{ number: 1, title: "Prep", instructions: "Park it." }] });
  for (const c of [null, AUTO_RWD, UNSURE]) {
    const { configResolution, ...rest } = gc.resolveGuideForConfig(plain, c);
    assert.equal(configResolution.status, "none");
    assert.deepEqual(rest, plain);
  }
});
test("resolver: a confirmed build outside the evidence gets NO procedure (refusal), not a guess", () => {
  const guide = g({ evidenceFor: { drivetrain: ["rwd"] }, evidenceNote: "Only RWD was researched." });
  const r = gc.resolveGuideForConfig(guide, cfg("automatic", "awd"), "BMW");
  assert.equal(r.configResolution.status, "unavailable");
  assert.equal(r.steps.length, 1);
  assert.match(r.steps[0].title, /NOT AVAILABLE/);
  assert.deepEqual([r.tools, r.parts, r.torqueSpecs], [[], [], []]);
  assert.match(r.configResolution.unavailableReason, /xDrive AWD/);
  assert.match(r.configResolution.unavailableReason, /Only RWD was researched/);
});

// -------------------------------------------------------------------------------------------------------------- BMW
test("all 16 BMW categories exist for every configuration; a category may be unavailable or restricted but never missing", () => {
  assert.equal(bmwGuides.length, 16);
  for (const c of [AUTO_RWD, AUTO_XDRIVE, MANUAL_RWD, UNSURE, null]) {
    const out = bmwGuides.map((x) => resolve(x, c));
    assert.equal(out.length, 16);
    assert.equal(new Set(out.map((x) => x.jobType)).size, 16);
    for (const r of out) assert.ok(r.steps.length >= 1 && r.title);
  }
});

test("Automatic + RWD: zero xDrive / manual / all-wheel wording in any customer-facing step, warning, tool, part, fluid or torque row of all 16 guides", () => {
  for (const x of bmwGuides) {
    const r = resolve(x, AUTO_RWD);
    for (const t of shown(r)) for (const sent of String(t).split(SPLIT)) assert.ok(!OUT_RE.test(sent), `${x.id}: "${sent.slice(0, 160)}" mentions a build this car is not`);
  }
});

test("Automatic + RWD: the old 'might be RWD or xDrive' uncertainty is gone, and the exact-build warning with it", () => {
  for (const x of bmwGuides) {
    const r = resolve(x, AUTO_RWD);
    for (const t of shown(r)) {
      assert.ok(!/not confirmed from the VIN alone/i.test(t), `${x.id}: ${t.slice(0, 100)}`);
      assert.ok(!/check whether your car is (an automatic|rear-wheel)/i.test(t), `${x.id}: ${t.slice(0, 100)}`);
      assert.ok(!/RWD or xDrive|rear-wheel drive or xDrive|automatic or (a )?manual/i.test(t), `${x.id}: ${t.slice(0, 100)}`);
    }
    assert.ok(["applied", "none"].includes(r.configResolution.status), `${x.id}: ${r.configResolution.status}`);
    assert.equal(r.configResolution.restrictedCount, 0);
  }
});

test("genuinely unresolved specifications stay flagged: torque without a verified figure keeps its VERIFY warning, and confirming drivetrain certifies nothing", () => {
  let verify = 0;
  for (const x of bmwGuides) {
    const raw = x.torqueSpecs.filter((t) => /VERIFY EXACT TORQUE/.test(t.value));
    const r = resolve(x, AUTO_RWD).torqueSpecs.filter((t) => /VERIFY EXACT TORQUE/.test(t.value));
    verify += r.length;
    assert.ok(r.length >= raw.filter((t) => !t.forConfig || (t.forConfig.drivetrain ?? ["rwd"]).includes("rwd")).length - 0, `${x.id}: a VERIFY torque row disappeared`);
    for (const t of resolve(x, AUTO_RWD).torqueSpecs) if (/\d+\s*Nm/.test(t.value)) assert.ok(x.torqueSpecs.some((o) => o.value === t.value), `${x.id}: a torque number appeared that is not in the guide data`);
    assert.ok(resolve(x, AUTO_RWD).steps.some((s) => /⚠/.test(s.warning ?? "")) , `${x.id}: no caution marker survives`);
  }
  assert.ok(verify > 5, "unresolved torque rows remain flagged across the BMW guides");
});

test("blocked steps never disappear and never gain a procedure, in any configuration", () => {
  const blocked = (gs) => gs.flatMap((r) => r.steps.filter((s) => s.title.startsWith("⛔ BLOCKED")).map((s) => `${r.jobType}:${s.title}`));
  const base = blocked(bmwGuides.map((x) => resolve(x, AUTO_RWD))).sort();
  assert.equal(base.length, 3);
  for (const c of [UNSURE, null]) assert.deepEqual(blocked(bmwGuides.map((x) => resolve(x, c))).sort(), base, "restricting must not remove a blocked step");
});

test("xDrive (confirmed) and Manual (confirmed): guides researched only for another build give no procedure and no part, fluid or torque numbers", () => {
  const unavailable = (c) => bmwGuides.map((x) => resolve(x, c)).filter((r) => r.configResolution.status === "unavailable");
  const xd = unavailable(AUTO_XDRIVE), mn = unavailable(MANUAL_RWD);
  assert.ok(xd.length >= 5 && mn.length >= 4, `xDrive ${xd.length}, manual ${mn.length}`);
  for (const r of [...xd, ...mn]) {
    assert.deepEqual([r.tools, r.parts, r.torqueSpecs], [[], [], []], r.id);
    assert.equal(r.steps.length, 1); assert.match(r.steps[0].title, /NOT AVAILABLE/);
  }
  // a guide whose evidence does not depend on that axis still opens
  const tire = resolve(bmwGuides.find((x) => x.jobType === "battery"), AUTO_XDRIVE);
  assert.notEqual(tire.configResolution.status, "unavailable");
});

test("unknown / Not sure: build-dependent steps are restricted (no procedure, no number); universal procedures still show; nothing looks certified", () => {
  for (const x of bmwGuides) {
    const r = resolve(x, UNSURE);
    for (const s of r.steps.filter((s) => s.title.startsWith(gc.RESTRICTED_PREFIX))) assert.match(s.instructions, /not confirmed yet/);
    for (const t of r.torqueSpecs.filter((t) => t.value === gc.CONFIRM_TORQUE)) assert.ok(!/\d/.test(t.notes));
    if (r.configResolution.status === "needs-confirmation") assert.ok(r.configResolution.pendingAxes.length > 0);
  }
  const oil = resolve(bmwGuides.find((x) => x.jobType === "oil-change"), UNSURE);
  assert.equal(oil.configResolution.status, "needs-confirmation");
  assert.ok(oil.steps.some((s) => s.title.startsWith(gc.RESTRICTED_PREFIX + "Drain the sump")), "the drain step waits for the build");
  assert.ok(oil.steps.some((s) => s.title === "Lift and support the car"), "the universal steps still show");
  const universal = resolve(bmwGuides.find((x) => x.jobType === "battery"), UNSURE);
  assert.equal(universal.configResolution.status, "none");
});

test("oil-change Step 1 is practical: no part-number dumps, catalog comparisons, research notes or unresolved geometry", () => {
  const oil = resolve(bmwGuides.find((x) => x.jobType === "oil-change"), AUTO_RWD);
  const first = oil.steps[0], gather = oil.steps.find((s) => /^Gather parts/.test(s.title));
  for (const s of [first, gather]) {
    assert.ok(!/\b\d{8,}\b/.test(s.instructions), `part numbers in "${s.title}": ${s.instructions.slice(0, 120)}`);
    assert.ok(!/RealOEM|catalog|S205|Wikipedia|retailer|thread|diagram|geometry|NOT established|N51/.test(s.instructions.replace(/SULEV N51 variant/, "")), s.instructions.slice(0, 200));
    assert.ok(s.instructions.length < 900, "phone-friendly length");
  }
  assert.match(first.title, /^Before you start/);
  assert.ok(oil.parts.some((p) => /11427566327/.test(p)), "the part numbers live in the Parts list");
  assert.ok(oil.steps.length >= 14);
});

test("every BMW customer 'Before you start' step is short and free of research jargon", () => {
  for (const x of bmwGuides) {
    const lead = x.steps.filter((s) => /^Before you start/.test(s.title));
    assert.ok(lead.length <= 2, `${x.id}: ${lead.length} lead steps`);
    for (const s of lead) {
      assert.ok(s.instructions.length <= 900, `${x.id}: ${s.instructions.length} chars`);
      assert.ok(!/RealOEM|\bETK\b|Turner|Bimmerworld|bimmer\.?work|Pelican|\bFCP\b|forum|poster|thread|bimmerpost|Wikipedia|retailer|\bST\d{3}\b|\bSIB\b/i.test(s.instructions), `${x.id}: ${s.instructions.slice(0, 160)}`);
      assert.ok(!/ \| /.test(s.instructions));
    }
  }
});

test("Planning Mode and Wrench Mode read the same resolved guide: step numbers are 1..N with no gaps for every BMW config, and every 'step N' points at a real step", () => {
  for (const c of [AUTO_RWD, AUTO_XDRIVE, MANUAL_RWD, UNSURE, null]) for (const x of bmwGuides) {
    const r = resolve(x, c);
    r.steps.forEach((s, i) => assert.equal(s.number, i + 1, `${r.id}`));
    for (const s of r.steps) for (const t of [s.instructions, s.warning ?? ""]) for (const m of t.matchAll(/\b[Ss]teps? (\d{1,2})(?:\s*(?:to|-|–|and|or)\s*(\d{1,2}))?/g)) for (const n of [m[1], m[2]].filter(Boolean)) assert.ok(Number(n) >= 1 && Number(n) <= r.steps.length, `${r.id} ${c ? vc.configKey(c) : "null"}: step ${n} of ${r.steps.length} in "${t.slice(0, 100)}"`);
  }
});

test("stale Wrench Mode sessions: the resolution carries the configuration key it was resolved under, so a changed saved config is detectable", () => {
  const oil = bmwGuides.find((x) => x.jobType === "oil-change");
  const a = resolve(oil, AUTO_RWD), b = resolve(oil, AUTO_XDRIVE), c = resolve(oil, UNSURE);
  assert.equal(a.configResolution.key, "automatic|rwd");
  assert.equal(b.configResolution.key, "automatic|awd");
  assert.equal(c.configResolution.key, "?|?", "Not sure and never-asked restrict the same content");
  assert.equal(new Set([a, b, c].map((r) => r.configResolution.key)).size, 3);
  assert.notEqual(a.steps.length, b.steps.length, "the guide a stale session was started on really differs from the one that applies now");
});

// ------------------------------------------------------------------------------------------------- other vehicles
test("Jeep / Ford / Chevy / Toyota / Honda and every other catalog vehicle: guides without build-dependent content are untouched by any configuration", () => {
  let checked = 0;
  for (const v of data.listVehicles()) {
    if (v.id === BMW) continue;
    for (const guide of catalog.getRepairsForVehicle(v.id)) {
      assert.ok(!gc.guideDependsOnConfig(guide), `${guide.id}: unexpectedly build-dependent`);
      for (const c of [null, AUTO_RWD, UNSURE, cfg("manual", "4wd")]) {
        const { configResolution, ...rest } = gc.resolveGuideForConfig(guide, c, v.make);
        assert.equal(configResolution.status, "none");
        assert.deepEqual(rest, guide, `${guide.id}`);
      }
      checked++;
    }
  }
  assert.ok(checked > 100, `checked ${checked} guides`);
});

test("other vehicles keep generic options (Jeep 2WD/4WD, everyone else FWD/RWD/AWD/4WD) and nothing BMW-specific leaks in", () => {
  for (const v of data.listVehicles()) {
    if (v.id === BMW) continue;
    const o = vc.configOptionsFor({ make: v.make, vehicle: v });
    assert.notEqual(o.transmission.source, "model", `${v.id}: only the BMW has a model-specific list today`);
    assert.notEqual(o.drivetrain.source, "model", v.id);
    const jeep = v.make === "Jeep";
    const parsed = vc.parseDrivetrain(v.drivetrain);
    const named = jeep && (parsed === "rwd" || parsed === "fwd") ? "2wd" : parsed; // a Jeep's "RWD (2WD)" is its 2WD choice
    const base = v.make === "Jeep" ? ["2wd", "4wd"] : ["fwd", "rwd", "awd", "4wd"];
    assert.deepEqual([...o.drivetrain.options].sort(), [...new Set([...base, ...(named ? [named] : [])])].sort(), v.id);
    assert.equal(vc.choiceLabel("drivetrain", "awd", v.make), v.make === "BMW" ? "xDrive AWD" : "AWD");
    assert.ok(!(o.drivetrain.options ?? []).includes?.("x"));
  }
});

// ------------------------------------------------------------------------------------------------------- migration
test("migration is additive, idempotent and reversible: no data is dropped, rewritten or deleted; rollback removes only what was added", () => {
  const up = fs.readFileSync(path.join(ROOT, "migrations/2026-10-11-vehicle-configuration.sql"), "utf8");
  const down = fs.readFileSync(path.join(ROOT, "migrations/2026-10-11-vehicle-configuration-ROLLBACK.sql"), "utf8");
  const code = (s) => s.split("\n").filter((l) => !/^\s*--/.test(l)).join("\n");
  assert.ok(!/\b(DROP\s+TABLE|DROP\s+COLUMN|DELETE\s+FROM|TRUNCATE|UPDATE\s+garage_entries|ALTER\s+COLUMN)\b/i.test(code(up)), "the up migration must not destroy or rewrite anything");
  assert.ok(/IF NOT EXISTS|information_schema/i.test(up), "idempotent guards");
  assert.match(code(up), /transmission/); assert.match(code(up), /drivetrain/); assert.match(code(up), /config_confirmed_at/);
  assert.ok(/DROP\s+(COLUMN|INDEX|CONSTRAINT)|DROP INDEX/i.test(code(down)));
  assert.ok(!/DROP\s+TABLE|DELETE\s+FROM|TRUNCATE/i.test(code(down)), "rollback never drops a table or rows");
});

// ----------------------------------------------------------------------------- generic options are not "verified"
test("only a model list counts as verified: every other vehicle's options are general, and the screen says so", () => {
  for (const v of data.listVehicles()) {
    const o = vc.configOptionsFor({ make: v.make, vehicle: v });
    assert.equal(vc.optionsAreModelVerified(o), v.id === BMW, `${v.id}: only the BMW 328i has a verified model list`);
  }
  // a VIN or catalog wording that names a build preselects it but does not make the list verified
  const civic = data.findVehicle("2018-honda-civic-1.5t");
  const o = vc.configOptionsFor({ make: "Honda", vehicle: civic, decoded: { driveType: "FWD/Front-Wheel Drive", transmissionStyle: "Continuously Variable Transmission (CVT)" } });
  assert.equal(vc.optionsAreModelVerified(o), false);
  const src = fs.readFileSync(path.join(ROOT, "src/components/config/ConfigChoices.tsx"), "utf8");
  assert.ok(/optionsAreModelVerified/.test(src) && /config-generic-note/.test(src) && /not a list verified for this model/.test(src));
});

test("generic options never invent builds: no CVT/DCT unless a VIN or the catalog named one; the BMW list is exactly its two builds", () => {
  for (const v of data.listVehicles()) {
    if (v.id === BMW) continue;
    const o = vc.configOptionsFor({ make: v.make, vehicle: v });
    const named = vc.parseTransmission(v.transmission);
    for (const t of o.transmission.options) assert.ok(["automatic", "manual"].includes(t) || t === named, `${v.id} offers ${t} with nothing naming it`);
  }
  assert.deepEqual(vc.configOptionsFor({ make: "BMW", vehicle: bmw }).drivetrain.options, ["rwd", "awd"]);
});

test("a saved choice on a vehicle with no model list never changes, certifies or hides anything in its guides; the BMW still restricts on Not sure", () => {
  for (const v of data.listVehicles()) {
    if (v.id === BMW) continue;
    for (const g of catalog.getRepairsForVehicle(v.id)) {
      for (const c of [cfg("automatic", "awd"), cfg("manual", "fwd"), UNSURE]) {
        const r = gc.resolveGuideForConfig(g, c, v.make);
        assert.equal(r.configResolution?.status ?? "none", "none", `${v.id}/${g.id}`);
        assert.equal(r.steps.length, g.steps.length, `${v.id}/${g.id}`);
      }
    }
  }
  const oil = bmwGuides.find((g) => g.id === "bmw-2010-328i-oil-change");
  assert.notEqual(resolve(oil, UNSURE).configResolution.status, "none");
});

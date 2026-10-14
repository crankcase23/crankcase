// REGRESSIONS: 2015 F-150 5.0L catalog values corrected against the Ford owner's manual.
// Source (primary, free): Ford 2015 F-150 Owner's Manual, "Capacities and Specifications - 5.0L"
// (Ford owner site, Variantid 3326, bookcode O25960). Read 2026-10-13.
//   Brake fluid: DOT 4 LV only (Motorcraft PM-20, WSS-M6C65-A2). The catalog said DOT 3.
//   Engine coolant: 15.9 qt (15 L), Motorcraft Orange prediluted VC-3DIL-B, WSS-M97B44-D2. The catalog said ~16.6 qt, no source.
// The battery row (Group 65, ~750 CCA) is NOT touched here: the owner's manual page read did not state a group or CCA, so it stays a
// separate open item rather than being "fixed" with another unsourced number.
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
const { vehicles } = await bundle("src/data/vehicles.ts");
const f150 = vehicles.find((v) => v.id === "2015-ford-f150-5.0l");
const fluid = (name) => f150.fluids.find((f) => f.name === name);

test("F-150 5.0L is still in the catalog", () => assert.ok(f150));

test("REGRESSION F-150 brake fluid is DOT 4 LV, never DOT 3", () => {
  const f = fluid("Brake Fluid");
  assert.ok(f, "Brake Fluid entry present");
  assert.match(f.spec, /DOT 4 LV/);
  assert.match(f.spec, /WSS-M6C65-A2/);
  assert.doesNotMatch(f.spec, /DOT 3/);
});

test("REGRESSION F-150 coolant capacity is 15.9 qt and spec is the prediluted Orange D2", () => {
  const f = fluid("Engine Coolant");
  assert.ok(f, "Engine Coolant entry present");
  assert.match(f.capacity, /15\.9 qt/);
  assert.doesNotMatch(f.capacity, /16\.6/);
  assert.match(f.spec, /VC-3DIL-B/);
  assert.match(f.spec, /WSS-M97B44-D2/);
});

test("the Orange/Yellow/Gold cross-contamination warning is kept", () => {
  const n = fluid("Engine Coolant").notes;
  assert.match(n, /Gold/);
  assert.match(n, /Yellow/);
  assert.match(n, /WSS-M97B51-A1/);
});

test("the battery row is untouched by this change (separate open item, no new unsourced number)", () => {
  const row = f150.specs.find((s) => s.label === "Battery");
  assert.equal(row?.value, "Group size 65, ~750 CCA");
});

// ---- Second pass (2026-10-13 evening): oil, fuel tank, axle fluids, transfer case. Same source. ----
// Ford 2015 F-150 Owner's Manual, Capacities and Specifications - 5.0L, re-read live: engine oil 7.7 qt (7.3 L); fuel tank 23.0 gal
// (87.1 L), optional 36.0 gal (136.2 L); front axle (4WD) 3.5 pt (1.7 L) Motorcraft SAE 80W-90 XY-80W90-QL WSP-M2C197-A; rear axle
// 5.5 pt (2.6 L) Motorcraft SAE 75W-85 synthetic hypoid XY-75W85-QL WSS-M2C942-A; transfer case 1.5 qt (1.4 L), Electronic
// Shift-on-the-Fly = Motorcraft XL-12 (ESP-M2C166-H), Torque-On-Demand / 2-Speed Automatic = MERCON LV (WSS-M2C938-A).
// The manual lists the transfer case types as "if equipped" and never says which one an XLT SuperCrew 4x4 has, and it does not map the
// two fuel tanks to a cab or wheelbase. The catalog therefore states both and does not guess.
test("REGRESSION F-150 engine oil is 7.7 qt (Ford 5.0L page), not the unsourced 8.8 qt, and the filter claim is not asserted", () => {
  const f = fluid("Engine Oil");
  assert.match(f.capacity, /7\.7 qt/);
  assert.doesNotMatch(f.capacity, /8\.8|filter/i);
  assert.match(f.spec, /5W-20/);
  assert.match(f.spec, /WSS-M2C945-A/);
  assert.match(f.notes, /dipstick/);
});

test("REGRESSION F-150 fuel tank: Ford's 23.0 gal and optional 36.0 gal; the unsourced 26 gal is gone", () => {
  const row = f150.specs.find((s) => s.label === "Fuel tank");
  assert.match(row.value, /23\.0 gal/);
  assert.match(row.value, /36\.0 gal/);
  assert.match(row.value, /optional/i);
  assert.doesNotMatch(row.value, /\b26\b/);
});

test("REGRESSION F-150 axle fluids match Ford's 5.0L page and no 75W-140 remains on this truck", () => {
  const front = fluid("Front Differential Fluid (4WD)"), rear = fluid("Rear Differential Fluid");
  assert.match(front.capacity, /3\.5 pt/); assert.match(front.spec, /80W-90/); assert.match(front.spec, /WSP-M2C197-A/);
  assert.match(rear.capacity, /5\.5 pt/); assert.match(rear.spec, /75W-85/); assert.match(rear.spec, /WSS-M2C942-A/);
  assert.doesNotMatch(JSON.stringify(f150.fluids.filter((f) => /Differential/.test(f.name)).map((f) => [f.capacity, f.spec])), /75W-140/);
  assert.doesNotMatch(front.capacity + rear.capacity, /2\.8 pt|2\.75-3\.5|9\.75/);
});

test("the unsupported 'friction modifier if limited-slip' instruction is not asserted as a spec on this truck", () => {
  const rear = fluid("Rear Differential Fluid");
  assert.doesNotMatch(rear.spec, /friction modifier/i);
  assert.match(rear.notes, /NOT asserted/);
});

test("RESTRICTED F-150 transfer case: both Ford fluids are named with how to tell them apart, and no single fluid is stated for every 4WD truck", () => {
  const f = fluid("Transfer Case Fluid");
  assert.match(f.capacity, /1\.5 qt/);
  assert.match(f.spec, /DEPENDS ON THE TRANSFER CASE/);
  assert.match(f.spec, /XL-12/); assert.match(f.spec, /ESP-M2C166-H/);
  assert.match(f.spec, /MERCON LV/); assert.match(f.spec, /WSS-M2C938-A/);
  assert.match(f.spec, /Electronic Shift-on-the-Fly/); assert.match(f.spec, /4A|4X4 AUTO/);
  assert.match(f.spec, /Do not buy until you know/);
  assert.match(f.notes, /RESTRICTED/);
  assert.notEqual(f.spec.trim(), "Motorcraft MERCON LV", "the old one-size-fits-all answer is wrong for Electronic Shift-on-the-Fly");
});

test("the 5.0L values are the 5.0L page's, not another engine's (3.5L page: oil 6.3 qt, coolant 15.1 qt)", () => {
  assert.doesNotMatch(fluid("Engine Oil").capacity, /6\.3/);
  assert.doesNotMatch(fluid("Engine Coolant").capacity, /15\.1/);
});

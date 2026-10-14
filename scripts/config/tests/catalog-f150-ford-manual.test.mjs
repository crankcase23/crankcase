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

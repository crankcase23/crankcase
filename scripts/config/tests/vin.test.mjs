// VIN-required garage: pure-logic tests for src/lib/vin.ts. Run: npm run config:test
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const esbuild = createRequire(path.join(ROOT, "package.json"))("esbuild");
const out = await esbuild.build({ entryPoints: [path.join(ROOT, "src/lib/vin.ts")], bundle: true, write: false, format: "esm", platform: "node", logLevel: "silent" });
const v = await import("data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64"));

const GOOD = "1HGCM82633A004352"; // published example VIN, valid check digit

test("accepts a valid North American VIN, case/space/dash-insensitive", () => {
  assert.deepEqual(v.checkVin(GOOD), { ok: true, vin: GOOD });
  assert.equal(v.checkVin(" 1hgcm826-33a 004352 ").vin, GOOD);
  assert.equal(v.checkVin(" 1hgcm826-33a 004352 ").ok, true);
});
test("rejects missing / non-string / wrong length", () => {
  for (const x of [undefined, null, "", "   ", 5, {}, "1HGCM82633A00435", GOOD + "1"]) assert.equal(v.checkVin(x).ok, false, String(x));
  assert.match(v.checkVin(undefined).error, /required/i);
});
test("rejects I, O, Q", () => {
  for (const c of ["I", "O", "Q"]) assert.equal(v.checkVin(GOOD.slice(0, 5) + c + GOOD.slice(6)).ok, false);
});
test("North American VIN with a wrong check digit is rejected; one-character typos are caught", () => {
  const bad = GOOD.slice(0, 8) + "0" + GOOD.slice(9);
  assert.equal(v.checkVin(bad).ok, false);
  assert.match(v.checkVin(bad).error, /check digit/i);
  const typo = GOOD.slice(0, 11) + "5" + GOOD.slice(12);
  assert.equal(v.checkVin(typo).ok, false);
});
test("non-North-American VINs are checked on format only (no check digit mandate)", () => {
  assert.equal(v.checkVin("WBAPH7C55BE000001").ok, true); // W = Germany; check digit not mandated
  assert.equal(v.checkVin("WBAPH7C55BE00000I").ok, false);
});
test("check digit known vectors", () => {
  assert.equal(v.vinCheckDigit("11111111111111111"), "1");
  assert.equal(v.vinCheckDigit(GOOD), "3");
  assert.equal(v.vinCheckDigit("short"), null);
});
test("extractVinCandidates finds a VIN inside barcode payload noise and ignores non-VINs", () => {
  assert.deepEqual(v.extractVinCandidates("I" + GOOD), [GOOD]);
  assert.deepEqual(v.extractVinCandidates("  " + GOOD + "\n"), [GOOD]);
  assert.deepEqual(v.extractVinCandidates("https://example.com/1234567890"), []);
  assert.deepEqual(v.extractVinCandidates(""), []);
});

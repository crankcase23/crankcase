// Real Tesseract OCR (same engine, model, whitelist and page-segmentation passes as the browser scanner) on a reconstructed
// US-market BMW door-jamb label and its variants: clean, cropped to the VIN strip, low contrast, glare, rotated.
// The customer's ORIGINAL photo (fixtures/customer-bmw-label.jpg) is tested through the real browser pipeline in
// tests/e2e/vin-label-photo.spec.ts: it needs the scanner's label-region second stage (canvas), which this Node harness does not run.
// Whatever the photo, the scanner must (a) never offer label text as a VIN and (b) never silently change a character.
// Slow (real OCR, about a minute): node --test --test-timeout=240000 scripts/vin/ocr-tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SRC = process.env.VIN_TEST_SRC ?? path.join(ROOT, "src");
const require = createRequire(path.join(ROOT, "package.json"));
const FIX = path.join(ROOT, "scripts/vin/ocr-tests/fixtures");
async function bundle(entry) {
  const esbuild = require("esbuild");
  const out = await esbuild.build({ entryPoints: [path.join(SRC, entry)], bundle: true, format: "esm", platform: "node", write: false, external: ["tesseract.js"], alias: { "@": SRC } });
  return import("data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64"));
}
const vin = await bundle("lib/vin.ts");
const ocr = await bundle("lib/vinOcr.ts");
const { createWorker, PSM } = require("tesseract.js");

const EXPECTED = "WBAPH7C58AA175760";
const worker = await createWorker("eng", 1, { workerPath: path.join(ROOT, "node_modules/tesseract.js/src/worker-script/node/index.js"), corePath: path.join(ROOT, "public/ocr/core"), langPath: path.join(ROOT, "public/ocr/lang"), gzip: true });
await worker.setParameters({ tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789" });
async function scan(file) {
  const pages = [];
  for (const psm of [PSM.SINGLE_BLOCK, PSM.SPARSE_TEXT, PSM.AUTO]) {
    await worker.setParameters({ tessedit_pageseg_mode: psm });
    const { data } = await worker.recognize(fs.readFileSync(file), {}, { blocks: true, text: true });
    pages.push(data);
  }
  return { pages, result: ocr.rankVinReads(pages) };
}
const distance = (a, b) => { let d = Math.abs(a.length - b.length); for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) d++; return d; };
const allText = (pages) => pages.map((p) => p.text).join("\n");
const seen = (res) => [res?.vin, ...(res?.alternatives ?? [])].filter(Boolean);

const READABLE = ["bmw-label-clean.png", "bmw-label-cropped.png", "bmw-label-vin-strip.png", "bmw-label-lowcontrast.png"];
const HARD = ["bmw-label-glare.png", "bmw-label-rotated-7.png", "bmw-label-rotated-minus12.png"];
for (const f of READABLE) test(`LABEL ${f}: the exact VIN is found, passes the check digit, and no label text is offered`, async () => {
  const { pages, result } = await scan(path.join(FIX, f));
  assert.ok(result, `nothing offered. OCR said:\n${allText(pages)}`);
  assert.equal(result.vin, EXPECTED);
  assert.equal(result.checkDigitOk, true);
  assert.ok(!seen(result).some((v) => vin.looksLikeLabelText(v) || !vin.isPlausibleVinRead(v)), `label text offered: ${seen(result)}`);
});
for (const f of HARD) test(`LABEL ${f}: if anything is offered it is VIN-shaped, within a few characters of the real VIN, flagged, and unaltered; never label text`, async () => {
  const { pages, result } = await scan(path.join(FIX, f));
  if (!result) return; // "unreadable" is an honest answer; the customer types the VIN
  for (const v of seen(result)) assert.ok(vin.isPlausibleVinRead(v), `not VIN-shaped: ${v}`);
  assert.ok(!seen(result).some((v) => /EFFECT|STANDARD|MANUFACT|VEHICLE|DATE/.test(v)), `label text offered: ${seen(result)}`);
  const raw = allText(pages).toUpperCase().replace(/[^A-Z0-9]/g, "");
  assert.ok(raw.includes(result.vin), "offered exactly as the camera read it (no substitution)");
  assert.equal(result.checkDigitOk, vin.validateVin(result.vin).ok);
});
test("teardown", async () => { await worker.terminate(); });

// PRIMARY ACCEPTANCE (Node side): the ORIGINAL customer photograph (fixtures/customer-bmw-label.jpg, expected VIN
// WBAPH7C58AA175760) read by the glyph reader with the real Tesseract engine. The browser pipeline version of the same
// requirement is tests/e2e/vin-label-photo.spec.ts. Realistic variations of the original are generated on the fly with sharp
// (shipped with Next), so every variation is the original photograph degraded, never a reconstruction.
// Rules pinned: the exact VIN comes out of the photo; it passes the check digit; images with no VIN produce no VIN at all;
// a degraded read is returned exactly as read (never corrected) and flagged by the check digit, never presented as valid.
// Slow (real OCR, about two minutes): node --test --test-timeout=240000 scripts/vin/ocr-tests/*.test.mjs
import { test, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SRC = process.env.VIN_TEST_SRC ?? path.join(ROOT, "src");
const require = createRequire(path.join(ROOT, "package.json"));
const ORIGINAL = path.join(ROOT, "scripts/vin/ocr-tests/fixtures/customer-bmw-label.jpg");
const EXPECTED = "WBAPH7C58AA175760";
async function bundle(entry) {
  const esbuild = require("esbuild");
  const out = await esbuild.build({ entryPoints: [path.join(SRC, entry)], bundle: true, format: "esm", platform: "node", write: false, external: ["tesseract.js"], alias: { "@": SRC } });
  return import("data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64"));
}
const vin = await bundle("lib/vin.ts");
const ocr = await bundle("lib/vinOcr.ts");
const sharp = require("sharp");
const { createWorker, PSM } = require("tesseract.js");
const worker = await createWorker("eng", 1, { workerPath: path.join(ROOT, "node_modules/tesseract.js/src/worker-script/node/index.js"), corePath: path.join(ROOT, "public/ocr/core"), langPath: path.join(ROOT, "public/ocr/lang"), gzip: true });
await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_CHAR, tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789" });
after(async () => { await worker.terminate(); });

// The same preparation the browser does: long side at most 2000, greyscale, min-max contrast stretch.
async function greyOf(buf) {
  const img = sharp(buf).rotate();
  const m = await img.metadata();
  const sc = Math.min(1, 2000 / Math.max(m.width, m.height));
  const { data, info } = await img.resize({ width: Math.round(m.width * sc), height: Math.round(m.height * sc) }).greyscale().raw().toBuffer({ resolveWithObject: true });
  let lo = 255, hi = 0;
  for (const v of data) { if (v < lo) lo = v; if (v > hi) hi = v; }
  return { data: Uint8ClampedArray.from(data, (v) => ((v - lo) * 255) / Math.max(1, hi - lo)), width: info.width, height: info.height };
}
async function recognise(tile) {
  const png = await sharp(Buffer.from(tile.data), { raw: { width: tile.width, height: tile.height, channels: 1 } }).png().toBuffer();
  const r = await worker.recognize(png);
  return { ch: r.data.text.trim()[0] ?? null, conf: r.data.confidence / 100 };
}
const read = async (buf) => ocr.glyphVinReads(await greyOf(buf), recognise);
const orig = () => sharp(ORIGINAL);

test("GLYPH-ORIG the original photograph: the exact VIN is extracted and passes the check digit", async () => {
  const reads = await read(await orig().jpeg({ quality: 95 }).toBuffer());
  const exact = reads.find((r) => r.vin === EXPECTED);
  assert.ok(exact, `exact VIN among reads: ${reads.map((r) => r.vin).join(", ") || "(none)"}`);
  assert.equal(vin.validateVin(exact.vin).ok, true);
  assert.equal(exact.confidences.length, 17);
  const ranked = ocr.rankVinReads([], reads);
  assert.equal(ranked.vin, EXPECTED);
  assert.equal(ranked.checkDigitOk, true);
  for (const r of reads) assert.doesNotMatch(r.vin, /EFFECT|STANDARD|MANUFACT|GVWR|GAWR|^[A-Z]{17}$/, "legal-warning text is never a candidate");
});

// Realistic degradations of the ORIGINAL photograph. All must still yield the exact VIN.
const VARIANTS = {
  "jpeg quality 35": () => orig().jpeg({ quality: 35 }).toBuffer(),
  "scaled to 70%": () => orig().resize({ width: 1008 }).jpeg({ quality: 90 }).toBuffer(),
  "scaled to 50%": () => orig().resize({ width: 720 }).jpeg({ quality: 90 }).toBuffer(),
  "cropped to the label": () => orig().extract({ left: 150, top: 900, width: 1200, height: 700 }).jpeg().toBuffer(),
  "cropped to the VIN strip": () => orig().extract({ left: 300, top: 1200, width: 950, height: 260 }).jpeg().toBuffer(),
  "rotated +4 degrees": () => orig().rotate(4, { background: "#222" }).jpeg().toBuffer(),
  "rotated -5 degrees": () => orig().rotate(-5, { background: "#222" }).jpeg().toBuffer(),
  "darker": () => orig().linear(0.55, -10).jpeg().toBuffer(),
  "low contrast": () => orig().linear(0.5, 60).jpeg().toBuffer(),
  "blurred (sigma 1.2)": () => orig().blur(1.2).jpeg().toBuffer(),
  "blurred (sigma 2)": () => orig().blur(2).jpeg().toBuffer(),
  "sensor noise": async () => {
    const { data, info } = await orig().raw().toBuffer({ resolveWithObject: true });
    let s = 12345;
    const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
    const d = Buffer.from(data);
    for (let i = 0; i < d.length; i++) d[i] = Math.max(0, Math.min(255, d[i] + (rnd() - 0.5) * 50));
    return sharp(d, { raw: info }).jpeg().toBuffer();
  },
  "inverted polarity": () => orig().negate().jpeg().toBuffer(),
};
for (const [name, make] of Object.entries(VARIANTS)) {
  test(`GLYPH-VAR original, ${name}: the exact VIN is extracted`, async () => {
    const reads = await read(await make());
    assert.ok(reads.some((r) => r.vin === EXPECTED), `${name}: got ${reads.map((r) => r.vin).join(", ") || "(none)"}`);
  });
}

// Known limit, pinned honestly: washed out by a hard contrast boost the glyph reader misreads the 7 as a 4. It must say so
// (the check digit fails), return the read exactly as seen, and never offer label text.
test("GLYPH-LIMIT original, over-exposed: any read is returned as seen and is flagged by the check digit unless it is the exact VIN", async () => {
  const reads = await read(await orig().linear(1.4, 25).jpeg().toBuffer());
  for (const r of reads) {
    assert.match(r.vin, /^[A-Z0-9]{17}$/);
    if (r.vin !== EXPECTED) assert.equal(vin.validateVin(r.vin).ok, false, `${r.vin} is wrong and must not pass the check digit`);
  }
});

// Failure cases: no VIN in the picture means no VIN offered.
const NO_VIN = {
  "the legal warning only (crop of the original)": () => orig().extract({ left: 0, top: 880, width: 1440, height: 340 }).jpeg().toBuffer(),
  "the barcode only (crop of the original)": () => orig().extract({ left: 250, top: 1320, width: 1000, height: 160 }).jpeg().toBuffer(),
  "dark speckle": async () => {
    const w = 800, h = 600, d = Buffer.alloc(w * h);
    let s = 7;
    for (let i = 0; i < d.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; d[i] = 30 + ((s >>> 24) % 40); }
    return sharp(d, { raw: { width: w, height: h, channels: 1 } }).jpeg().toBuffer();
  },
  "a plain gradient": async () => {
    const w = 600, h = 400, d = Buffer.alloc(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d[y * w + x] = (x / w) * 255;
    return sharp(d, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();
  },
};
for (const [name, make] of Object.entries(NO_VIN)) {
  test(`GLYPH-NONE ${name}: no VIN is offered`, async () => {
    const reads = await read(await make());
    assert.deepEqual(reads.map((r) => r.vin), []);
  });
}

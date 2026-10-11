// fit-frame: pad-never-stretch fitting of native generator output into the exact 16:10 frame. SYNTHETIC images only.
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const F = path.join(ROOT, "scripts/visuals/factory-reconstructed/src/");
const { fitToFrame, MAX_PAD } = await import(path.join(ROOT, "scripts/bmw/fit-frame.mjs"));
const { encodePng, decodePng } = await import(F + "png.mjs");
const { normalizeRaster } = await import(F + "normalize.mjs");
const { describeRaster } = await import(F + "provenance.mjs");

/** dark graphite field with a bright block in the middle; `edge` paints a bright stripe on the left edge */
function img(w, h, { edge = false, caBX = false } = {}) {
  const px = Buffer.alloc(w * h * 3, 24);
  for (let y = h * 0.35; y < h * 0.65; y++) for (let x = w * 0.3; x < w * 0.7; x++) { const o = (Math.floor(y) * w + Math.floor(x)) * 3; px[o] = 230; px[o + 1] = 200; px[o + 2] = 40; }
  if (edge) for (let y = 0; y < h; y++) for (let x = 0; x < 8; x++) { const o = (y * w + x) * 3; px[o] = px[o + 1] = px[o + 2] = (y % 2) * 255; }
  return encodePng({ width: w, height: h, channels: 3, pixels: px }, { extraChunks: caBX ? [{ type: "caBX", data: Buffer.from("synthetic-c2pa") }] : [] });
}

test("native 3:2 is padded to an exact 16:10 canvas, content untouched, never stretched", () => {
  const r = fitToFrame(img(1536, 1024, { caBX: true }));
  assert.ok(r.ok, JSON.stringify(r));
  const d = describeRaster(r.bytes);
  assert.equal(d.width * 10, d.height * 16, "exact 16:10");
  assert.ok(d.width >= 1600 && d.height >= 1000);
  assert.deepEqual([r.record.stretched, r.record.cropped, r.record.upscaled, r.record.contentPixelsUnchanged], [false, false, false, true]);
  assert.equal(r.record.native.width, 1536);
  assert.equal(r.record.native.c2pa.present, true, "native C2PA presence is recorded");
  assert.ok(r.record.paddedFractionOfCanvas <= MAX_PAD);
  // the native block is where it was, shifted by the left pad only
  const out = decodePng(r.bytes), src = decodePng(img(1536, 1024));
  const o = ((512 + r.record.pad.top) * out.width + 768 + r.record.pad.left) * 3, s = (512 * 1536 + 768) * 3;
  assert.deepEqual([...out.pixels.subarray(o, o + 3)], [...src.pixels.subarray(s, s + 3)]);
  // the factory's own normaliser accepts it and lands on exactly 1600x1000
  const n = normalizeRaster(r.bytes);
  assert.deepEqual([n.normalized.width, n.normalized.height], [1600, 1000]);
});

test("an image already exactly 16:10 and large enough needs no padding", () => {
  const r = fitToFrame(img(1600, 1000));
  assert.ok(r.ok);
  assert.deepEqual(r.record.pad, { left: 0, right: 0, top: 0, bottom: 0 });
});

test("refused: square, portrait, too small, JPEG, busy edges; plain light ground accepted", () => {
  assert.equal(fitToFrame(img(1024, 1024)).code, "RATIO_TOO_FAR");
  assert.equal(fitToFrame(img(1024, 1536)).code, "RATIO_TOO_FAR");
  assert.equal(fitToFrame(img(1280, 800)).code, "TOO_SMALL");
  assert.equal(fitToFrame(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])).code, "NOT_PNG");
  assert.equal(fitToFrame(img(1536, 1024, { edge: true })).code, "BORDER_NOT_PLAIN");
  const light = Buffer.alloc(1536 * 1024 * 3, 235);
  assert.ok(fitToFrame(encodePng({ width: 1536, height: 1024, channels: 3, pixels: light })).ok, "a plain LIGHT neutral ground (CG-VS-1.0) is accepted");
});

test("fitting is deterministic", () => {
  const a = fitToFrame(img(1536, 1024)), b = fitToFrame(img(1536, 1024));
  assert.equal(a.record.fitted.sha256, b.record.fitted.sha256);
});

test("native just under the 1600x1000 minimum is padded up to it, never upscaled", () => {
  const r = fitToFrame(img(1586, 992));
  assert.ok(r.ok, JSON.stringify(r));
  const d = describeRaster(r.bytes);
  assert.deepEqual([d.width, d.height], [1600, 1000]);
  assert.equal(r.record.upscaled, false);
  assert.equal(r.record.contentPixelsUnchanged, true);
  assert.equal(fitToFrame(img(1400, 875)).code, "TOO_SMALL", "more than MAX_PAD short is still refused");
});

// RECONSTRUCTED TEST suite — normalization contract (VD arch §4 + recovered GeneratedRasterRecord rules).
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeRaster, NormalizationRefused } from "../src/normalize.mjs";
import { decodePng, encodePng, resizeBox, parsePng } from "../src/png.mjs";
import { describeRaster } from "../src/provenance.mjs";
import { RASTER_OPS, NORMALIZER_VERSION } from "../src/enums.mjs";
import { synthPng, caBX, tEXt } from "./support/fixtures.mjs";

test("RECONSTRUCTED TEST: normalization strips every metadata chunk (C2PA recorded on the source), hashes are distinct, frame is 1600x1000", () => {
  const src = synthPng(1600, 1000, { seed: 3, chunks: [caBX("c2pa"), tEXt("Comment", "hello")] });
  const r = normalizeRaster(src);
  assert.equal(r.source.c2pa.present, true);
  assert.deepEqual(r.source.metadataChunks.sort(), ["caBX", "tEXt"]);
  assert.deepEqual(r.normalized.metadataChunks, []);
  assert.notEqual(r.normalized.sha256, r.source.sha256);
  assert.deepEqual([r.normalized.width, r.normalized.height], [1600, 1000]);
  assert.deepEqual(parsePng(r.bytes).chunks.map((c) => c.type), ["IHDR", "IDAT", "IEND"]);
  assert.deepEqual(r.normalized.normalizer.ops, RASTER_OPS);
  assert.equal(r.normalized.normalizer.version, NORMALIZER_VERSION);
  assert.equal(r.downscaled, false);
});

test("RECONSTRUCTED TEST: same-size normalization preserves every pixel (it cannot change what the picture shows)", () => {
  const src = synthPng(1600, 1000, { seed: 4, chunks: [tEXt()] });
  assert.ok(decodePng(src).pixels.equals(decodePng(normalizeRaster(src).bytes).pixels));
});

test("RECONSTRUCTED TEST: a larger 16:10 source is downscaled (never upscaled) to exactly 1600x1000", () => {
  const r = normalizeRaster(synthPng(2000, 1250, { seed: 5 }));
  assert.equal(r.downscaled, true);
  assert.deepEqual([r.normalized.width, r.normalized.height], [1600, 1000]);
});

test("RECONSTRUCTED TEST: normalization refuses upscaling, wrong aspect, animated, unreadable, and unsupported PNG variants", () => {
  const code = (b) => { try { normalizeRaster(b); } catch (e) { assert.ok(e instanceof NormalizationRefused); return e.code; } return null; };
  assert.equal(code(synthPng(1280, 800)), "UPSCALE_REFUSED");
  assert.equal(code(synthPng(1600, 1200)), "ASPECT");
  assert.equal(code(synthPng(1600, 1000, { chunks: [{ type: "acTL", data: Buffer.alloc(8) }] })), "ANIMATED");
  assert.equal(code(Buffer.from("not a png")), "SOURCE_UNREADABLE");
  assert.throws(() => resizeBox({ width: 2, height: 2, channels: 3, colorType: 2, pixels: Buffer.alloc(12) }, 4, 4), /upscaling/);
});

test("RECONSTRUCTED TEST: a source already identical to its normalized form is refused (resolver requires distinct hashes) — UNRESOLVED U-09", () => {
  const once = normalizeRaster(synthPng(1600, 1000, { seed: 6 })).bytes;
  assert.throws(() => normalizeRaster(once), (e) => e.code === "HASH_COLLISION");
});

test("RECONSTRUCTED TEST: normalization is deterministic (identical bytes in -> identical bytes and hash out)", () => {
  const src = synthPng(2000, 1250, { seed: 7, chunks: [caBX()] });
  assert.equal(normalizeRaster(src).normalized.sha256, normalizeRaster(Buffer.from(src)).normalized.sha256);
});

test("RECONSTRUCTED TEST: box downscale averages (2x2 -> 1x1 of [0,100,200,40] = 85)", () => {
  const img = { width: 2, height: 2, channels: 1, colorType: 0, pixels: Buffer.from([0, 100, 200, 40]) };
  assert.equal(resizeBox(img, 1, 1).pixels[0], 85);
});

test("RECONSTRUCTED TEST: PNG codec round-trips and decodes all five filter types", () => {
  const px = Buffer.from(Array.from({ length: 5 * 4 * 3 }, (_, i) => (i * 37) & 255));
  const rt = decodePng(encodePng({ width: 5, height: 4, channels: 3, pixels: px }));
  assert.ok(rt.pixels.equals(px));
  assert.equal(describeRaster(encodePng({ width: 5, height: 4, channels: 3, pixels: px })).width, 5);
});

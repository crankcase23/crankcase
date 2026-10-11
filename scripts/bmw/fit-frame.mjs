#!/usr/bin/env node
// Fit a generator's NATIVE PNG (for example ChatGPT's 3:2 landscape) into the factory's exact 16:10 frame WITHOUT stretching.
//
// The factory refuses anything that is not exactly 16:10 and at least 1600x1000, and its normaliser only downscales uniformly.
// ChatGPT image output is a fixed native ratio, so before drop-import the native file is padded (never stretched, never
// cropped, never upscaled) out to the nearest exact 16:10 canvas, then the factory's own normaliser downscales it to 1600x1000.
//
// Geometry rules (all validated, any failure refuses with a code and writes nothing):
//   * input must be PNG (8-bit, non-interlaced), not animated. Export the ChatGPT image as PNG.
//   * 1:1 pixel scale: the native pixels are copied unchanged into the canvas (verified after the fact).
//   * padding only on the short axis, at most MAX_PAD (12%) of the canvas side; wider ratios (square, portrait) are refused: regenerate landscape.
//   * the native edges that touch the padding must be plain (low variance; any brightness, since the CG-VS-1.0 ground is light
//     neutral). Otherwise content touches the edge and padding would smear it: refused.
//   * the native image must already be large enough: after fitting, the canvas must be >= 1600x1000 (upscaling is not allowed).
// The native file's hash, dimensions, C2PA presence and every operation are written to a fit record that travels with the
// candidate into the QA packet, so the reviewer and the owner can see exactly what was done.
//
//   node scripts/bmw/fit-frame.mjs --in native.png --out-dir DIR      writes DIR/candidate.png and DIR/candidate.fit-record.json
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const FACT = path.join(ROOT, "scripts/visuals/factory-reconstructed");
const { decodePng, encodePng, parsePng, hasPngMagic, isAnimated, c2paInfo, metadataChunkTypes } = await import(path.join(FACT, "src/png.mjs"));
const { sha256 } = await import(path.join(FACT, "src/canon.mjs"));
const { FRAME } = await import(path.join(FACT, "src/enums.mjs"));

export const MAX_PAD = 0.12;
const STRIP = 6; // px of native edge sampled for the plainness check
const MAX_STD = 20; // per-channel standard deviation allowed along a padded edge

const refuse = (code, message) => ({ ok: false, code, message });
const luma = (p, o, ch) => (ch >= 3 ? 0.2126 * p[o] + 0.7152 * p[o + 1] + 0.0722 * p[o + 2] : p[o]);

function edgeStats(img, side) {
  const { width: w, height: h, channels: ch, pixels: p } = img;
  const vals = [];
  const take = (x, y) => vals.push(luma(p, (y * w + x) * ch, ch));
  if (side === "left") for (let y = 0; y < h; y++) for (let x = 0; x < STRIP; x++) take(x, y);
  if (side === "right") for (let y = 0; y < h; y++) for (let x = w - STRIP; x < w; x++) take(x, y);
  if (side === "top") for (let y = 0; y < STRIP; y++) for (let x = 0; x < w; x++) take(x, y);
  if (side === "bottom") for (let y = h - STRIP; y < h; y++) for (let x = 0; x < w; x++) take(x, y);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const std = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
  return { mean, std };
}

/** Pure function: bytes in -> {ok, bytes, record} or {ok:false, code, message}. */
export function fitToFrame(bytes) {
  if (!hasPngMagic(bytes)) return refuse("NOT_PNG", "input is not a PNG; export the image as PNG");
  let parsed, img;
  try { parsed = parsePng(bytes); img = decodePng(bytes); } catch (e) { return refuse("UNREADABLE", e.message); }
  if (isAnimated(parsed.chunks)) return refuse("ANIMATED", "animated PNG refused");
  const { width: W, height: H, channels: ch, pixels } = img;
  let base = Math.max(H, Math.ceil((W * FRAME.aspectH) / FRAME.aspectW));
  // A native image just under the 1600x1000 minimum (for example 1586x992) is PADDED up to it, never upscaled. Anything more than
  // MAX_PAD short of the minimum is refused: that would need a real upscale or heavy padding.
  if (base < FRAME.height) {
    if ((FRAME.height - base) / FRAME.height > MAX_PAD) return refuse("TOO_SMALL", `${W}x${H} is too small for ${FRAME.width}x${FRAME.height}; upscaling is not allowed`);
    base = FRAME.height;
  }
  const Hc = Math.ceil(base / FRAME.aspectH) * FRAME.aspectH; // multiple of 10 => exact integer width at 16:10
  const Wc = (Hc / FRAME.aspectH) * FRAME.aspectW;
  const padW = Wc - W, padH = Hc - H;
  if (padW < 0 || padH < 0) return refuse("INTERNAL", "canvas smaller than the image");
  const frac = Math.max(padW / Wc, padH / Hc);
  if (frac > MAX_PAD) return refuse("RATIO_TOO_FAR", `${W}x${H} needs ${(frac * 100).toFixed(1)}% padding to reach 16:10 (limit ${MAX_PAD * 100}%); regenerate as a landscape image`);
  const pad = { left: Math.floor(padW / 2), right: padW - Math.floor(padW / 2), top: Math.floor(padH / 2), bottom: padH - Math.floor(padH / 2) };
  const sides = Object.entries(pad).filter(([, v]) => v > 0).map(([k]) => k);
  const edges = {};
  for (const s of sides) {
    const st = edgeStats(img, s);
    edges[s] = { mean: Math.round(st.mean * 10) / 10, std: Math.round(st.std * 10) / 10 };
    if (st.std > MAX_STD) return refuse("BORDER_NOT_PLAIN", `the ${s} edge of the image is not a plain background (mean ${st.mean.toFixed(0)}, std ${st.std.toFixed(0)}); padding would smear content. Regenerate with more empty margin`);
  }
  // build the canvas: native pixels 1:1 in the middle, edge pixels replicated into the padding
  const out = Buffer.alloc(Wc * Hc * ch);
  for (let y = 0; y < Hc; y++) {
    const sy = Math.min(H - 1, Math.max(0, y - pad.top));
    for (let x = 0; x < Wc; x++) {
      const sx = Math.min(W - 1, Math.max(0, x - pad.left));
      pixels.copy(out, (y * Wc + x) * ch, (sy * W + sx) * ch, (sy * W + sx) * ch + ch);
    }
  }
  // post-condition: the native pixels are unchanged and unscaled
  for (let y = 0; y < H; y++) {
    const a = pixels.subarray(y * W * ch, (y + 1) * W * ch);
    const b = out.subarray(((y + pad.top) * Wc + pad.left) * ch, ((y + pad.top) * Wc + pad.left + W) * ch);
    if (!a.equals(b)) return refuse("CONTENT_CHANGED", `native row ${y} differs in the canvas`);
  }
  const fitted = encodePng({ width: Wc, height: Hc, channels: ch, pixels: out }, { level: 6 }); // level 6 on purpose: the factory normaliser re-encodes at level 9 and refuses a candidate whose bytes equal its output (HASH_COLLISION)
  const record = {
    schema: "bmw-fit-record.v1",
    native: { sha256: sha256(bytes), bytes: bytes.length, width: W, height: H, ratio: Math.round((W / H) * 10000) / 10000, ancillaryChunks: metadataChunkTypes(parsed.chunks), c2pa: c2paInfo(parsed.chunks) },
    fitted: { sha256: sha256(fitted), bytes: fitted.length, width: Wc, height: Hc, ratio: Wc / Hc },
    ops: ["pad-edge-replicate"],
    pad, paddedFractionOfCanvas: Math.round(frac * 10000) / 10000, paddedEdgeStats: edges,
    stretched: false, cropped: false, upscaled: false, contentPixelsUnchanged: true,
    note: "Padding only. The factory normaliser then downscales this exact 16:10 canvas uniformly to 1600x1000 and strips metadata.",
  };
  return { ok: true, bytes: fitted, record };
}

export function fitFile(inFile, outDir) {
  const r = fitToFrame(fs.readFileSync(inFile));
  if (!r.ok) return r;
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "candidate.png"), r.bytes);
  fs.writeFileSync(path.join(outDir, "candidate.fit-record.json"), JSON.stringify(r.record, null, 2) + "\n");
  return { ok: true, record: r.record, dir: outDir };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2);
  const arg = (n) => { const i = a.indexOf(`--${n}`); return i >= 0 ? a[i + 1] : undefined; };
  if (!arg("in") || !arg("out-dir")) { console.error("usage: fit-frame.mjs --in native.png --out-dir DIR"); process.exit(2); }
  const r = fitFile(path.resolve(arg("in")), path.resolve(arg("out-dir")));
  console.log(JSON.stringify(r.ok ? { ok: true, native: r.record.native, fitted: r.record.fitted, pad: r.record.pad } : r, null, 2));
  process.exitCode = r.ok ? 0 : 1;
}

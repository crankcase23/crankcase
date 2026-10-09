// RECONSTRUCTED-V1 | NOT the lost original.
// Minimal dependency-free PNG codec so normalization is deterministic and testable without sharp.
// Source for requirements: VD arch §4 (rasterProblems: magic bytes, dimensions 16:10 >= 1600x1000, downscale only,
// not animated, metadata stripped, C2PA presence RECORDED not required). The original used `sharp` (INFERRED from
// scripts/visuals/lib.mjs header); its encoder output bytes are UNKNOWN and are NOT reproduced here.
// Supports 8-bit, non-interlaced, colour types 0 (gray), 2 (RGB), 6 (RGBA). Anything else -> UnsupportedPng.
import zlib from "node:zlib";
import { sha256 } from "./canon.mjs";

export const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
export class UnsupportedPng extends Error {}
export class MalformedPng extends Error {}
const CRITICAL = new Set(["IHDR", "PLTE", "IDAT", "IEND", "tRNS"]);
const CHANNELS = { 0: 1, 2: 3, 6: 4 };

export const hasPngMagic = (b) => Buffer.isBuffer(b) && b.length >= 8 && b.subarray(0, 8).equals(PNG_SIG);

export function parsePng(buf) {
  if (!hasPngMagic(buf)) throw new MalformedPng("bad PNG signature");
  const chunks = [];
  let off = 8;
  while (off < buf.length) {
    if (off + 12 > buf.length) throw new MalformedPng("truncated chunk header");
    const len = buf.readUInt32BE(off);
    const type = buf.toString("latin1", off + 4, off + 8);
    if (off + 12 + len > buf.length) throw new MalformedPng(`truncated chunk ${type}`);
    const data = buf.subarray(off + 8, off + 8 + len);
    const crc = buf.readUInt32BE(off + 8 + len);
    if (zlib.crc32(buf.subarray(off + 4, off + 8 + len)) !== crc) throw new MalformedPng(`bad CRC in ${type}`);
    chunks.push({ type, data });
    off += 12 + len;
    if (type === "IEND") break;
  }
  if (chunks[0]?.type !== "IHDR") throw new MalformedPng("IHDR missing/not first");
  if (chunks.at(-1)?.type !== "IEND") throw new MalformedPng("IEND missing");
  const h = chunks[0].data;
  return { width: h.readUInt32BE(0), height: h.readUInt32BE(4), bitDepth: h[8], colorType: h[9], interlace: h[12], chunks };
}

export const metadataChunkTypes = (chunks) => [...new Set(chunks.map((c) => c.type).filter((t) => !CRITICAL.has(t)))];
export const isAnimated = (chunks) => chunks.some((c) => c.type === "acTL");
/** C2PA content credentials ride in the `caBX` chunk (JUMBF). VD: presence is RECORDED, not required. */
export function c2paInfo(chunks) {
  const c = chunks.filter((x) => x.type === "caBX");
  return c.length ? { present: true, manifestSha256: sha256(Buffer.concat(c.map((x) => x.data))) } : { present: false };
}

export function decodePng(buf) {
  const p = parsePng(buf);
  if (p.bitDepth !== 8 || p.interlace !== 0 || !CHANNELS[p.colorType]) throw new UnsupportedPng(`unsupported PNG (depth ${p.bitDepth}, colorType ${p.colorType}, interlace ${p.interlace})`);
  const ch = CHANNELS[p.colorType];
  const raw = zlib.inflateSync(Buffer.concat(p.chunks.filter((c) => c.type === "IDAT").map((c) => c.data)));
  const stride = p.width * ch;
  if (raw.length !== (stride + 1) * p.height) throw new MalformedPng("IDAT length does not match IHDR");
  const px = Buffer.alloc(stride * p.height);
  for (let y = 0; y < p.height; y++) {
    const f = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? px[y * stride + x - ch] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= ch && y > 0 ? px[(y - 1) * stride + x - ch] : 0;
      let v;
      switch (f) {
        case 0: v = src[x]; break;
        case 1: v = src[x] + a; break;
        case 2: v = src[x] + b; break;
        case 3: v = src[x] + ((a + b) >> 1); break;
        case 4: { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v = src[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); break; }
        default: throw new MalformedPng(`bad filter type ${f}`);
      }
      px[y * stride + x] = v & 255;
    }
  }
  return { width: p.width, height: p.height, channels: ch, colorType: p.colorType, pixels: px };
}

const chunk = (type, data) => {
  const t = Buffer.from(type, "latin1");
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0); t.copy(out, 4); data.copy(out, 8);
  out.writeUInt32BE(zlib.crc32(Buffer.concat([t, data])), 8 + data.length);
  return out;
};
export const makeChunk = chunk;

/** Encode with filter 0 on every row; fixed zlib level => deterministic for a given Node/zlib build. */
export function encodePng({ width, height, channels, pixels }, { level = 9, extraChunks = [] } = {}) {
  const colorType = { 1: 0, 3: 2, 4: 6 }[channels];
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = colorType;
  const stride = width * channels;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) { raw[y * (stride + 1)] = 0; pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride); }
  const parts = [PNG_SIG, chunk("IHDR", ihdr), ...extraChunks.map((c) => chunk(c.type, c.data)), chunk("IDAT", zlib.deflateSync(raw, { level })), chunk("IEND", Buffer.alloc(0))];
  return Buffer.concat(parts);
}

/** Area-average downscale. Refuses to upscale (VD: "downscale only"). */
export function resizeBox(img, w, h) {
  if (w > img.width || h > img.height) throw new Error("resizeBox: upscaling is not allowed");
  if (w === img.width && h === img.height) return img;
  const { channels: ch, width: sw, height: sh, pixels: sp } = img;
  const out = Buffer.alloc(w * h * ch);
  const xs = sw / w, ys = sh / h;
  for (let y = 0; y < h; y++) {
    const y0 = y * ys, y1 = (y + 1) * ys;
    for (let x = 0; x < w; x++) {
      const x0 = x * xs, x1 = (x + 1) * xs;
      const acc = new Float64Array(ch); let wsum = 0;
      for (let yy = Math.floor(y0); yy < Math.min(sh, Math.ceil(y1)); yy++) {
        const wy = Math.min(yy + 1, y1) - Math.max(yy, y0);
        for (let xx = Math.floor(x0); xx < Math.min(sw, Math.ceil(x1)); xx++) {
          const wx = Math.min(xx + 1, x1) - Math.max(xx, x0);
          const wgt = wx * wy; wsum += wgt;
          const o = (yy * sw + xx) * ch;
          for (let c = 0; c < ch; c++) acc[c] += sp[o + c] * wgt;
        }
      }
      for (let c = 0; c < ch; c++) out[(y * w + x) * ch + c] = Math.round(acc[c] / wsum);
    }
  }
  return { width: w, height: h, channels: ch, colorType: img.colorType, pixels: out };
}

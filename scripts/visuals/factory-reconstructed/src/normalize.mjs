// RECONSTRUCTED-V1 | NOT the lost original.
// NORMALIZATION: generator's file -> published derivative.
// Source: VD arch §4 `RASTER_OPS = [decode, resize-to-frame, strip-metadata, png-encode | webp-encode]`;
// "decodes, downscales to 1600x1000 if needed, strips metadata, encodes, and refuses if any gate fails";
// "downscale only"; "metadata stripped (C2PA presence recorded, not required)"; VC types (`normalizedArtifact.normalizer
// {version, tool, ops}`, `metadataChunks` must be empty, source and normalized hashes must be distinct).
// The original normalizer output bytes are NOT reproducible (UNKNOWN encoder). webp: NOT reconstructed.
import { decodePng, encodePng, resizeBox } from "./png.mjs";
import { describeRaster } from "./provenance.mjs";
import { FRAME, NORMALIZER_VERSION, RASTER_OPS } from "./enums.mjs";

export class NormalizationRefused extends Error { constructor(code, msg) { super(msg); this.code = code; } }

/** `_resize` is a TEST SEAM (inject a faulty resizer to prove the dimension post-condition is enforced). Production callers never pass it. */
export function normalizeRaster(bytes, { _resize = resizeBox } = {}) {
  const src = describeRaster(bytes, "png");
  if (src.parseError) throw new NormalizationRefused("SOURCE_UNREADABLE", src.parseError);
  if (src.animated) throw new NormalizationRefused("ANIMATED", "animated source refused");
  if (src.width * FRAME.aspectH !== src.height * FRAME.aspectW) throw new NormalizationRefused("ASPECT", "source is not exactly 16:10");
  if (src.width < FRAME.width || src.height < FRAME.height) throw new NormalizationRefused("UPSCALE_REFUSED", "source smaller than the frame; upscaling is not allowed");
  let img;
  try { img = decodePng(bytes); } catch (e) { throw new NormalizationRefused("DECODE", e.message); }
  const out = _resize(img, FRAME.width, FRAME.height);
  if (out.width !== FRAME.width || out.height !== FRAME.height) throw new NormalizationRefused("DIMENSIONS_CHANGED", `resize produced ${out.width}x${out.height}, expected exactly ${FRAME.width}x${FRAME.height}`);
  const data = encodePng(out); // fresh PNG: IHDR/IDAT/IEND only => every ancillary chunk (incl. caBX C2PA) is gone
  const norm = describeRaster(data, "png");
  if (norm.width !== FRAME.width || norm.height !== FRAME.height) throw new NormalizationRefused("DIMENSIONS_CHANGED", `encoded output is ${norm.width}x${norm.height}, expected exactly ${FRAME.width}x${FRAME.height}`);
  if (norm.metadataChunks.length) throw new NormalizationRefused("METADATA_REMAINS", "normalized file still carries metadata");
  if (norm.sha256 === src.sha256) throw new NormalizationRefused("HASH_COLLISION", "normalized hash equals the source hash (resolver requires them distinct)"); // UNRESOLVED U-09
  return { bytes: data, source: src, normalized: { mediaType: "png", sha256: norm.sha256, bytes: norm.bytes, width: norm.width, height: norm.height, metadataChunks: norm.metadataChunks,
    normalizer: { version: NORMALIZER_VERSION, tool: "reconstructed-png-box-downscale (node zlib)", ops: RASTER_OPS } }, downscaled: src.width !== FRAME.width || src.height !== FRAME.height };
}

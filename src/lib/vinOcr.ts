// VIN photo scan, entirely in the customer's browser. Free: the open-source Tesseract engine and its English model are
// served from our own /ocr folder (scripts/ocr/copy-assets.mjs), so there is no paid API, no CDN, and the photo is never
// uploaded, stored or sent anywhere. Only pixels are used, so the photo's metadata (location, device) never goes anywhere
// either. The picture and the canvas are dropped as soon as the text is read.
//
// What this returns is what the camera READ, character for character. It does not "fix" anything: I/O/Q and low-confidence
// characters come back flagged so the screen can highlight them and the customer must confirm the VIN themselves.

import { findGlyphRuns, readGlyphRun, runScore, type Grey, type GlyphRun, type Recognise } from "@/lib/vinGlyphs";
import { isPlausibleVinRead, looksLikeLabelText, normalizeVin, rankedVinCandidates, scoreVinRead, validateVin, VIN_LENGTH } from "@/lib/vin";

export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
export const MAX_PHOTO_PIXELS = 50_000_000;
const LONG_SIDE = 2000;

export type ScanFailure = "type" | "size" | "dimensions" | "decode" | "unreadable" | "engine";
export type ScanResult =
  | { ok: true; vin: string; confidences: (number | undefined)[]; alternatives: string[]; checkDigitOk: boolean }
  | { ok: false; reason: ScanFailure; message: string };

/** Shown whenever a photo could not be read cleanly (nothing found, or a read that fails the VIN check). Pinned by tests. */
export const RETAKE_TIPS: readonly string[] = [
  "Move closer so the VIN fills most of the frame.",
  "Turn your flash off. It washes out the label.",
  "Photograph the label straight-on, not at an angle.",
];

export const SCAN_MESSAGES: Record<ScanFailure, string> = {
  type: "That file isn't a JPEG, PNG or WebP photo. Take a new photo, or type the VIN.",
  size: "That photo is too large (15 MB limit). Take a new photo, or type the VIN.",
  dimensions: "That image is too large to read safely. Take a new photo, or type the VIN.",
  decode: "We couldn't open that image. Take a new photo, or type the VIN.",
  unreadable: "We couldn't find a 17-character VIN in that photo. Retake the photo (see the tips below) or type the VIN in.",
  engine: "The photo reader couldn't start on this device. Type the VIN instead.",
};
const fail = (reason: ScanFailure): ScanResult => ({ ok: false, reason, message: SCAN_MESSAGES[reason] });

/** What the file really is, from its first bytes (a filename or the browser's type claim proves nothing). */
export function sniffImageType(head: Uint8Array): "jpeg" | "png" | "webp" | null {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "jpeg";
  if (head.length >= 8 && head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47 && head[4] === 0x0d && head[5] === 0x0a && head[6] === 0x1a && head[7] === 0x0a) return "png";
  if (head.length >= 12 && String.fromCharCode(...head.slice(0, 4)) === "RIFF" && String.fromCharCode(...head.slice(8, 12)) === "WEBP") return "webp";
  return null;
}

/** Declared pixel size of a PNG or JPEG, read from the header before anything decodes it (decompression-bomb guard). */
export function declaredPixels(bytes: Uint8Array, kind: "jpeg" | "png" | "webp"): number | null {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (kind === "png") return bytes.length >= 24 ? dv.getUint32(16) * dv.getUint32(20) : null;
  if (kind === "jpeg") {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) { i++; continue; }
      const marker = bytes[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return dv.getUint16(i + 5) * dv.getUint16(i + 7);
      i += 2 + dv.getUint16(i + 2);
    }
    return null;
  }
  return null;
}

type Sym = { text: string; confidence: number };
type Box = { x0: number; y0: number; x1: number; y1: number };
type OcrLine = { bbox?: Box; words?: { symbols?: Sym[] }[] };
type OcrPage = { text?: string; blocks?: { paragraphs?: { lines?: OcrLine[] }[] }[] };

export type VinRead = { vin: string; confidences: (number | undefined)[]; afterVinLabel: boolean };

/** Pairs each candidate with the per-character confidences of the line it was read from. Exported for tests. */
export function candidatesFromPage(page: OcrPage): VinRead[] {
  const out = new Map<string, VinRead>();
  const lines: OcrLine[] = (page.blocks ?? []).flatMap((b) => (b.paragraphs ?? []).flatMap((p) => p.lines ?? []));
  for (const line of lines) {
    const syms = (line.words ?? []).flatMap((w) => w.symbols ?? []).filter((s) => /^[A-Za-z0-9]$/.test(s.text));
    const text = syms.map((s) => s.text.toUpperCase()).join("");
    const spaced = (line.words ?? []).map((w) => (w.symbols ?? []).map((s) => s.text).join("")).join(" ");
    // Candidates come from the word-separated line only: the unspaced text hides where one label word ends and the next begins.
    for (const c of rankedVinCandidates(spaced)) {
      const at = text.indexOf(c.vin);
      const prev = out.get(c.vin);
      if (prev) { prev.afterVinLabel ||= c.afterVinLabel; continue; }
      out.set(c.vin, { vin: c.vin, afterVinLabel: c.afterVinLabel, confidences: at >= 0 ? syms.slice(at, at + VIN_LENGTH).map((s) => s.confidence) : Array(VIN_LENGTH).fill(undefined) });
    }
  }
  for (const c of rankedVinCandidates(page.text ?? "")) {
    const prev = out.get(c.vin);
    if (prev) prev.afterVinLabel ||= c.afterVinLabel;
    else out.set(c.vin, { vin: c.vin, afterVinLabel: c.afterVinLabel, confidences: Array(VIN_LENGTH).fill(undefined) });
  }
  return [...out.values()];
}

export type RankedVin = { vin: string; confidences: (number | undefined)[]; alternatives: string[]; checkDigitOk: boolean };

/**
 * Chooses what to show the customer from every read of one photo. Only reads that look like a VIN are considered (so label
 * text such as "...STANDARDS IN EFFECT ON THE DATE OF MANUFACTURE" can never be offered), and they are ranked by evidence:
 * passes the check digit, printed right after the word "VIN", digits and position-9 rule, camera confidence. How many times
 * a read repeated is only a tie-breaker. The winner is returned exactly as read (never corrected); the customer confirms it.
 * `extra` carries reads from other readers (the glyph reader). Returns null when nothing in the photo looks like a VIN.
 */
export function rankVinReads(pages: OcrPage[], extra: VinRead[] = []): RankedVin | null {
  const seen = new Map<string, { confidences: (number | undefined)[]; count: number; afterVinLabel: boolean }>();
  for (const c of [...pages.flatMap((page) => candidatesFromPage(page)), ...extra]) {
    const cur = seen.get(c.vin);
    if (cur) {
      cur.count++;
      cur.afterVinLabel ||= c.afterVinLabel;
      if (c.confidences.some((x) => x !== undefined) && !cur.confidences.some((x) => x !== undefined)) cur.confidences = c.confidences;
    } else seen.set(c.vin, { confidences: c.confidences, count: 1, afterVinLabel: c.afterVinLabel });
  }
  const ranked = [...seen.entries()]
    .filter(([vin, ev]) => isPlausibleVinRead(vin) && (ev.afterVinLabel || !looksLikeLabelText(vin)))
    .map(([vin, ev]) => ({ vin, ev, score: scoreVinRead(vin, ev) }))
    .sort((a, b) => b.score - a.score);
  if (!ranked.length) return null;
  const best = ranked[0];
  return {
    vin: normalizeVin(best.vin),
    confidences: best.ev.confidences,
    alternatives: ranked.slice(1, 4).map((r) => r.vin),
    checkDigitOk: validateVin(best.vin).ok,
  };
}

/**
 * Where the printed label is, as the OCR engine itself saw it: the box around every line made of label words (GVWR, STANDARDS,
 * EFFECT, MANUFACTURE ...), in the coordinates of the photo (`pad` is the margin the engine was given). A dusty door jamb or a
 * dark photo makes one threshold over the whole picture wipe out the text; reading the label region on its own, with its own
 * contrast, is what recovers the VIN. Returns null when no label text was recognised. Exported for tests.
 */
export function labelHull(pages: OcrPage[], pad = 0): Box | null {
  let hull: Box | null = null;
  for (const page of pages) {
    for (const line of (page.blocks ?? []).flatMap((b) => (b.paragraphs ?? []).flatMap((p) => p.lines ?? []))) {
      if (!line.bbox) continue;
      const text = (line.words ?? []).map((w) => (w.symbols ?? []).map((s) => s.text).join("")).join("").toUpperCase();
      if (text.length < 4 || !looksLikeLabelText(text)) continue;
      const b = line.bbox;
      hull = hull ? { x0: Math.min(hull.x0, b.x0), y0: Math.min(hull.y0, b.y0), x1: Math.max(hull.x1, b.x1), y1: Math.max(hull.y1, b.y1) } : { ...b };
    }
  }
  return hull && { x0: hull.x0 - pad, y0: hull.y0 - pad, x1: hull.x1 - pad, y1: hull.y1 - pad };
}

/** The region to re-read: the label-text hull grown on every side (the VIN is printed just outside the legal text), kept inside the photo. */
export function plateCropBox(hull: Box, width: number, height: number): Box {
  const w = hull.x1 - hull.x0, h = hull.y1 - hull.y0;
  const mx = Math.max(40, Math.round(w * 0.18)), my = Math.max(40, Math.round(h * 0.45));
  return { x0: Math.max(0, Math.round(hull.x0 - mx)), y0: Math.max(0, Math.round(hull.y0 - my)), x1: Math.min(width, Math.round(hull.x1 + mx)), y1: Math.min(height, Math.round(hull.y1 + my)) };
}

/** A copy of the region `box` of a greyscale canvas, stretched on its own 1st-99.5th percentile range (dust and glare outside the label cannot flatten it). */
function cropStretched(src: HTMLCanvasElement, box: Box): HTMLCanvasElement | null {
  const w = box.x1 - box.x0, h = box.y1 - box.y0;
  if (w < 50 || h < 30) return null;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(src, box.x0, box.y0, w, h, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < d.length; i += 4) hist[d[i] | 0]++;
  const total = d.length / 4;
  let acc = 0, lo = 0, hi = 255;
  for (let t = 0; t < 256; t++) { acc += hist[t]; if (acc >= total * 0.01) { lo = t; break; } }
  acc = 0;
  for (let t = 0; t < 256; t++) { acc += hist[t]; if (acc >= total * 0.995) { hi = t; break; } }
  const span = Math.max(1, hi - lo);
  for (let i = 0; i < d.length; i += 4) { const v = Math.max(0, Math.min(255, ((d[i] - lo) * 255) / span)); d[i] = d[i + 1] = d[i + 2] = v; }
  ctx.putImageData(img, 0, 0);
  return out;
}

/** Greyscale + contrast stretch of a decoded photo, on a canvas of its own. Etched/embossed plates read far better with it. */
async function toCanvas(file: File): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, LONG_SIDE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bmp.width * scale));
  canvas.height = Math.max(1, Math.round(bmp.height * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  let lo = 255, hi = 0;
  for (let i = 0; i < d.length; i += 4) {
    const g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
    d[i] = d[i + 1] = d[i + 2] = g;
    if (g < lo) lo = g;
    if (g > hi) hi = g;
  }
  const span = Math.max(1, hi - lo);
  for (let i = 0; i < d.length; i += 4) d[i] = d[i + 1] = d[i + 2] = ((d[i] - lo) * 255) / span;
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** A copy of `src` with an even margin (engines drop glyphs that touch the edge), optionally thresholded black/white (Otsu). */
function variant(src: HTMLCanvasElement, binarize: boolean): HTMLCanvasElement {
  const pad = Math.round(Math.max(src.width, src.height) * 0.04);
  const out = document.createElement("canvas");
  out.width = src.width + pad * 2;
  out.height = src.height + pad * 2;
  const ctx = out.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("no 2d context");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(src, pad, pad);
  if (binarize) {
    const img = ctx.getImageData(0, 0, out.width, out.height);
    const d = img.data;
    const hist = new Array<number>(256).fill(0);
    for (let i = 0; i < d.length; i += 4) hist[d[i] | 0]++;
    const total = d.length / 4;
    let sum = 0;
    for (let t = 0; t < 256; t++) sum += t * hist[t];
    let sumB = 0, wB = 0, best = 0, threshold = 128;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (!wB) continue;
      const wF = total - wB;
      if (!wF) break;
      sumB += t * hist[t];
      const between = wB * wF * (sumB / wB - (sum - sumB) / wF) ** 2;
      if (between > best) { best = between; threshold = t; }
    }
    for (let i = 0; i < d.length; i += 4) d[i] = d[i + 1] = d[i + 2] = d[i] > threshold ? 255 : 0;
    ctx.putImageData(img, 0, 0);
  }
  return out;
}

/**
 * The glyph reader (see vinGlyphs.ts): finds printed character strings as runs of individual shapes, reads each shape on its own
 * under many enhancement settings, and tallies the votes. Reads the two best runs only. Each result is what the shapes looked
 * like, character for character; nothing is fitted to the check digit, and the ranking afterwards treats it like any other read.
 * Exported for tests.
 */
export async function glyphVinReads(grey: Grey, recognise: Recognise, onStep?: () => void): Promise<VinRead[]> {
  const found: { run: GlyphRun; sig: Float32Array; score: number }[] = [];
  for (const polarity of [1, -1] as const) {
    for (const radius of [6, 10, 18, 30]) {
      const { runs, sig } = findGlyphRuns(grey, polarity, radius);
      for (const run of runs) found.push({ run, sig, score: runScore(run) });
    }
  }
  found.sort((a, b) => b.score - a.score);
  const chosen: typeof found = [];
  const overlaps = (a: GlyphRun, b: GlyphRun) => {
    const ax0 = a.boxes[0].x0, ax1 = a.boxes[a.boxes.length - 1].x1, bx0 = b.boxes[0].x0, bx1 = b.boxes[b.boxes.length - 1].x1;
    const ay = a.boxes.reduce((s, x) => s + (x.y0 + x.y1) / 2, 0) / a.boxes.length, by = b.boxes.reduce((s, x) => s + (x.y0 + x.y1) / 2, 0) / b.boxes.length;
    return Math.min(ax1, bx1) > Math.max(ax0, bx0) && Math.abs(ay - by) < Math.max(a.height, b.height);
  };
  for (const f of found) {
    if (chosen.length >= 2) break;
    if (!chosen.some((c) => overlaps(c.run, f.run))) chosen.push(f);
  }
  const out: VinRead[] = [];
  for (const f of chosen) {
    const read = await readGlyphRun(f.sig, grey.width, grey.height, f.run, recognise, undefined, onStep);
    for (const c of rankedVinCandidates(read.text)) {
      const at = read.text.indexOf(c.vin);
      out.push({ vin: c.vin, afterVinLabel: c.afterVinLabel, confidences: read.positions.slice(at, at + VIN_LENGTH).map((p) => Math.round(p.share * 100)) });
    }
  }
  return out;
}

/** The R channel of a greyscale canvas as a plain grey image. */
function greyOf(canvas: HTMLCanvasElement): Grey | null {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const g = new Uint8ClampedArray(canvas.width * canvas.height);
  for (let i = 0; i < g.length; i++) g[i] = d[i * 4];
  return { data: g, width: canvas.width, height: canvas.height };
}

/** Reads one photo. Nothing is uploaded or kept; the engine worker is terminated before this returns. */
export async function scanVinFromImage(file: File, onProgress?: (fraction: number) => void): Promise<ScanResult> {
  if (file.size > MAX_PHOTO_BYTES) return fail("size");
  let head: Uint8Array;
  try {
    head = new Uint8Array(await file.slice(0, 64 * 1024).arrayBuffer());
  } catch {
    return fail("decode");
  }
  const kind = sniffImageType(head);
  if (!kind) return fail("type");
  const px = declaredPixels(head, kind);
  if (px !== null && px > MAX_PHOTO_PIXELS) return fail("dimensions");

  let canvas: HTMLCanvasElement;
  try {
    canvas = await toCanvas(file);
  } catch {
    return fail("decode");
  }

  let worker: import("tesseract.js").Worker | undefined;
  const made: HTMLCanvasElement[] = [canvas];
  try {
    const { createWorker, PSM } = await import("tesseract.js");
    let passDone = 0;
    let passTotal = 6;
    const PSMS = [PSM.SINGLE_BLOCK, PSM.SPARSE_TEXT, PSM.AUTO];
    const bin = variant(canvas, true), grey = variant(canvas, false);
    made.push(bin, grey);
    const pad = Math.round(Math.max(canvas.width, canvas.height) * 0.04); // the margin variant() adds around the photo
    worker = await createWorker("eng", 1, {
      workerPath: "/ocr/worker.min.js",
      corePath: "/ocr/core",
      langPath: "/ocr/lang",
      workerBlobURL: false,
      logger: (m: { status?: string; progress?: number }) => {
        if (m.status === "recognizing text" && typeof m.progress === "number") onProgress?.(Math.min(1, (passDone + m.progress) / passTotal));
      },
    });
    // Letters and digits only. I, O and Q stay allowed on purpose: when the camera reads one, the customer is shown it.
    await worker.setParameters({ tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789" });
    // Several looks at the same photo. Each is read as-is; none edits a character. A read that passes the VIN check digit
    // ends the search; otherwise every read is ranked by evidence (see rankVinReads) and the best is offered, flagged, for
    // the customer to check. Text that does not look like a VIN is never offered.
    const pages: OcrPage[] = [];
    const glyphReads: VinRead[] = [];
    const run = async (img: HTMLCanvasElement, psm: (typeof PSMS)[number]) => {
      await worker!.setParameters({ tessedit_pageseg_mode: psm });
      const { data } = await worker!.recognize(img, {}, { blocks: true, text: true });
      passDone++;
      pages.push(data as unknown as OcrPage);
      return rankVinReads(pages, glyphReads);
    };
    // Stage 1: the whole photo.
    for (const img of [bin, grey]) for (const psm of PSMS) {
      const so_far = await run(img, psm);
      if (so_far?.checkDigitOk) return { ok: true, ...so_far };
    }
    // Stage 1b: the glyph reader, for etched or hairline characters the page reader cannot see. About 3 seconds.
    {
      const grey = greyOf(canvas);
      const tile = document.createElement("canvas");
      made.push(tile);
      const tctx = tile.getContext("2d", { willReadFrequently: true });
      if (grey && tctx) {
        passTotal += 2;
        let steps = 0;
        await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_CHAR });
        const recognise: Recognise = async (t) => {
          tile.width = t.width;
          tile.height = t.height;
          const img = tctx.createImageData(t.width, t.height);
          for (let i = 0; i < t.data.length; i++) { img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = t.data[i]; img.data[i * 4 + 3] = 255; }
          tctx.putImageData(img, 0, 0);
          const { data } = await worker!.recognize(tile);
          return { ch: (data.text.trim()[0] ?? null)?.toUpperCase() ?? null, conf: data.confidence / 100 };
        };
        try {
          glyphReads.push(...(await glyphVinReads(grey, recognise, () => { if (++steps % 12 === 0) onProgress?.(Math.min(1, (passDone + 2 * Math.min(1, steps / 204)) / passTotal)); })));
        } catch { /* the glyph reader is an extra; the page reader's reads still stand */ }
        passDone += 2;
        const so_far = rankVinReads(pages, glyphReads);
        if (so_far?.checkDigitOk) return { ok: true, ...so_far };
      }
    }
    // Stage 2: read the label region on its own, with its own contrast, where the engine saw label text.
    const hull = labelHull(pages, pad);
    const box = hull && plateCropBox(hull, canvas.width, canvas.height);
    const crop = box && cropStretched(canvas, box);
    if (crop) {
      made.push(crop);
      const cropBin = variant(crop, true), cropGrey = variant(crop, false);
      made.push(cropBin, cropGrey);
      passTotal += 6;
      for (const img of [cropGrey, cropBin]) for (const psm of PSMS) {
        const so_far = await run(img, psm);
        if (so_far?.checkDigitOk) return { ok: true, ...so_far };
      }
    }
    const result = rankVinReads(pages, glyphReads);
    if (!result) return fail("unreadable");
    return { ok: true, ...result };
  } catch {
    return fail("engine");
  } finally {
    for (const c of made) c.width = c.height = 0;
    try { await worker?.terminate(); } catch { /* the worker is gone either way */ }
  }
}

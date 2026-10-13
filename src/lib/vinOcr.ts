// VIN photo scan, entirely in the customer's browser. Free: the open-source Tesseract engine and its English model are
// served from our own /ocr folder (scripts/ocr/copy-assets.mjs), so there is no paid API, no CDN, and the photo is never
// uploaded, stored or sent anywhere. Only pixels are used, so the photo's metadata (location, device) never goes anywhere
// either. The picture and the canvas are dropped as soon as the text is read.
//
// What this returns is what the camera READ, character for character. It does not "fix" anything: I/O/Q and low-confidence
// characters come back flagged so the screen can highlight them and the customer must confirm the VIN themselves.

import { OcrPool, PoolCancelled, poolSizeFor, type PoolWorker } from "@/lib/ocrPool";
import { encodeGrayBmp, findGlyphRuns, findGlyphRunsAsync, readGlyphRun, runScore, type Grey, type GlyphRun, type Recognise } from "@/lib/vinGlyphs";
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
    // Other readings of the photo, for tests and diagnostics. A reading with I, O or Q in it is not a VIN and is never listed.
    alternatives: ranked.slice(1).filter((r) => !/[IOQ]/.test(r.vin)).slice(0, 3).map((r) => r.vin),
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

/** Detection settings in the order they are tried: polarity (+1 dark strokes on light, -1 the reverse) and background radius. */
const GLYPH_SETTINGS: [1 | -1, number][] = [[1, 10], [-1, 10], [1, 6], [-1, 6], [1, 18], [-1, 18], [1, 30], [-1, 30]];
/** A run of exactly VIN length with glyph heights within about 12% of each other (runScore 20 or more) is the printed VIN line; the search stops there. */
const STRONG_RUN = 20;
/** Engine calls in one glyph run: 12 settings for each of 17 characters. Used only to scale the progress bar. */
const GLYPH_STEPS = 204;

export type GlyphOptions = {
  /** Hands the thread back to the page between slices of the shape search, so the screen never freezes. */
  tick?: () => Promise<void>;
  /** Called with the reads so far after the first run; returning true skips the second run (the scan already has a valid VIN). */
  isDone?: (reads: VinRead[]) => boolean;
  /** Called once detection settles on the first run: whether any VIN-length candidate was found, and how many of the settings it took. */
  onDetected?: (found: boolean, settingsTried: number) => void;
};

/**
 * The glyph reader (see vinGlyphs.ts): finds printed character strings as runs of individual shapes, reads each shape on its own
 * under many enhancement settings, and tallies the votes. The search stops at the first strong run (a full-length line of evenly
 * sized characters), reads it, and reads a second distinct run only when the first did not already give a valid VIN. Each result is
 * what the shapes looked like, character for character; nothing is fitted to the check digit, and the ranking afterwards treats it
 * like any other read. Exported for tests.
 */
export async function glyphVinReads(grey: Grey, recognise: Recognise, onStep?: () => void, opts: GlyphOptions = {}): Promise<VinRead[]> {
  const found: { run: GlyphRun; sig: Float32Array; score: number }[] = [];
  let next = 0;
  const detectUntil = async (stopAtStrong: boolean) => {
    for (; next < GLYPH_SETTINGS.length;) {
      const [polarity, radius] = GLYPH_SETTINGS[next++];
      const { runs, sig } = opts.tick ? await findGlyphRunsAsync(grey, polarity, radius, opts.tick) : findGlyphRuns(grey, polarity, radius);
      for (const run of runs) found.push({ run, sig, score: runScore(run) });
      if (stopAtStrong && found.some((f) => f.score >= STRONG_RUN)) return;
    }
  };
  const overlaps = (a: GlyphRun, b: GlyphRun) => {
    const ax0 = a.boxes[0].x0, ax1 = a.boxes[a.boxes.length - 1].x1, bx0 = b.boxes[0].x0, bx1 = b.boxes[b.boxes.length - 1].x1;
    const ay = a.boxes.reduce((s, x) => s + (x.y0 + x.y1) / 2, 0) / a.boxes.length, by = b.boxes.reduce((s, x) => s + (x.y0 + x.y1) / 2, 0) / b.boxes.length;
    return Math.min(ax1, bx1) > Math.max(ax0, bx0) && Math.abs(ay - by) < Math.max(a.height, b.height);
  };
  const chosen: typeof found = [];
  const out: VinRead[] = [];
  for (let round = 0; round < 2; round++) {
    if (round === 0) await detectUntil(true);
    else {
      if (opts.isDone?.(out)) break;
      await detectUntil(false);
    }
    if (round === 0) opts.onDetected?.(found.length > 0, next);
    const f = [...found].sort((a, b) => b.score - a.score).find((c) => !chosen.some((x) => overlaps(x.run, c.run)));
    if (!f) continue;
    chosen.push(f);
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

/** Gives the page a turn (input, painting) between slices of heavy work. A message channel is not slowed down in a background tab the way a timer is. */
export function yieldToPage(): Promise<void> {
  if (typeof MessageChannel !== "undefined") {
    return new Promise((resolve) => {
      const ch = new MessageChannel();
      ch.port1.onmessage = () => { ch.port1.close(); resolve(); };
      ch.port2.postMessage(0);
    });
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export type ScanStage = "Preparing the photo" | "Starting the reader" | "Reading the label" | "Reading each character" | "Checking the label area";

const ENGINE_PATHS = { workerPath: "/ocr/worker.min.js", corePath: "/ocr/core", langPath: "/ocr/lang" } as const;
// Letters and digits only. I, O and Q stay allowed on purpose: when the camera reads one, the customer is shown it.
const WHITELIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/**
 * Reads one photo. Nothing is uploaded or kept; the engine workers are terminated before this returns.
 * `onProgress(fraction, stage)` is called right away and then as work completes; the fraction never goes backwards.
 * `trace(stage)` is for timing tools only.
 */
export async function scanVinFromImage(file: File, onProgress?: (fraction: number, stage?: ScanStage) => void, trace?: (stage: string) => void): Promise<ScanResult> {
  const mark = (stage: string) => { try { trace?.(stage); } catch { /* tracing never affects a scan */ } };
  mark("start");
  let shown = 0;
  let stage: ScanStage = "Preparing the photo";
  const report = (fraction: number, next?: ScanStage) => {
    if (next) stage = next;
    shown = Math.max(shown, Math.min(0.99, fraction));
    try { onProgress?.(shown, stage); } catch { /* a progress display never affects a scan */ }
  };
  report(0.02, "Preparing the photo");
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
    mark("decoded");
  } catch {
    return fail("decode");
  }
  report(0.07, "Starting the reader");

  const pool = new OcrPool();
  const made: HTMLCanvasElement[] = [canvas];
  try {
    const { createWorker, PSM } = await import("tesseract.js");
    const makeWorker = async (): Promise<PoolWorker> => {
      const w = await createWorker("eng", 1, { ...ENGINE_PATHS, workerBlobURL: false });
      await w.setParameters({ tessedit_char_whitelist: WHITELIST });
      return w as unknown as PoolWorker;
    };
    // The first worker boots on its own thread while this one keeps preparing the photo and searching for character shapes.
    const firstWorker = makeWorker();
    firstWorker.catch(() => undefined);
    const wanted = poolSizeFor(typeof navigator !== "undefined" ? navigator.hardwareConcurrency : undefined);
    let extraStarted = false;
    const addExtraWorkers = () => {
      if (extraStarted) return;
      extraStarted = true;
      for (let i = 1; i < wanted; i++) makeWorker().then((w) => pool.add(w)).catch(() => undefined); // extra workers are a speed-up only
    };

    const pages: (OcrPage | undefined)[] = [];
    const glyphReads: VinRead[] = [];
    let engineError = false;
    let resolveEarly: (r: ScanResult) => void = () => undefined;
    const early = new Promise<ScanResult>((res) => { resolveEarly = res; });
    // Any read that passes the VIN check ends the search, whichever reader found it. What is returned is exactly what was read.
    let finished = false;
    const check = () => {
      const ranked = rankVinReads(pages.filter((p): p is OcrPage => !!p), glyphReads);
      if (ranked?.checkDigitOk) { finished = true; resolveEarly({ ok: true, ...ranked }); }
    };

    // Progress is counted in work units: a page pass is 1, the glyph reader about 4 (spread over its steps), the label-area passes 1 each.
    let passesFinished = 0;
    let steps = 0;
    let unitsTotal = 10;
    const unitsDone = () => passesFinished + Math.min(4, (steps / GLYPH_STEPS) * 4);
    const emit = (next?: ScanStage) => report(0.08 + 0.9 * (unitsDone() / unitsTotal), next);
    const passDone = () => { passesFinished += 1; emit(); };

    const PSMS = { sparse: PSM.SPARSE_TEXT, auto: PSM.AUTO, block: PSM.SINGLE_BLOCK } as const;
    const pagePass = (slot: number, img: HTMLCanvasElement, psm: (typeof PSMS)[keyof typeof PSMS], priority: number) =>
      pool
        .submit(priority, psm, async (w) => (await w.recognize(img, {}, { blocks: true, text: true })).data)
        .then((data) => {
          pages[slot] = data as unknown as OcrPage;
          mark(`pass${slot + 1}`);
          passDone();
          check();
          // A clean label is settled by the first quick pass, so extra workers (memory, CPU to start) are only worth starting once it has not been.
          if (slot === 0 && !finished) addExtraWorkers();
        })
        .catch((e) => { if (!(e instanceof PoolCancelled)) engineError = true; });

    // The glyph reader, for etched or hairline characters the page reader cannot see. Its shape search runs here while the workers are busy.
    const grey = greyOf(canvas);
    const recognise: Recognise = (t) =>
      pool.submit(2, PSM.SINGLE_CHAR, async (w) => {
        const { data } = await w.recognize(encodeGrayBmp(t), {}, { text: true });
        return { ch: (data.text.trim()[0] ?? null)?.toUpperCase() ?? null, conf: data.confidence / 100 };
      });
    const glyphLane = (async () => {
      if (!grey) { unitsTotal -= 4; return; }
      mark("glyph-start");
      try {
        const reads = await glyphVinReads(grey, recognise, () => {
          steps++;
          if (steps % 6 === 0) emit("Reading each character");
        }, {
          tick: yieldToPage,
          isDone: (r) => !!rankVinReads(pages.filter((p): p is OcrPage => !!p), [...glyphReads, ...r])?.checkDigitOk,
          onDetected: (any) => { mark("glyph-detected"); if (!any) unitsTotal -= 4; },
        });
        glyphReads.push(...reads);
      } catch (e) {
        if (!(e instanceof PoolCancelled)) mark("glyph-failed"); // the glyph reader is an extra; the page reader's reads still stand
      }
      mark("glyph-done");
      check();
    })();
    glyphLane.catch(() => undefined);

    pool.add(await firstWorker);
    mark("worker-ready");
    report(0.1, "Reading the label");
    // Stage 1: the whole photo, cheap passes first. The two quick passes settle a clean label; the slow single-block passes go last.
    const bin = variant(canvas, true);
    made.push(bin);
    const stage1: Promise<unknown>[] = [pagePass(0, bin, PSMS.sparse, 1), pagePass(1, bin, PSMS.auto, 1)];
    const greyV = variant(canvas, false);
    made.push(greyV);
    stage1.push(pagePass(2, greyV, PSMS.sparse, 3), pagePass(3, greyV, PSMS.auto, 3), pagePass(4, bin, PSMS.block, 3), pagePass(5, greyV, PSMS.block, 3));
    const pad = Math.round(Math.max(canvas.width, canvas.height) * 0.04); // the margin variant() adds around the photo
    const settled = Promise.all([...stage1, glyphLane]).then(() => null);

    let winner = await Promise.race([early, settled]);
    if (winner) return winner;

    // Stage 2: read the label region on its own, with its own contrast, where the engine saw label text.
    const pagesDone = pages.filter((p): p is OcrPage => !!p);
    const hull = labelHull(pagesDone, pad);
    const box = hull && plateCropBox(hull, canvas.width, canvas.height);
    const crop = box && cropStretched(canvas, box);
    if (crop) {
      made.push(crop);
      const cropBin = variant(crop, true), cropGrey = variant(crop, false);
      made.push(cropBin, cropGrey);
      unitsTotal += 6;
      addExtraWorkers();
      report(shown, "Checking the label area");
      const stage2: Promise<unknown>[] = [];
      let slot = 6;
      for (const img of [cropGrey, cropBin]) for (const psm of [PSMS.sparse, PSMS.auto, PSMS.block]) stage2.push(pagePass(slot++, img, psm, 1));
      winner = await Promise.race([early, Promise.all(stage2).then(() => null)]);
      if (winner) return winner;
    }
    const result = rankVinReads(pages.filter((p): p is OcrPage => !!p), glyphReads);
    if (!result) return engineError ? fail("engine") : fail("unreadable");
    return { ok: true, ...result };
  } catch {
    return fail("engine");
  } finally {
    for (const c of made) c.width = c.height = 0;
    try { await pool.terminateAll(); } catch { /* the workers are gone either way */ }
  }
}

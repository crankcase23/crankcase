// Glyph-level VIN reading for hard labels (hairline etched or embossed characters on a dark, speckled plate).
//
// Why this exists: reading a whole photo as text fails on thin, widely spaced characters, and the engine's alternatives for a
// single character are not enough to trust. Here the characters are found as individual shapes, each shape is read on its own
// under many enhancement settings, and the readings are tallied per position. Two kinds of evidence, both measured from the
// photo and neither derived from the VIN check digit:
//   1. the recogniser's vote for that glyph under each setting, and
//   2. the glyph's shape: how many enclosed holes it has (8 has two, 0 6 9 A D P R have one, 3 5 7 have none). A vote for a
//      character whose hole count disagrees with the glyph in the photo is discarded (an 8 is never a 3).
// Nothing here edits a character to fit the check digit. The check digit is only computed afterwards, by the caller, and the
// customer still has to confirm the result. No hard-coded vehicle, make, label layout or VIN is used anywhere.
//
// Pure functions on plain arrays so the same code runs in the browser and in Node tests. The engine is injected.

export type Grey = { data: ArrayLike<number>; width: number; height: number };
export type Box = { x0: number; y0: number; x1: number; y1: number };
export type GlyphRun = { boxes: Box[]; height: number; polarity: 1 | -1; radius: number };
export type Tile = { data: Uint8ClampedArray; width: number; height: number };
export type Recognise = (tile: Tile) => Promise<{ ch: string | null; conf: number }>;
export type GlyphPosition = { ch: string | null; share: number; alternatives: { ch: string; score: number }[]; holes: number; corner: "bare" | "inked" | "unclear" };
export type GlyphRead = { text: string; positions: GlyphPosition[]; configs: number };

const VIN_LENGTH = 17;
/** Strokes must stand out from their background by at least this many grey levels (0-255); keeps a flat or noise-free image from turning into one big shape. */
const MIN_STROKE_CONTRAST = 8;

/** Separable box blur (edge-clamped). */
export function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  const n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let s = 0;
    for (let x = -r; x <= r; x++) s += src[row + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = s / n;
      s += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let y = -r; y <= r; y++) s += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = s / n;
      s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

/** Signal minus its local background; polarity 1 = light strokes on dark, -1 = dark strokes on light. */
export function localContrast(grey: Grey, polarity: 1 | -1, radius: number): Float32Array {
  const { width: w, height: h } = grey;
  const g = new Float32Array(w * h);
  for (let i = 0; i < g.length; i++) g[i] = grey.data[i] * polarity;
  const bg = boxBlur(g, w, h, radius);
  for (let i = 0; i < g.length; i++) g[i] -= bg[i];
  return g;
}

/** Otsu threshold of a float signal over an optional window. */
export function otsuThreshold(sig: Float32Array, w: number, win?: Box): number {
  let mn = Infinity, mx = -Infinity;
  const x0 = win?.x0 ?? 0, x1 = win?.x1 ?? w - 1, y0 = win?.y0 ?? 0, y1 = win?.y1 ?? sig.length / w - 1;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const v = sig[y * w + x]; if (v < mn) mn = v; if (v > mx) mx = v; }
  if (!(mx > mn)) return mx;
  const bins = 256, hist = new Float64Array(bins);
  let total = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { hist[Math.min(bins - 1, Math.floor(((sig[y * w + x] - mn) / (mx - mn)) * bins))]++; total++; }
  let sum = 0;
  for (let i = 0; i < bins; i++) sum += i * hist[i];
  let wB = 0, sB = 0, best = -1, bt = 0;
  for (let i = 0; i < bins; i++) {
    wB += hist[i];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sB += i * hist[i];
    const v = wB * wF * (sB / wB - (sum - sB) / wF) ** 2;
    if (v > best) { best = v; bt = i; }
  }
  return mn + ((bt + 0.5) / bins) * (mx - mn);
}

type Comp = Box & { id: number; n: number };

/** 8-connected components of a binary mask. */
export function connectedComponents(bin: Uint8Array, w: number, h: number): { lab: Int32Array; comps: Comp[] } {
  const lab = new Int32Array(w * h), comps: Comp[] = [], stack: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (!bin[i] || lab[i]) continue;
    const id = comps.length + 1;
    let x0 = w, y0 = h, x1 = 0, y1 = 0, n = 0;
    stack.push(i);
    lab[i] = id;
    while (stack.length) {
      const p = stack.pop() as number, x = p % w, y = (p / w) | 0;
      n++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx;
        if (bin[q] && !lab[q]) { lab[q] = id; stack.push(q); }
      }
    }
    comps.push({ id, x0, y0, x1, y1, n });
  }
  return { lab, comps };
}

/** Grows a mask by `r` pixels (round brush). Thickens hairline strokes so a recogniser trained on normal weights can read them. */
export function dilateMask(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  if (r <= 0) return mask;
  const out = new Uint8Array(w * h), lim = r * r + 1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!mask[y * w + x]) continue;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && dx * dx + dy * dy <= lim) out[ny * w + nx] = 1;
    }
  }
  return out;
}

/** Enclosed background regions of a glyph mask that are at least `minFrac` of the tile (specks do not count as holes). */
export function holeCount(mask: Uint8Array, w: number, h: number, minFrac = 0.02): number {
  const seen = new Uint8Array(w * h), stack: number[] = [];
  const push = (x: number, y: number) => { const i = y * w + x; if (!mask[i] && !seen[i]) { seen[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  const flood = (collect: boolean) => {
    let area = 0;
    while (stack.length) {
      const p = stack.pop() as number, x = p % w, y = (p / w) | 0;
      area++;
      if (x + 1 < w) push(x + 1, y);
      if (x > 0) push(x - 1, y);
      if (y + 1 < h) push(x, y + 1);
      if (y > 0) push(x, y - 1);
    }
    return collect ? area : 0;
  };
  flood(false); // everything reachable from the border is outside
  let holes = 0;
  for (let i = 0; i < w * h; i++) {
    if (mask[i] || seen[i]) continue;
    seen[i] = 1;
    stack.push(i);
    if (flood(true) / (w * h) >= minFrac) holes++;
  }
  return holes;
}

/**
 * Hole counts a printed character can have, with tolerance for how fonts and thin strokes behave (an open-topped 4, an A
 * whose counter is tiny, a slashed zero). Anything outside the set is treated as "this glyph is not that character".
 */
export const HOLES_OK: Record<string, number[]> = {
  "0": [1, 2], "1": [0], "2": [0], "3": [0], "4": [0, 1], "5": [0], "6": [0, 1], "7": [0], "8": [1, 2], "9": [0, 1],
  A: [0, 1], B: [1, 2], C: [0], D: [0, 1], E: [0], F: [0], G: [0], H: [0], I: [0], J: [0], K: [0], L: [0], M: [0], N: [0],
  O: [1, 2], P: [0, 1], Q: [1, 2], R: [0, 1], S: [0], T: [0], U: [0], V: [0], W: [0], X: [0], Y: [0], Z: [0],
};

export function holesCompatible(ch: string, holes: number): boolean {
  const ok = HOLES_OK[ch.toUpperCase()];
  return !ok || ok.includes(holes);
}

/** Fraction of the lower-right corner (right 38% x bottom 28% of the glyph's own ink box) that is ink. */
export function lowerRightInk(mask: Uint8Array, w: number, h: number): number {
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return 0;
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  let ink = 0, tot = 0;
  for (let y = Math.floor(y0 + bh * 0.72); y <= y1; y++) for (let x = Math.floor(x0 + bw * 0.62); x <= x1; x++) { tot++; ink += mask[y * w + x]; }
  return tot ? ink / tot : 0;
}

/** Characters whose lower-right corner is normally bare (the stem or the bowl ends above it), and characters whose strokes normally reach it. */
const CORNER_BARE = new Set("PF7TY");
const CORNER_INKED = new Set("DBR80OQ6UHMNWKXA235SZEL9");

/** "bare" / "inked" when the measurement is clear, otherwise "unclear" (no opinion). */
export function cornerState(ink: number): "bare" | "inked" | "unclear" {
  return ink < 0.08 ? "bare" : ink > 0.15 ? "inked" : "unclear";
}

export function cornerCompatible(ch: string, state: "bare" | "inked" | "unclear"): boolean {
  const c = ch.toUpperCase();
  if (state === "bare") return !CORNER_INKED.has(c);
  if (state === "inked") return !CORNER_BARE.has(c);
  return true;
}

/**
 * Finds runs of similar, evenly lined-up character shapes (a printed string, possibly tilted). Generic: any run of 10 to 24
 * glyph-sized shapes with consistent height along a straight baseline qualifies; what the string says is decided later.
 * `radius` is the background window for local contrast (about a third of a character height).
 */
function* glyphRunSteps(grey: Grey, polarity: 1 | -1, radius: number): Generator<void, { runs: GlyphRun[]; sig: Float32Array }, void> {
  const { width: w, height: h } = grey;
  const sig = localContrast(grey, polarity, radius);
  yield;
  const t = Math.max(otsuThreshold(sig, w) * 0.8, MIN_STROKE_CONTRAST);
  const bin = new Uint8Array(w * h);
  for (let i = 0; i < bin.length; i++) bin[i] = sig[i] > t ? 1 : 0;
  yield;
  const { comps } = connectedComponents(bin, w, h);
  yield;
  const minH = Math.max(12, radius * 0.8);
  const cand = comps.filter((c) => {
    const cw = c.x1 - c.x0 + 1, ch = c.y1 - c.y0 + 1;
    return ch >= minH && ch <= radius * 8 && cw <= ch * 1.6 && c.n >= ch * 1.2;
  });
  // Group shapes of similar height (a printed string has one character height), then pull straight baselines out of each group.
  const runs: GlyphRun[] = [];
  const sorted = [...cand].sort((x, y) => (y.y1 - y.y0) - (x.y1 - x.y0));
  for (let i = 0; i < sorted.length;) {
    const top = sorted[i].y1 - sorted[i].y0 + 1;
    let j = i;
    while (j < sorted.length && sorted[j].y1 - sorted[j].y0 + 1 >= top * 0.8) j++;
    let pts = sorted.slice(i, j).map((c) => ({ c, cx: (c.x0 + c.x1) / 2, cy: (c.y0 + c.y1) / 2 }));
    i = j;
    const rh = top * 0.9;
    for (let guard = 0; guard < 12 && pts.length >= 10; guard++) {
      // Hough over small tilts: the slope whose offsets (cy - slope * cx) pile up in one narrow band is the baseline.
      let best: { slope: number; lo: number; n: number } | null = null;
      for (let s = -0.25, step = 0; s <= 0.2501; s += 0.005) {
        if (++step % 8 === 0) yield;
        const offs = pts.map((p) => p.cy - s * p.cx).sort((a, b) => a - b);
        let lo = 0;
        for (let hi = 0; hi < offs.length; hi++) {
          while (offs[hi] - offs[lo] > rh * 0.5) lo++;
          if (!best || hi - lo + 1 > best.n) best = { slope: s, lo: offs[lo], n: hi - lo + 1 };
        }
      }
      if (!best || best.n < 10) break;
      const on = pts.filter((p) => { const o = p.cy - best!.slope * p.cx; return o >= best!.lo - 1 && o <= best!.lo + rh * 0.5 + 1; }).sort((a, b) => a.cx - b.cx);
      pts = pts.filter((p) => !on.includes(p));
      // Split wherever the gap between neighbours is wider than a character (a word break or another object).
      let cur: typeof on = [];
      const flush = () => {
        if (cur.length >= 10 && cur.length <= 24) {
          const hs = cur.map((p) => p.c.y1 - p.c.y0 + 1);
          runs.push({ boxes: cur.map((p) => ({ x0: p.c.x0, y0: p.c.y0, x1: p.c.x1, y1: p.c.y1 })), height: hs.reduce((a, b) => a + b, 0) / hs.length, polarity, radius });
        }
        cur = [];
      };
      for (const p of on) {
        const prev = cur[cur.length - 1];
        if (prev && p.c.x0 - prev.c.x1 > rh * 0.9) flush();
        cur.push(p);
      }
      flush();
    }
  }
  return { runs, sig };
}

export function findGlyphRuns(grey: Grey, polarity: 1 | -1, radius: number): { runs: GlyphRun[]; sig: Float32Array } {
  const steps = glyphRunSteps(grey, polarity, radius);
  for (;;) {
    const n = steps.next();
    if (n.done) return n.value;
  }
}

/** The same search, handing the thread back to the page (`tick`) between small slices, so a scan never freezes the screen. */
export async function findGlyphRunsAsync(grey: Grey, polarity: 1 | -1, radius: number, tick: () => Promise<void>): Promise<{ runs: GlyphRun[]; sig: Float32Array }> {
  const steps = glyphRunSteps(grey, polarity, radius);
  for (;;) {
    const n = steps.next();
    if (n.done) return n.value;
    await tick();
  }
}

/** Prefers a run of exactly VIN length with uniform glyph height. */
export function runScore(run: GlyphRun): number {
  const n = run.boxes.length;
  const hs = run.boxes.map((b) => b.y1 - b.y0 + 1);
  const mean = hs.reduce((a, b) => a + b, 0) / n;
  const cv = Math.sqrt(hs.reduce((a, b) => a + (b - mean) ** 2, 0) / n) / mean;
  return Math.min(n, VIN_LENGTH) + (n === VIN_LENGTH ? 4 : 0) - Math.abs(n - VIN_LENGTH) * 0.25 - cv * 8;
}

/** Letters that cannot appear in a VIN (ISO 3779). */
const NOT_IN_VIN = new Set(["I", "O", "Q"]);

export type GlyphConfig = { mult: number; grow: number };
/** Enhancement settings: how low the stroke threshold sits (relative to Otsu) and how much the strokes are thickened. */
export const GLYPH_CONFIGS: GlyphConfig[] = [0.6, 0.8, 1.0].flatMap((mult) => [0, 1, 2, 3].map((grow) => ({ mult, grow })));

/** One glyph's mask under one setting: pixels over the threshold inside the glyph's box, small specks dropped, then thickened. */
export function glyphMask(sig: Float32Array, w: number, h: number, box: Box, t: number, grow: number, scale: number): { mask: Uint8Array; w: number; h: number } {
  const pad = Math.max(3, Math.round((box.y1 - box.y0) * 0.16));
  const x0 = Math.max(0, box.x0 - 2), y0 = Math.max(0, box.y0 - 2), x1 = Math.min(w - 1, box.x1 + 2), y1 = Math.min(h - 1, box.y1 + 2);
  const gw = x1 - x0 + 1, gh = y1 - y0 + 1;
  const bin = new Uint8Array(gw * gh);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) bin[y * gw + x] = sig[(y0 + y) * w + x0 + x] > t ? 1 : 0;
  const { lab, comps } = connectedComponents(bin, gw, gh);
  const gArea = (box.x1 - box.x0 + 1) * (box.y1 - box.y0 + 1);
  const keep = new Set(comps.filter((c) => c.n >= Math.max(6, gArea * 0.01)).map((c) => c.id));
  const W = gw + 2 * pad, H = gh + 2 * pad;
  let mask: Uint8Array = new Uint8Array(W * H);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) if (lab[y * gw + x] && keep.has(lab[y * gw + x])) mask[(y + pad) * W + x + pad] = 1;
  mask = dilateMask(mask, W, H, Math.round(grow * scale));
  return { mask, w: W, h: H };
}

/** Renders a glyph mask as dark-on-white greys at a fixed height with an even margin (recognisers want isolated, padded, upright characters). */
export function renderTile(mask: Uint8Array, w: number, h: number, targetH = 96): Tile {
  const margin = Math.round(targetH * 0.3);
  const scale = (targetH - 2 * margin) / h;
  const tw = Math.max(1, Math.round(w * scale)) + 2 * margin;
  const data = new Uint8ClampedArray(tw * targetH).fill(255);
  const bw = tw - 2 * margin, bh = targetH - 2 * margin;
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    const sx0 = Math.floor(x / scale), sx1 = Math.max(sx0 + 1, Math.floor((x + 1) / scale)), sy0 = Math.floor(y / scale), sy1 = Math.max(sy0 + 1, Math.floor((y + 1) / scale));
    let s = 0, n = 0;
    for (let sy = sy0; sy < sy1 && sy < h; sy++) for (let sx = sx0; sx < sx1 && sx < w; sx++) { s += mask[sy * w + sx]; n++; }
    data[(y + margin) * tw + x + margin] = 255 - Math.round((n ? s / n : 0) * 255);
  }
  return { data, width: tw, height: targetH };
}

/**
 * Reads a run of glyphs. For each glyph and each enhancement setting: build the mask, measure its holes, recognise it.
 * Votes are summed by recogniser confidence per character; votes whose hole count disagrees with the glyph's measured
 * hole count (the most common across settings) or whose lower-right corner contradicts the glyph (median across settings) are dropped. A glyph with no surviving vote is reported as null.
 */
export async function readGlyphRun(sig: Float32Array, w: number, h: number, run: GlyphRun, recognise: Recognise, configs: GlyphConfig[] = GLYPH_CONFIGS, onStep?: () => void): Promise<GlyphRead> {
  const xs = run.boxes.map((b) => b.x0), ys = run.boxes.map((b) => b.y0);
  const win: Box = { x0: Math.max(0, Math.min(...xs) - 10), y0: Math.max(0, Math.min(...ys) - 10), x1: Math.min(w - 1, Math.max(...run.boxes.map((b) => b.x1)) + 10), y1: Math.min(h - 1, Math.max(...run.boxes.map((b) => b.y1)) + 10) };
  const base = Math.max(otsuThreshold(sig, w, win), MIN_STROKE_CONTRAST);
  const scale = run.height / 50;
  const votes = run.boxes.map(() => new Map<string, number>());
  const holeVotes = run.boxes.map(() => new Map<number, number>());
  const cornerInk = run.boxes.map(() => [] as number[]);
  // Every glyph under every setting is handed to the recogniser at once (a pool of engine workers works through them in
  // parallel); the answers are then tallied in the fixed setting-by-setting order, so the result never depends on timing.
  const jobs: { k: number; hc: number; ink: number; res: Promise<{ ch: string | null; conf: number }> }[] = [];
  for (const cfg of configs) {
    for (let k = 0; k < run.boxes.length; k++) {
      const m = glyphMask(sig, w, h, run.boxes[k], base * cfg.mult, cfg.grow, scale);
      jobs.push({ k, hc: holeCount(m.mask, m.w, m.h), ink: lowerRightInk(m.mask, m.w, m.h), res: recognise(renderTile(m.mask, m.w, m.h)) });
    }
  }
  const answers = await Promise.all(jobs.map(async (j) => { const r = await j.res; onStep?.(); return r; }));
  jobs.forEach((j, i) => {
    holeVotes[j.k].set(j.hc, (holeVotes[j.k].get(j.hc) ?? 0) + 1);
    cornerInk[j.k].push(j.ink);
    const r = answers[i];
    if (r.ch) votes[j.k].set(r.ch, (votes[j.k].get(r.ch) ?? 0) + Math.max(0.01, r.conf));
  });
  const positions: GlyphPosition[] = run.boxes.map((_, k) => {
    const holes = [...holeVotes[k].entries()].sort((a, b) => b[1] - a[1])[0][0];
    const all = [...votes[k].entries()].sort((a, b) => b[1] - a[1]);
    const total = all.reduce((a, [, s]) => a + s, 0);
    const inks = [...cornerInk[k]].sort((a, b) => a - b);
    const corner = cornerState(inks[inks.length >> 1]);
    const kept = all.filter(([ch]) => holesCompatible(ch, holes) && cornerCompatible(ch, corner));
    const top = kept[0];
    return {
      ch: top ? top[0] : null,
      share: top && total ? top[1] / total : 0,
      // I, O and Q never appear in a VIN, so they are never listed as an alternative reading either.
      alternatives: kept.slice(1).filter(([ch]) => !NOT_IN_VIN.has(ch)).slice(0, 2).map(([ch, score]) => ({ ch, score })),
      holes,
      corner,
    };
  });
  return { text: positions.map((p) => p.ch ?? "?").join(""), positions, configs: configs.length };
}


/**
 * A tile as an uncompressed 8-bit greyscale BMP. The OCR engine reads these bytes directly, which is much cheaper than
 * painting a canvas and letting the engine re-encode it as a PNG for every one of the glyph tiles.
 */
export function encodeGrayBmp(tile: Tile): Uint8Array {
  const { width, height, data } = tile;
  const rowBytes = (width + 3) & ~3;
  const pixelsAt = 14 + 40 + 1024;
  const out = new Uint8Array(pixelsAt + rowBytes * height);
  const dv = new DataView(out.buffer);
  out[0] = 0x42; out[1] = 0x4d; // "BM"
  dv.setUint32(2, out.length, true);
  dv.setUint32(10, pixelsAt, true);
  dv.setUint32(14, 40, true);
  dv.setInt32(18, width, true);
  dv.setInt32(22, height, true); // positive: rows are stored bottom-up
  dv.setUint16(26, 1, true);
  dv.setUint16(28, 8, true);
  dv.setUint32(34, rowBytes * height, true);
  dv.setUint32(46, 256, true);
  for (let i = 0; i < 256; i++) { const o = 54 + i * 4; out[o] = out[o + 1] = out[o + 2] = i; }
  for (let y = 0; y < height; y++) out.set(data.subarray((height - 1 - y) * width, (height - y) * width), pixelsAt + y * rowBytes);
  return out;
}

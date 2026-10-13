// Glyph reader (src/lib/vinGlyphs.ts) mechanics, on synthetic shapes with a stub recogniser. Pure and fast.
// The real photo is pinned in scripts/vin/ocr-tests/vin-glyph-original.test.mjs and tests/e2e/vin-label-photo.spec.ts.
// Rules pinned here: a vote for a character whose shape contradicts the glyph is discarded (an 8 is never a 3, a P never a D);
// a glyph left with no consistent vote stays unread ("?") and is never guessed; the check digit never selects a character.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SRC = process.env.VIN_TEST_SRC ?? path.join(ROOT, "src");
const require = createRequire(path.join(ROOT, "package.json"));
async function bundle(entry) {
  const esbuild = require("esbuild");
  const out = await esbuild.build({ entryPoints: [path.join(SRC, entry)], bundle: true, format: "esm", platform: "node", write: false, external: ["tesseract.js"], alias: { "@": SRC } });
  return import("data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64"));
}
const G = await bundle("lib/vinGlyphs.ts");
const OCR = await bundle("lib/vinOcr.ts");

// --- synthetic drawing ---------------------------------------------------------------------------------------------------
function canvas(w, h) { return { data: new Uint8ClampedArray(w * h).fill(25), width: w, height: h }; }
function rect(g, x, y, w, h, v = 235) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (i >= 0 && j >= 0 && i < g.width && j < g.height) g.data[j * g.width + i] = v; }
const T = 4, H = 44, W = 26;
const SHAPES = {
  I: (g, x, y) => rect(g, x + 11, y, T, H),
  // two stacked closed loops
  "8": (g, x, y) => { rect(g, x, y, W, T); rect(g, x, y + H / 2 - 2, W, T); rect(g, x, y + H - T, W, T); rect(g, x, y, T, H); rect(g, x + W - T, y, T, H); },
  // open on the left, no enclosed hole
  "3": (g, x, y) => { rect(g, x, y, W, T); rect(g, x, y + H / 2 - 2, W, T); rect(g, x, y + H - T, W, T); rect(g, x + W - T, y, T, H); },
  // stem + closed bowl in the upper half, lower right corner bare
  P: (g, x, y) => { rect(g, x, y, T, H); rect(g, x, y, W, T); rect(g, x, y + H / 2 - 2, W, T); rect(g, x + W - T, y, T, H / 2); },
  // boxy D: stem, full right side, top and bottom bars
  D: (g, x, y) => { rect(g, x, y, T, H); rect(g, x + W - T, y, T, H); rect(g, x, y, W, T); rect(g, x, y + H - T, W, T); },
};
function line(chars, { tilt = 0.02 } = {}) {
  const g = canvas(40 + chars.length * 32 + 60, 220);
  chars.split("").forEach((c, i) => { const x = 30 + i * 32; SHAPES[c](g, x, Math.round(80 + x * tilt)); });
  return g;
}

test("GLY-01 hole counts: a ring has one hole, an 8 two, an open 3 none; specks are not holes", () => {
  const w = 40, h = 60, ring = new Uint8Array(w * h), eight = new Uint8Array(w * h), open = new Uint8Array(w * h);
  const box = (m, x, y, bw, bh) => { for (let j = y; j < y + bh; j++) for (let i = x; i < x + bw; i++) m[j * w + i] = 1; };
  const outline = (m, x, y, bw, bh) => { box(m, x, y, bw, 3); box(m, x, y + bh - 3, bw, 3); box(m, x, y, 3, bh); box(m, x + bw - 3, y, 3, bh); };
  outline(ring, 5, 5, 30, 50);
  outline(eight, 5, 5, 30, 25); outline(eight, 5, 28, 30, 27);
  box(open, 5, 5, 30, 3); box(open, 5, 28, 30, 3); box(open, 5, 52, 30, 3); box(open, 32, 5, 3, 50);
  assert.equal(G.holeCount(ring, w, h), 1);
  assert.equal(G.holeCount(eight, w, h), 2);
  assert.equal(G.holeCount(open, w, h), 0);
  const speck = new Uint8Array(w * h); box(speck, 5, 5, 30, 50); speck[20 * w + 20] = 0; // a solid block with a one-pixel pinhole
  assert.equal(G.holeCount(speck, w, h), 0);
});

test("GLY-02 shape compatibility: an 8 can never be a 3; a glyph with a bare lower-right corner can never be a D", () => {
  assert.equal(G.holesCompatible("3", 2), false);
  assert.equal(G.holesCompatible("8", 2), true);
  assert.equal(G.holesCompatible("0", 1), true);
  assert.equal(G.holesCompatible("7", 1), false);
  assert.equal(G.cornerCompatible("D", "bare"), false);
  assert.equal(G.cornerCompatible("P", "bare"), true);
  assert.equal(G.cornerCompatible("P", "inked"), false);
  assert.equal(G.cornerCompatible("D", "inked"), true);
  assert.equal(G.cornerCompatible("D", "unclear"), true, "no opinion when the measurement is unclear");
  assert.equal(G.cornerState(0.0), "bare");
  assert.equal(G.cornerState(0.4), "inked");
  assert.equal(G.cornerState(0.1), "unclear");
});

test("GLY-03 a printed string is found as one run, tilted or not; short strings, speckle and blank images give no run", () => {
  for (const tilt of [0, 0.03, -0.04]) {
    const g = line("P8IIIIIIIIIIIII".slice(0, 12), { tilt });
    const { runs } = G.findGlyphRuns(g, 1, 10);
    const best = runs.sort((a, b) => G.runScore(b) - G.runScore(a))[0];
    assert.ok(best, `run found at tilt ${tilt}`);
    assert.equal(best.boxes.length, 12);
    assert.ok(best.boxes.every((b, i, a) => i === 0 || b.x0 > a[i - 1].x0), "ordered left to right");
  }
  assert.equal(G.findGlyphRuns(line("P8IIIII"), 1, 10).runs.length, 0, "7 glyphs is not a VIN-length string");
  assert.equal(G.findGlyphRuns(canvas(600, 300), 1, 10).runs.length, 0, "blank");
  const noise = canvas(600, 300); let s = 9; for (let i = 0; i < noise.data.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; noise.data[i] = 20 + ((s >>> 24) % 60); }
  assert.equal(G.findGlyphRuns(noise, 1, 10).runs.length, 0, "speckle");
  // dark-on-light prints are found with the opposite polarity
  const inv = line("P8IIIIIIIIII"); for (let i = 0; i < inv.data.length; i++) inv.data[i] = 255 - inv.data[i];
  assert.equal(G.findGlyphRuns(inv, -1, 10).runs.length > 0, true);
});

// Stub recogniser: call c belongs to glyph (c % n), setting floor(c / n). `script(k, cfg)` returns what the engine "saw".
function stub(n, script) { let c = 0; return async () => { const k = c % n, cfg = Math.floor(c / n); c++; return script(k, cfg); }; }
const CFGS = [{ mult: 0.8, grow: 0 }, { mult: 0.8, grow: 1 }, { mult: 1.0, grow: 1 }];

test("GLY-04 shape evidence overrides a confident wrong vote: the 8 beats the 3, the P beats the D", async () => {
  const chars = "P8IIIIIIIIII";
  const g = line(chars);
  const { runs, sig } = G.findGlyphRuns(g, 1, 10);
  const run = runs[0];
  const read = await G.readGlyphRun(sig, g.width, g.height, run, stub(12, (k, cfg) => {
    if (k === 0) return cfg === 0 ? { ch: "D", conf: 0.95 } : { ch: "P", conf: 0.4 };
    if (k === 1) return cfg === 0 ? { ch: "3", conf: 0.96 } : { ch: "8", conf: 0.5 };
    return { ch: "I", conf: 0.99 };
  }), CFGS);
  assert.equal(read.text, chars);
  assert.equal(read.positions[0].corner, "bare");
  assert.equal(read.positions[1].holes, 2);
  assert.ok(read.positions[0].share < 0.5, "the weakly supported P is reported as weakly supported, so the screen can highlight it");
});

test("GLY-05 no consistent vote means unread, never a guess", async () => {
  const g = line("P8IIIIIIIIII");
  const { runs, sig } = G.findGlyphRuns(g, 1, 10);
  const read = await G.readGlyphRun(sig, g.width, g.height, runs[0], stub(12, (k) => (k === 1 ? { ch: "3", conf: 0.99 } : k === 2 ? { ch: null, conf: 0 } : { ch: "I", conf: 0.9 })), CFGS);
  assert.equal(read.positions[1].ch, null, "the engine only ever said 3 for an 8-shaped glyph: unread");
  assert.equal(read.positions[2].ch, null, "the engine said nothing: unread");
  assert.match(read.text, /^.\?\?/);
});

test("GLY-06 the glyph reader never consults the check digit, and a read that fails it is returned exactly as read", () => {
  const src = fs.readFileSync(path.join(SRC, "lib", "vinGlyphs.ts"), "utf8");
  assert.doesNotMatch(src, /validateVin|checkDigit|computeCheck|transliterat/i, "the check digit must never select characters");
  assert.doesNotMatch(src, /WBAP|BMW|W[A-Z]{2}[0-9A-Z]{14}/, "no vehicle-specific data in the reader");
  const bad = "WBAPH7C53AA175760"; // check digit wrong on purpose
  const ranked = OCR.rankVinReads([], [{ vin: bad, afterVinLabel: false, confidences: Array(17).fill(100) }]);
  assert.equal(ranked.vin, bad, "returned exactly as read, not corrected");
  assert.equal(ranked.checkDigitOk, false);
  const good = OCR.rankVinReads([], [{ vin: "WBAPH7C58AA175760", afterVinLabel: false, confidences: Array(17).fill(100) }]);
  assert.equal(good.checkDigitOk, true);
  assert.equal(OCR.rankVinReads([], [{ vin: "GAWRFRT2183LBS990", afterVinLabel: false, confidences: [] }]), null, "label text is never offered");
});

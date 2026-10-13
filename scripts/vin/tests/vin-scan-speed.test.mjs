// Scan speed and VIN character rules. Pure and fast (no engine): the worker pool with fake workers, the BMP tile encoder, the sliced
// shape search, the order-independent vote tally, the stop-at-first-valid-run rule, and the I/O/Q rules.
// The real photograph through the real engine is pinned in scripts/vin/ocr-tests/ and tests/e2e/vin-label-photo.spec.ts.
// Rules pinned here: speed never changes WHAT is read (same votes in the same order whatever finishes first); a faster path never
// uses the check digit to choose characters; I, O and Q are never offered as a replacement, an alternative or a suggestion.
import { test } from "node:test";
import assert from "node:assert/strict";
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
const P = await bundle("lib/ocrPool.ts");
const G = await bundle("lib/vinGlyphs.ts");
const OCR = await bundle("lib/vinOcr.ts");
const V = await bundle("lib/vin.ts");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function fakeWorker(name, log, ms = 5) {
  const w = { name, psm: null, running: 0, maxRunning: 0, terminated: false, calls: 0 };
  w.setParameters = async (p) => { log.push(`${name}:psm=${p.tessedit_pageseg_mode}`); w.psm = p.tessedit_pageseg_mode; };
  w.recognize = async (img) => { w.running++; w.maxRunning = Math.max(w.maxRunning, w.running); w.calls++; log.push(`${name}:run=${img}`); await sleep(ms); w.running--; return { data: { text: String(img), confidence: 90 } }; };
  w.terminate = async () => { w.terminated = true; };
  return w;
}

// --- the pool ------------------------------------------------------------------------------------------------------------------
test("SPD-01 one worker runs the lowest priority number first, then in the order submitted; the page-segmentation mode is set only when it changes", async () => {
  const log = [];
  const pool = new P.OcrPool();
  const w = fakeWorker("w", log);
  // queued before any worker exists: nothing runs until one is added
  const done = [
    pool.submit(3, "slow", (x) => x.recognize("c3-a")),
    pool.submit(1, "fast", (x) => x.recognize("c1-a")),
    pool.submit(2, "glyph", (x) => x.recognize("c2-a")),
    pool.submit(1, "fast", (x) => x.recognize("c1-b")),
    pool.submit(3, "slow", (x) => x.recognize("c3-b")),
  ];
  await sleep(10);
  assert.equal(log.length, 0, "nothing runs without a worker");
  pool.add(w);
  await Promise.all(done);
  assert.deepEqual(log.filter((l) => l.includes("run=")).map((l) => l.split("run=")[1]), ["c1-a", "c1-b", "c2-a", "c3-a", "c3-b"]);
  assert.deepEqual(log.filter((l) => l.includes("psm=")), ["w:psm=fast", "w:psm=glyph", "w:psm=slow"], "mode set once per change, not once per call");
  await pool.terminateAll();
});

test("SPD-02 extra workers overlap the work; one worker never runs two calls at once", async () => {
  const log = [];
  const pool = new P.OcrPool();
  const ws = [fakeWorker("a", log, 20), fakeWorker("b", log, 20), fakeWorker("c", log, 20)];
  ws.forEach((w) => pool.add(w));
  const t0 = Date.now();
  const out = await Promise.all(Array.from({ length: 9 }, (_, i) => pool.submit(2, "glyph", async (x) => (await x.recognize(`t${i}`)).data.text)));
  const took = Date.now() - t0;
  assert.deepEqual(out, Array.from({ length: 9 }, (_, i) => `t${i}`), "each caller gets its own answer back");
  assert.ok(ws.every((w) => w.maxRunning === 1), "a worker is never double-booked");
  assert.ok(ws.every((w) => w.calls === 3), "work is shared evenly");
  assert.ok(took < 150, `9 calls of 20 ms on 3 workers overlap (took ${took} ms)`);
  await pool.terminateAll();
});

test("SPD-03 cancel drops waiting work, rejects new work, and a worker added late is shut down", async () => {
  const log = [];
  const pool = new P.OcrPool();
  const w = fakeWorker("w", log, 30);
  pool.add(w);
  const first = pool.submit(1, "x", (x) => x.recognize("running"));
  const waiting = pool.submit(1, "x", (x) => x.recognize("waiting"));
  const waitingResult = waiting.then(() => "ran", (e) => e);
  await sleep(5);
  pool.cancel();
  assert.ok((await waitingResult) instanceof P.PoolCancelled, "queued call is dropped");
  await first; // the call that had already started finishes
  await assert.rejects(pool.submit(1, "x", (x) => x.recognize("late")), P.PoolCancelled);
  const late = fakeWorker("late", log);
  pool.add(late);
  await sleep(5);
  assert.equal(late.terminated, true, "a worker that arrives after the scan ended is terminated, not leaked");
  await pool.terminateAll();
  assert.equal(w.terminated, true);
});

test("SPD-04 one engine worker per spare core, between one and three; a missing or silly core count is treated as two cores", () => {
  const cases = [[undefined, 1], [0, 1], [1, 1], [2, 1], [3, 2], [4, 3], [8, 3], [64, 3], [Number.NaN, 1], [-4, 1], [Infinity, 1], [2.9, 1]];
  for (const [cores, want] of cases) assert.equal(P.poolSizeFor(cores), want, `cores=${cores}`);
});

// --- the tile encoder ----------------------------------------------------------------------------------------------------------
test("SPD-05 a glyph tile is encoded as a valid 8-bit greyscale BMP and every pixel round-trips (odd widths are padded)", () => {
  for (const width of [1, 3, 4, 5, 37, 96]) {
    const height = 7;
    const data = Uint8ClampedArray.from({ length: width * height }, (_, i) => (i * 37 + width) % 256);
    const bmp = G.encodeGrayBmp({ data, width, height });
    const dv = new DataView(bmp.buffer, bmp.byteOffset, bmp.byteLength);
    assert.equal(String.fromCharCode(bmp[0], bmp[1]), "BM");
    assert.equal(dv.getUint32(2, true), bmp.length, "declared size");
    assert.equal(dv.getInt32(18, true), width);
    assert.equal(dv.getInt32(22, true), height, "bottom-up rows");
    assert.equal(dv.getUint16(28, true), 8, "8 bits per pixel");
    const rowBytes = (width + 3) & ~3;
    const at = dv.getUint32(10, true);
    assert.equal(bmp.length, at + rowBytes * height);
    for (const i of [0, 77, 128, 255]) assert.deepEqual([bmp[54 + i * 4], bmp[55 + i * 4], bmp[56 + i * 4]], [i, i, i], "palette is the grey ramp");
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) assert.equal(bmp[at + (height - 1 - y) * rowBytes + x], data[y * width + x], `pixel ${x},${y} at width ${width}`);
  }
});

// --- drawing helpers (two printed lines of evenly spaced bars) -----------------------------------------------------------------
function canvas(w, h) { return { data: new Uint8ClampedArray(w * h).fill(25), width: w, height: h }; }
function rect(g, x, y, w, h, v = 235) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (i >= 0 && j >= 0 && i < g.width && j < g.height) g.data[j * g.width + i] = v; }
function bars(g, n, y, pitch = 32) { for (let i = 0; i < n; i++) rect(g, 30 + i * pitch, y, 4, 44); }

test("SPD-06 the sliced shape search gives exactly the same runs as the one-piece search, and hands the thread back many times", async () => {
  const g = canvas(640, 220);
  bars(g, 17, 80);
  let ticks = 0;
  const a = G.findGlyphRuns(g, 1, 10);
  const b = await G.findGlyphRunsAsync(g, 1, 10, async () => { ticks++; });
  assert.deepEqual(b.runs, a.runs);
  assert.equal(b.runs.length > 0, true);
  assert.ok(ticks >= 8, `the search yields to the page in small slices (${ticks} slices)`);
});

// --- the vote tally does not depend on timing ------------------------------------------------------------------------------------
test("SPD-07 the glyph tally is identical whether answers arrive in order or in a shuffled order", async () => {
  const g = canvas(640, 220);
  bars(g, 17, 80);
  const { runs, sig } = G.findGlyphRuns(g, 1, 10);
  const run = runs.sort((x, y) => G.runScore(y) - G.runScore(x))[0];
  const CFGS = [{ mult: 0.8, grow: 0 }, { mult: 0.8, grow: 1 }, { mult: 1.0, grow: 1 }, { mult: 1.0, grow: 2 }];
  const script = (c) => ({ ch: c % 3 === 0 ? "J" : c % 5 === 0 ? "L" : "H", conf: 0.5 + ((c * 7) % 40) / 100 });
  const mk = (delay) => { let c = 0; return async () => { const i = c++; await sleep(delay(i)); return script(i); }; };
  const inOrder = await G.readGlyphRun(sig, g.width, g.height, run, mk(() => 0), CFGS);
  const shuffled = await G.readGlyphRun(sig, g.width, g.height, run, mk((i) => (i * 37) % 11), CFGS);
  assert.deepEqual(shuffled, inOrder);
});

// --- stop at the first valid run -------------------------------------------------------------------------------------------------
test("SPD-08 a second run is read only when the first did not already give a valid VIN", async () => {
  const g = canvas(640, 420);
  bars(g, 17, 60);
  bars(g, 17, 270);
  const count = async (opts) => { let n = 0; await OCR.glyphVinReads(g, async () => { n++; return { ch: "H", conf: 0.9 }; }, undefined, opts); return n; };
  assert.equal(await count({}), 2 * 12 * 17, "no verdict from the caller: both strong runs are read");
  assert.equal(await count({ isDone: () => false }), 2 * 12 * 17, "first read not good enough: the second run is read too");
  assert.equal(await count({ isDone: () => true }), 12 * 17, "first read already valid: the second run is skipped");
});

test("SPD-09 the search stops at the first strong run and does not scan the remaining settings", async () => {
  const strong = canvas(640, 220);
  bars(strong, 17, 80);
  const none = canvas(640, 220); // nothing printed: every setting has to be tried
  const tried = async (g) => { let n = -1; await OCR.glyphVinReads(g, async () => ({ ch: "H", conf: 0.9 }), undefined, { tick: async () => {}, isDone: () => true, onDetected: (_found, settings) => { n = settings; } }); return n; };
  assert.equal(await tried(strong), 1, "a full-length evenly sized line at the first setting ends the search");
  assert.equal(await tried(none), 8, "with nothing found, all eight settings are tried (both polarities, four radii)");
});

test("SPD-10 the speed-ups never use the check digit: the pool, the tally and the reader never mention it", async () => {
  const fs = await import("node:fs");
  for (const f of ["lib/ocrPool.ts", "lib/vinGlyphs.ts"]) {
    const src = fs.readFileSync(path.join(SRC, f), "utf8");
    assert.doesNotMatch(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""), /validateVin|checkDigit|isValidVin/, `${f} must not choose characters by the check digit`);
  }
});

// --- VIN characters: I, O and Q ---------------------------------------------------------------------------------------------------
const BASE = "WBAPH7C58AA175760";
const IOQ = /[IOQ]/;

test("SPD-11 no correction suggestion ever contains I, O or Q, for any single-character misread of a valid VIN", () => {
  assert.equal(V.validateVin(BASE).ok, true);
  const alphabet = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"];
  let checked = 0;
  for (let i = 0; i < 17; i++) for (const c of alphabet) {
    const mutated = BASE.slice(0, i) + c + BASE.slice(i + 1);
    for (const s of V.suggestCorrections(mutated)) {
      checked++;
      assert.doesNotMatch(s.to, IOQ, `${mutated} -> ${s.vin}`);
      assert.doesNotMatch(s.vin, IOQ);
      assert.equal(V.validateVin(s.vin).ok, true, "a suggestion is always a fully valid VIN");
    }
  }
  assert.ok(checked > 10, "the exhaustive sweep produced suggestions to check");
});

test("SPD-12 a read containing I, O or Q is returned exactly as read, fails validation, and its position is flagged; the letter is never swapped silently", () => {
  for (const bad of ["I", "O", "Q"]) {
    const read = BASE.slice(0, 15) + bad + BASE.slice(16);
    assert.equal(V.normalizeVin(read), read, "normalizing never rewrites a letter");
    const v = V.validateVin(read);
    assert.equal(v.ok, false);
    assert.equal(v.problem, "characters");
    assert.ok(V.uncertainPositions(read).includes(15), `${bad} at position 16 is highlighted`);
    for (const s of V.suggestCorrections(read)) assert.doesNotMatch(s.to, IOQ);
  }
});

test("SPD-13 the ranked alternatives never list a reading with I, O or Q in it", () => {
  const good = { vin: BASE, confidences: Array(17).fill(95), afterVinLabel: true };
  const withO = { vin: BASE.slice(0, 15) + "O" + BASE.slice(16), confidences: Array(17).fill(90), afterVinLabel: false };
  const withI = { vin: BASE.slice(0, 14) + "I" + BASE.slice(15), confidences: Array(17).fill(90), afterVinLabel: false };
  const other = { vin: "WBAPH7C58AA175761", confidences: Array(17).fill(60), afterVinLabel: false };
  const r = OCR.rankVinReads([], [good, withO, withI, other]);
  assert.equal(r.vin, BASE);
  assert.ok(r.alternatives.includes("WBAPH7C58AA175761"), "an ordinary other reading may still be listed");
  for (const a of r.alternatives) assert.doesNotMatch(a, IOQ, `alternative ${a}`);
});

test("SPD-14 the glyph reader never lists I, O or Q as an alternative character, and keeps its low-confidence share", async () => {
  const g = canvas(640, 220);
  bars(g, 17, 80);
  const { runs, sig } = G.findGlyphRuns(g, 1, 10);
  const run = runs.sort((x, y) => G.runScore(y) - G.runScore(x))[0];
  const CFGS = [0, 1, 2, 3].map((grow) => ({ mult: 0.8, grow }));
  // each bar is read mostly as H, sometimes as I (not a VIN letter) and J (a legal letter)
  const read = await G.readGlyphRun(sig, g.width, g.height, run, (() => { let c = 0; return async () => ({ ch: ["H", "H", "I", "J"][c++ % 4], conf: 0.9 }); })(), CFGS);
  for (const pos of read.positions) {
    assert.equal(pos.ch, "H");
    assert.equal(pos.alternatives.some((a) => IOQ.test(a.ch)), false, "no I/O/Q alternative");
    assert.equal(pos.alternatives.some((a) => a.ch === "J"), true, "a legal alternative is kept");
    assert.ok(pos.share < 0.6, `a split vote stays a low-confidence read (${pos.share})`);
  }
});

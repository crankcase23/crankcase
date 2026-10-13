import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const require = createRequire(import.meta.url);
async function bundle(entry) {
  const esbuild = require("esbuild");
  const out = await esbuild.build({
    entryPoints: [path.join(ROOT, entry)], bundle: true, format: "esm", platform: "node", write: false,
    external: ["tesseract.js"], alias: { "@": path.join(ROOT, "src") },
  });
  return import("data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64"));
}
const vin = await bundle("src/lib/vin.ts");
const ocr = await bundle("src/lib/vinOcr.ts");

const GOOD = "1HGCM82633A004352"; // the standard published example, check digit 3
const OWNERS = "WBAPH7C58AA175760"; // a real US-market BMW: imports carry valid check digits too
const withCheck = (v17, pos = 8) => { const a = v17.split(""); a[pos] = "0"; const d = vin.checkDigitFor(a.join("")); a[pos] = d; return a.join(""); };

test("valid VINs pass: published example, a US-market import, and lowercase/spaced/dashed spellings of the same VIN", () => {
  assert.equal(vin.validateVin(GOOD).ok, true);
  assert.equal(vin.validateVin(OWNERS).ok, true);
  assert.equal(vin.validateVin(" 1hgcm 8263-3a004352 ").ok, true);
  assert.equal(vin.canonicalVin("1hgcm82633a004352"), GOOD);
});

test("format rules: length, I/O/Q, symbols, empty", () => {
  assert.equal(vin.validateVin("").problem, "empty");
  assert.equal(vin.validateVin(GOOD.slice(1)).problem, "length");
  assert.equal(vin.validateVin(GOOD + "1").problem, "length");
  const withO = GOOD.slice(0, 3) + "O" + GOOD.slice(4);
  const r = vin.validateVin(withO);
  assert.equal(r.problem, "characters");
  assert.deepEqual(r.badPositions, [3]);
  assert.equal(vin.validateVin(GOOD.slice(0, 5) + "*" + GOOD.slice(6)).problem, "characters");
  for (const bad of ["I", "O", "Q"]) assert.equal(vin.validateVin(GOOD.slice(0, 10) + bad + GOOD.slice(11)).ok, false);
});

test("check digit is enforced for every VIN, including the X case, and a one-character misread is caught", () => {
  const x = withCheck("1C4RJFBG0EC123456");
  assert.equal(x[8], "X");
  assert.equal(vin.validateVin(x).ok, true);
  const wrong = GOOD.slice(0, 8) + "4" + GOOD.slice(9);
  assert.equal(vin.validateVin(wrong).problem, "check-digit");
  // flipping any single character of a valid VIN to another legal one is caught, except where weights make it collide
  let caught = 0, total = 0;
  for (let i = 0; i < 17; i++) {
    if (i === 8) continue;
    const alt = GOOD[i] === "5" ? "6" : "5";
    total++;
    if (!vin.validateVin(GOOD.slice(0, i) + alt + GOOD.slice(i + 1)).ok) caught++;
  }
  assert.equal(caught, total, "every single-character substitution of this VIN must fail the check digit");
});

test("normalizing never swaps a character: O stays O, I stays I, and the VIN is rejected rather than 'repaired'", () => {
  const raw = "1HGCM826O3A0O4352";
  assert.equal(vin.normalizeVin(raw), raw);
  assert.equal(vin.validateVin(raw).ok, false);
  assert.ok(vin.normalizeVin(raw).includes("O") && vin.normalizeVin(raw)[8] === "O");
});

test("corrections are only OFFERED: a misread 8 as B is suggested, nothing is applied, and the suggestion really validates", () => {
  const withB = GOOD.slice(0, 5) + "B" + GOOD.slice(6); // a camera reads 8 as B
  assert.ok(vin.suggestCorrections(withB).some((s) => s.vin === GOOD && s.from === "B" && s.to === "8"));
  for (const s of vin.suggestCorrections(withB)) assert.equal(vin.validateVin(s.vin).ok, true);
  assert.equal(vin.validateVin(withB).ok, false, "the original is untouched");
});

test("candidate extraction: finds the VIN in noisy OCR text, keeps illegal characters visible, valid first", () => {
  const text = "MFD BY HONDA\nVIN: 1HGCM82633A004352\nGVWR 4000 LB";
  assert.deepEqual(vin.extractVinCandidates(text)[0], GOOD);
  assert.deepEqual(vin.extractVinCandidates("1HGCM 82633 A004352")[0], GOOD);
  const read = "1HGCM826O3A004352"; // O where a 0 belongs
  assert.equal(vin.extractVinCandidates(read)[0], read, "shown exactly as read");
  assert.deepEqual(vin.extractVinCandidates("nothing here"), []);
});

test("uncertain characters are highlighted: illegal letters, low OCR confidence, lookalikes of a failing VIN", () => {
  assert.ok(vin.uncertainPositions("1HGCM826O3A004352").includes(8), "the O is flagged");
  const conf = Array(17).fill(99); conf[4] = 40;
  assert.deepEqual(vin.uncertainPositions(GOOD, conf), [4]);
  assert.deepEqual(vin.uncertainPositions(GOOD), [], "a valid VIN with no doubt has nothing to highlight");
  assert.deepEqual(vin.uncertainPositions(GOOD.slice(0, 5) + "B" + GOOD.slice(6)), [5], "only the swap that would make the VIN valid is pointed at");
});

// ------------------------------------------------------------------------------------------------ photo handling
const bytes = (...n) => Uint8Array.from(n);
test("uploads are identified by their bytes, not their name: only real JPEG/PNG/WebP are accepted", () => {
  assert.equal(ocr.sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0)), "jpeg");
  assert.equal(ocr.sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0)), "png");
  const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
  assert.equal(ocr.sniffImageType(webp), "webp");
  assert.equal(ocr.sniffImageType(new TextEncoder().encode("<svg onload=alert(1)>")), null, "SVG (script-capable) is refused");
  assert.equal(ocr.sniffImageType(new TextEncoder().encode("%PDF-1.7")), null);
  assert.equal(ocr.sniffImageType(new TextEncoder().encode("MZ\x90\x00 an exe renamed to .jpg")), null);
  assert.equal(ocr.sniffImageType(bytes()), null);
});

test("a decompression-bomb PNG/JPEG is refused from its header before anything decodes it", () => {
  const png = new Uint8Array(33); png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const dv = new DataView(png.buffer); dv.setUint32(16, 30000); dv.setUint32(20, 30000);
  assert.equal(ocr.declaredPixels(png, "png"), 900_000_000);
  assert.ok(ocr.declaredPixels(png, "png") > ocr.MAX_PHOTO_PIXELS);
  const j2 = new Uint8Array(30); j2.set([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08]); new DataView(j2.buffer).setUint16(7, 6000); new DataView(j2.buffer).setUint16(9, 6000);
  assert.equal(ocr.declaredPixels(j2, "jpeg"), 36_000_000);
});

test("OCR page results become candidates with per-character confidence; a hesitant read is flagged, not corrected", () => {
  const sym = (t, c) => ({ text: t, confidence: c });
  const text = "1HGCM826O3A004352";
  const page = { text, blocks: [{ paragraphs: [{ lines: [{ words: [{ symbols: [...text].map((t, i) => sym(t, i === 8 ? 52 : 97)) }] }] }] }] };
  const found = ocr.candidatesFromPage(page);
  assert.equal(found[0].vin, text);
  assert.equal(found[0].confidences[8], 52);
  assert.ok(vin.uncertainPositions(found[0].vin, found[0].confidences).includes(8));
  assert.deepEqual(ocr.candidatesFromPage({ text: "no vin" }), []);
});

test("the photo path never uploads or stores anything", () => {
  const pool = fs.readFileSync(path.join(ROOT, "src/lib/ocrPool.ts"), "utf8");
  const src = fs.readFileSync(path.join(ROOT, "src/lib/vinOcr.ts"), "utf8") + fs.readFileSync(path.join(ROOT, "src/components/vin/VinField.tsx"), "utf8") + pool + fs.readFileSync(path.join(ROOT, "src/lib/vinGlyphs.ts"), "utf8");
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|FormData|localStorage|sessionStorage|indexedDB|FileReader\.readAsDataURL|toDataURL|toBlob/.test(src), "no network or storage call in the scan path");
  assert.ok(/input\.value = ""/.test(src), "the file reference is dropped right after pick");
  // Every engine worker is shut down when the scan ends (the pool does it for all of them) and the canvases are emptied.
  assert.ok(/await pool\.terminateAll\(\)/.test(src) && /worker\.terminate\(\)/.test(pool) && /c\.width = c\.height = 0/.test(src));
  assert.ok(/capture="environment"/.test(src) && /accept="image\/jpeg,image\/png,image\/webp"/.test(src));
});

// ------------------------------------------------------------------------------------------ server enforcement (static)
test("server: every add validates the VIN first, no other code inserts a garage row, and service/odometer never provision one", () => {
  const route = fs.readFileSync(path.join(ROOT, "src/app/api/garage/route.ts"), "utf8");
  assert.equal((route.match(/validateVin\(/g) ?? []).length, 3, "catalog, custom and the NHTSA-outage fallback adds all validate");
  assert.ok(route.indexOf("validateVin(body.vin)") < route.indexOf("addCatalogEntry(userId"));
  assert.ok(route.indexOf("validateVin(c.vin)") < route.indexOf("addCustomEntry(userId"));
  assert.ok(route.lastIndexOf("validateVin(c.vin)") < route.indexOf("addViaFallback(userId"), "the fallback validates the VIN before anything else");
  // The fallback never inserts a garage row itself: the only insert stays inside addCustomEntry (same VIN rules).
  const fb = fs.readFileSync(path.join(ROOT, "src/lib/vinFallbackServer.ts"), "utf8");
  assert.ok(!/insert\(garageEntries\)/.test(fb), "the fallback adds through addCustomEntry, not its own insert");
  const ge = fs.readFileSync(path.join(ROOT, "src/lib/garageEntries.ts"), "utf8");
  assert.equal((ge.match(/insert\(garageEntries\)/g) ?? []).length, 2, "only addCatalogEntry and addCustomEntry insert");
  assert.ok(!/create:\s*true/.test(ge));
  for (const f of ["service/route.ts", "odometer/route.ts"]) {
    const r = fs.readFileSync(path.join(ROOT, "src/app/api/garage/[id]", f), "utf8");
    assert.ok(!/create:\s*true/.test(r) && /NOT_IN_GARAGE/.test(r), f);
  }
  const resp = fs.readFileSync(path.join(ROOT, "src/lib/garageResponses.ts"), "utf8");
  assert.ok(/VIN_IN_GARAGE/.test(resp) && !/VIN_CLAIM_REQUIRED/.test(resp) && !/userId|email|another (customer|user|owner|account)/i.test(resp), "the blocked response names no one");
  // No VIN squatting: nothing may look at OTHER accounts' rows by VIN. The only VIN lookups are scoped to the caller.
  for (const f of ["src/lib/garageEntries.ts", "src/lib/vinFallbackServer.ts", "src/app/api/garage/route.ts", "src/app/api/garage/[id]/vin/route.ts"]) {
    const src = fs.readFileSync(path.join(ROOT, f), "utf8");
    assert.ok(!/vinHeldByAnotherAccount|vin-claim-required|VIN_CLAIM_REQUIRED/.test(src), `${f}: no cross-account VIN check`);
    assert.ok(!/ne\(garageEntries\.userId/.test(src), `${f}: no query over other accounts' rows`);
  }
  assert.ok(/eq\(garageEntries\.userId, userId\), sameVin\(vin\)/.test(ge), "the one VIN lookup is scoped to the caller");
});

test("only text is a VIN: numbers, arrays and objects that stringify to 17 characters are refused", () => {
  for (const v of [12345678901234567, [GOOD], { toString: () => GOOD }, null, undefined, true]) assert.equal(vin.validateVin(v).ok, false);
});

test("probe protection: every VIN lookup is guarded first, and the VIN itself is never stored", () => {
  const route = fs.readFileSync(path.join(ROOT, "src/app/api/garage/route.ts"), "utf8");
  assert.ok(route.indexOf("guardVinAttempt(request") < route.indexOf("addCatalogEntry(userId"), "catalog add is guarded before the lookup");
  assert.ok(route.indexOf("guardVinAttempt(request", route.indexOf("addCatalogEntry(userId")) < route.indexOf("addCustomEntry(userId"), "custom add is guarded before the lookup");
  assert.equal((route.match(/noteVinCollision\(/g) ?? []).length, 0, "there are no cross-account collisions to count any more");
  assert.ok(route.lastIndexOf("guardVinAttempt(request") < route.indexOf("addViaFallback(userId"), "the fallback add is guarded before the lookup");
  const verify = fs.readFileSync(path.join(ROOT, "src/app/api/garage/[id]/verify/route.ts"), "utf8");
  assert.ok(verify.indexOf("guardVinAttempt(request") < verify.indexOf("verifyOwnEntry(userId"), "re-check is guarded before it asks NHTSA");
  const comp = fs.readFileSync(path.join(ROOT, "src/app/api/garage/[id]/vin/route.ts"), "utf8");
  assert.ok(comp.indexOf("guardVinAttempt(request") < comp.indexOf("completeGarageVin(userId"), "completion is guarded too");
  const g = fs.readFileSync(path.join(ROOT, "src/lib/vinGuard.ts"), "utf8");
  assert.ok(/VIN_RATE_LIMITED/.test(g) && /Retry-After/.test(g));
  assert.ok(!/metadata:\s*\{[^}]*vin\b/i.test(g), "no VIN in stored metadata");
  assert.ok(/createHash\("sha256"\)/.test(g), "network address stored only as a salted hash");
  assert.ok(!/another (customer|user|owner|account)/i.test(g.split("NextResponse.json(")[1] ?? ""), "the 429 body names no one");
});

test("fallback cap is reserve-then-count: the allowance is claimed before the lookup and released on every non-adding path", () => {
  const fb = fs.readFileSync(path.join(ROOT, "src/lib/vinFallbackServer.ts"), "utf8");
  const reserve = fb.indexOf("insert(appEvents)");
  const count = fb.indexOf("fallbackAddsInLastDay(userId)) >");
  const probe = fb.indexOf("await probe(vin)");
  const add = fb.indexOf("await addCustomEntry(\n        userId");
  assert.ok(reserve > 0 && reserve < count && count < probe && probe < add, "reserve, then count (including the reservation), then probe, then add");
  assert.ok(/> FALLBACK_DAILY_CAP/.test(fb) && !/>= FALLBACK_DAILY_CAP/.test(fb), "the count includes this request's own reservation");
  assert.ok((fb.match(/await release\(\)/g) ?? []).length >= 5, "cap, not-decodable, mismatch, blocked/existing and error paths all release");
});

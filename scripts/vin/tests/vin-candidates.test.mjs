// REGRESSIONS for the real customer bug (2026-10-12): a clear BMW door-jamb VIN label (WBAPH7C58AA175760) was read as
// "SINEFFECTONTHEDAT", a 17-letter slice of the label's legal warning ("...STANDARDS IN EFFECT ON THE DATE OF MANUFACTURE").
// Root causes, each pinned below:
//   1. extraction slid a 17-character window over any short line and joined up to five adjacent words, with no test that the
//      result looks like a VIN (text with no digits, illegal letters, a letter where the check digit goes);
//   2. when nothing passed the check digit, the scanner offered the read that REPEATED most across passes, and printed legal
//      text repeats in every pass while a hard-to-read VIN does not.
// A scan is only ever offered for the customer to confirm; nothing here may correct a character.
// VIN_TEST_SRC points the suite at an older copy of src/ to prove these tests fail on the old code.
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
const vin = await bundle("lib/vin.ts");
const ocr = await bundle("lib/vinOcr.ts");

const BMW = "WBAPH7C58AA175760";
const LEGAL = [
  "THIS VEHICLE CONFORMS TO ALL APPLICABLE U.S. FEDERAL MOTOR VEHICLE SAFETY,",
  "BUMPER AND THEFT PREVENTION STANDARDS IN EFFECT ON THE DATE OF MANUFACTURE",
  "SHOWN ABOVE. THIS VEHICLE CONFORMS TO ALL APPLICABLE CANADIAN MOTOR VEHICLE",
  "SAFETY STANDARDS IN EFFECT ON THE DATE OF MANUFACTURE.",
];
// An OCR page as the engine returns it: lines of words of symbols with confidences.
const sym = (t, c = 95) => ({ text: t, confidence: c });
const page = (lines, conf = {}) => {
  const text = lines.join("\n");
  return { text, blocks: [{ paragraphs: [{ lines: lines.map((l) => ({ words: l.split(/\s+/).filter(Boolean).map((w) => ({ symbols: [...w].map((t, i) => sym(t, conf[w]?.[i] ?? 95)) })) })) }] }] };
};
const isLegalText = (v) => !/[0-9]{4}/.test(v) && /^[A-Z]+$/.test(v);

test("CAND-01 the reported bug: a short wrapped legal line never yields SINEFFECTONTHEDAT", () => {
  // 'S IN EFFECT ON THE DATE OF' compacts to 20 characters; a 17-wide window over it starts with SINEFFECTONTHEDAT
  const got = vin.extractVinCandidates("MFD BY BMW AG\nS IN EFFECT ON THE DATE OF\nVIN WBAPH7C58AA175760");
  assert.ok(!got.includes("SINEFFECTONTHEDAT"), `legal text offered as a VIN: ${got}`);
  assert.deepEqual(got, [BMW]);
  const run = vin.extractVinCandidates("SINEFFECTONTHEDATEOF");
  assert.deepEqual(run, [], "a short run of letters is not a VIN");
});

test("CAND-02 words joined across a wrapped warning (up to five words) never become candidates", () => {
  const got = vin.extractVinCandidates(LEGAL.join("\n"));
  assert.deepEqual(got, [], `legal text produced candidates: ${got}`);
  assert.ok(!vin.extractVinCandidates("STANDARDS IN EFFECT ON THE").length);
  assert.ok(!vin.extractVinCandidates("MOTOR VEHICLE SAFETY STANDARDS").length);
});

test("CAND-03 repeated legal text cannot outvote a VIN the camera read once with one wrong character", () => {
  const glare = "WBAPH7C58AA17576C"; // last character misread, so the check digit fails
  const lines = ["S IN EFFECT ON THE DATE OF", "VIN " + glare];
  const pages = [page(lines), page(lines), page(lines), page(["S IN EFFECT ON THE DATE OF"]), page(["S IN EFFECT ON THE DATE OF"]), page(["S IN EFFECT ON THE DATE OF"])];
  const r = ocr.rankVinReads(pages);
  assert.ok(r, "the VIN-like read is offered");
  assert.equal(r.vin, glare, "offered exactly as read, never corrected");
  assert.equal(r.checkDigitOk, false, "flagged: it fails the VIN check");
  assert.ok(!r.alternatives.some(isLegalText));
});

test("CAND-04 a photo containing only label text is unreadable, not a legal-text 'VIN'", () => {
  const pages = [1, 2, 3, 4, 5, 6].map(() => page(["S IN EFFECT ON THE DATE OF", ...LEGAL]));
  assert.equal(ocr.rankVinReads(pages), null);
});

test("CAND-05 ranking is by evidence: a valid VIN beats look-alike label numbers; a labelled near-miss beats a repeated number string", () => {
  const withNumbers = ["GVWR 4276 LBS 1940 KG", "VIN " + BMW];
  const r = ocr.rankVinReads([page(withNumbers)]);
  assert.equal(r.vin, BMW);
  assert.equal(r.checkDigitOk, true);
  // the VIN misread, while a weights line (17 characters, plenty of digits) is read in every pass
  const bad = "WBAPH7C58AA1757B0";
  const p = (n) => Array.from({ length: n }, () => page(["GVWR4276LBS1940KG", "VIN " + bad]));
  const r2 = ocr.rankVinReads(p(5));
  assert.equal(r2.vin, bad, "the number printed after the word VIN outranks the weights line");
});

test("CAND-06 nothing is substituted: a lookalike swap that would validate is not applied; the read stays as read", () => {
  const withO = "WBAPH7C58AA17576O"; // O where the 0 belongs
  const r = ocr.rankVinReads([page(["VIN " + withO])]);
  assert.equal(r.vin, withO);
  assert.equal(r.checkDigitOk, false);
  assert.ok(vin.suggestCorrections(withO).some((s) => s.vin === BMW), "the correction is only OFFERED by suggestCorrections");
  // and the screen still demands the customer's own confirmation before a scanned VIN can be looked up
  const field = fs.readFileSync(path.join(ROOT, "src/components/vin/VinField.tsx"), "utf8");
  assert.ok(/canLookup = check\.ok && \(!fromScan \|\| confirmed\)/.test(field));
  assert.ok(/data-testid="vin-confirm-scan"/.test(field));
});

test("CAND-07 shape rules: letters/digits only, 17 long, at most two I/O/Q, at least four digits, position 9 a digit/X/lookalike", () => {
  const ok = (s) => vin.isPlausibleVinRead(s);
  assert.equal(ok(BMW), true);
  assert.equal(ok("1HGCM82633A004352"), true);
  assert.equal(ok("WBAPH7C58AA17576O"), true, "one misread O is tolerated (and shown)");
  assert.equal(ok("SINEFFECTONTHEDAT"), false, "no digits");
  assert.equal(ok("STANDARDSINEFFECT"), false, "no digits");
  assert.equal(ok("WBAPH7C58AA1757"), false, "too short");
  assert.equal(ok("WBAPH7C58AA1757600"), false, "too long");
  assert.equal(ok("WBAPH7C5-AA175760"), false, "symbol");
  assert.equal(ok("OOAPH7C58AA175760"), true, "two O");
  assert.equal(ok("OOQPH7C58AA175760"), false, "three illegal letters");
  assert.equal(ok("WBAPH7C5MAA175760"), false, "a letter at the check-digit position that is not a digit lookalike");
  assert.equal(ok("ABCDEFGHJKLMNPRST"), false);
});

test("CAND-08 label numbers that happen to pass the check digit are still not a VIN (weights line: 4276 LBS 1940 KG GAWR)", () => {
  // found by running real OCR on a rotated label: '4276LBS1940KGGAWR' passes the check digit by chance and was offered as verified
  assert.equal(vin.validateVin("4276LBS1940KGGAWR").ok, true, "the junk read really passes the check digit");
  assert.equal(vin.isPlausibleVinRead("4276LBS1940KGGAWR"), false, "but it ends in letters, which no US-market VIN does");
  assert.equal(vin.isPlausibleVinRead("GVWR4276LBS1940KG"), false);
  assert.equal(vin.isPlausibleVinRead("WBAPH7C58AA17576C"), true, "one misread in the serial is tolerated");
  assert.equal(ocr.rankVinReads([page(["GVWR 4276 LBS 1940 KG GAWR FRT 2183 LBS 990 KG"])]), null);
  const r = ocr.rankVinReads([page(["4276 LBS 1940 KG GAWR", "NWBAPHY C58AAL7 5760"])]);
  assert.ok(!r || r.vin !== "4276LBS1940KGGAWR");
});

test("CAND-09 a weights/tire line shaped like a VIN (GAWR FRT 2183 LBS 990) is label text, not a candidate", () => {
  // found while testing CAND-08: five joined words 'GAWRFRT2183LBS990' pass every shape rule
  assert.equal(vin.isPlausibleVinRead("GAWRFRT2183LBS990"), true, "shape alone cannot tell");
  assert.equal(vin.looksLikeLabelText("GAWRFRT2183LBS990", ["GAWR", "FRT", "2183", "LBS", "990"]), true);
  assert.deepEqual(vin.extractVinCandidates("GVWR 4276 LBS 1940 KG GAWR FRT 2183 LBS 990 KG"), []);
  assert.equal(ocr.rankVinReads([page(["GAWR FRT 2183 LBS 990 KG", "TIRE SIZE FRONT 225 50R17 94V REAR 245 45R17 95V", "COLD TIRE PRESSURE FRONT 32 PSI 220 KPA"])]), null);
  assert.equal(vin.looksLikeLabelText(BMW, ["WBAPH7C58AA175760"]), false, "a real VIN is never label text");
  assert.equal(vin.looksLikeLabelText("1HGCM82633A004352"), false);
});

test("CAND-10 a 17-wide window that overlaps a label word is label text (AWRFRT2183LBS990K sliced out of GAWR FRT 2183 LBS 990 KG)", () => {
  // found with real OCR on the clean label: the engine prints 'GAWRFRT2183LBS990KG' as one run, and a window shifted by one
  // character no longer contains the whole word GAWR
  const line = "GAWRFRT2183LBS990KG";
  assert.deepEqual(vin.extractVinCandidates(line), []);
  assert.deepEqual(vin.extractVinCandidates("GAWRRR2183LBS990KG"), []);
  // the real VIN printed after the label is unaffected, and so is a VIN with stray characters around it on a short line
  assert.deepEqual(vin.extractVinCandidates("VINWBAPH7C58AA175760"), [BMW]);
  assert.equal(vin.extractVinCandidates("AWBAPH7C58AA175760X")[0], BMW, "a VIN with a stray character each side still ranks first (valid check digit)");
});

test("CAND-11 the original customer photo: the engine reads the label's slashed 7 as A, Z or I; the true VIN is OFFERED as a suggestion, never applied", () => {
  // reads of the real WBAPH7C58AA175760 label by the real engine (browser pipeline and Node); every other character was right
  for (const read of ["WBAPHAC58AA175760", "WBAPHZC58AA175760", "WBAPHIC58AA175760"]) {
    const r = ocr.rankVinReads([page(["MANUFACTURE SHOWN ABOVE", read])]);
    assert.ok(r, `${read} is offered`);
    assert.equal(r.vin, read, "returned exactly as read, not corrected");
    assert.equal(r.checkDigitOk, false);
    const fixes = vin.suggestCorrections(read);
    assert.ok(fixes.some((f) => f.vin === BMW && f.position === 5), `the exact VIN is offered for ${read}: ${JSON.stringify(fixes)}`);
    assert.ok(fixes.every((f) => vin.validateVin(f.vin).ok), "only fixes that pass the check digit are offered");
  }
});

test("CAND-12 label region: the engine's own label-word lines locate the plate; the crop grows around them and stays inside the photo", () => {
  const line = (text, x0, y0, x1, y1) => ({ bbox: { x0, y0, x1, y1 }, words: [{ symbols: [...text].map((t) => sym(t)) }] });
  const pg = { text: "", blocks: [{ paragraphs: [{ lines: [
    line("FEDERALMOTORVEHICLESAFETY", 664, 1134, 1143, 1184),
    line("EFFECTONTHEDATEOF", 683, 1173, 1127, 1229),
    line("ABCDEFGHJKLMNPRST", 10, 100, 900, 150), // not label text: ignored
  ] }] }] };
  const hull = ocr.labelHull([pg], 20);
  assert.deepEqual(hull, { x0: 644, y0: 1114, x1: 1123, y1: 1209 });
  assert.equal(ocr.labelHull([{ text: "", blocks: [{ paragraphs: [{ lines: [line("WBAPH7C58AA175760", 0, 0, 500, 60)] }] }] }]), null, "no label text, no region");
  const box = ocr.plateCropBox(hull, 1440, 1920);
  assert.ok(box.x0 < hull.x0 && box.y0 < hull.y0 && box.x1 > hull.x1 && box.y1 > hull.y1, "grown on every side");
  assert.ok(box.x0 >= 0 && box.y0 >= 0 && box.x1 <= 1440 && box.y1 <= 1920, "inside the photo");
  const edge = ocr.plateCropBox({ x0: 5, y0: 5, x1: 100, y1: 40 }, 120, 80);
  assert.deepEqual([edge.x0, edge.y0, edge.x1, edge.y1], [0, 0, 120, 80]);
});

// CAND-13: customer retake guidance (2026-10-12). A photo that cannot be read cleanly must tell the customer how to retake it.
test("CAND-13 retake tips: move closer, flash off, straight-on; the unreadable message points at them", () => {
  assert.equal(ocr.RETAKE_TIPS.length, 3);
  const text = ocr.RETAKE_TIPS.join(" ").toLowerCase();
  assert.match(text, /closer/);
  assert.match(text, /flash off/);
  assert.match(text, /straight-on/);
  assert.match(ocr.SCAN_MESSAGES.unreadable, /retake/i);
  assert.match(ocr.SCAN_MESSAGES.unreadable, /type the vin/i);
});

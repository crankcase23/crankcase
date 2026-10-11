#!/usr/bin/env node
// Crankcase visual pipeline.
//   RAW SOURCE -> VEHICLE VERIFICATION -> TECHNICAL REVIEW -> TREATMENT -> CALLOUTS -> FINAL VISUAL
//
// usage: node scripts/visuals/build-visual.mjs <manifest.json> [--root DIR]
//   --root DIR  write output under DIR instead of the repo (used for tests)
//
// The manifest holds the raw source, its licence, who verified the vehicle and
// who reviewed the technical content. If ANY gate fails nothing is written.
// The treatment only frames and tones the picture (see ALLOWED_OPS); it cannot
// add, remove, move or repaint anything.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  ALLOWED_OPS, FINAL_H, FINAL_W, FRAME_BG, JPEG_QUALITY, TREATMENT_VERSION,
  manifestProblems, sha256, slugApplication,
} from "./lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const require = createRequire(path.join(repo, "package.json"));
const sharp = require("sharp");

const args = process.argv.slice(2);
const manifestPath = args.find((a) => !a.startsWith("--"));
const rootIdx = args.indexOf("--root");
const outRoot = rootIdx >= 0 ? path.resolve(args[rootIdx + 1]) : repo;
if (!manifestPath) { console.error("usage: build-visual.mjs <manifest.json> [--root DIR]"); process.exit(2); }

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const rawPath = path.resolve(path.dirname(manifestPath), manifest.raw?.file ?? "");
if (!fs.existsSync(rawPath)) { console.error(`REFUSED: raw file not found: ${rawPath}`); process.exit(1); }
const rawBuf = fs.readFileSync(rawPath);
const meta = await sharp(rawBuf).metadata();
const rawSize = { w: meta.width, h: meta.height };

// The guide's vehicle comes from the registry file next to the guide data, so a
// manifest cannot vouch for its own vehicle.
const expected = JSON.parse(fs.readFileSync(path.join(repo, "visual-sources/applications.json"), "utf8"))[manifest.guideId];
if (!expected) { console.error(`REFUSED: guideId ${manifest.guideId} is not registered in visual-sources/applications.json`); process.exit(1); }

const problems = manifestProblems(manifest, expected, rawSize);
if (!fs.existsSync(rawPath)) problems.push("raw file missing");

// ---- treatment geometry (raw px -> final canvas) --------------------------
const crop = manifest.treatment?.crop ?? { x: 0, y: 0, w: rawSize.w, h: rawSize.h };
const scale = Math.min(FINAL_W / crop.w, FINAL_H / crop.h);
const drawW = Math.round(crop.w * scale), drawH = Math.round(crop.h * scale);
const padX = Math.round((FINAL_W - drawW) / 2), padY = Math.round((FINAL_H - drawH) / 2);
const toPct = (p) => ({
  x: +(((padX + (p.x - crop.x) * scale) / FINAL_W) * 100).toFixed(2),
  y: +(((padY + (p.y - crop.y) * scale) / FINAL_H) * 100).toFixed(2),
});
const insideCanvas = (q) => q.x >= 0 && q.x <= 100 && q.y >= 0 && q.y <= 100;
const inCrop = (p) => p.x >= crop.x && p.x <= crop.x + crop.w && p.y >= crop.y && p.y <= crop.y + crop.h;

const callouts = (manifest.callouts ?? []).map((c) => ({ label: c.label, target: toPct(c.target), labelAt: toPct(c.labelAt) }));
(manifest.callouts ?? []).forEach((c, i) => {
  if (!inCrop(c.target)) problems.push(`callout ${i + 1}: target lies outside the cropped picture (would point at nothing)`);
  if (!insideCanvas(callouts[i].labelAt)) problems.push(`callout ${i + 1}: label falls outside the frame`);
});

if (problems.length) {
  console.error(`REFUSED: ${manifest.id ?? manifestPath}\n` + problems.map((p) => "  - " + p).join("\n"));
  process.exit(1);
}

// ---- treatment -------------------------------------------------------------
const b = manifest.treatment?.brightness ?? 1;
const c = manifest.treatment?.contrast ?? 1;
const ops = ["crop", "scale-to-fit", "pad-to-frame", "jpeg-encode"];
if (b !== 1) ops.push("brightness");
if (c !== 1) ops.push("contrast");
for (const o of ops) if (!ALLOWED_OPS.includes(o)) throw new Error("internal: op not allowed " + o);

let img = sharp(rawBuf).rotate() // honour EXIF orientation only
  .extract({ left: crop.x, top: crop.y, width: crop.w, height: crop.h })
  .resize(drawW, drawH, { fit: "fill", kernel: "lanczos3" });
if (b !== 1) img = img.modulate({ brightness: b });
if (c !== 1) img = img.linear(c, 128 * (1 - c));
const drawn = await img.toBuffer();
const finalBuf = await sharp({ create: { width: FINAL_W, height: FINAL_H, channels: 3, background: FRAME_BG } })
  .composite([{ input: drawn, left: padX, top: padY }])
  .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
  .toBuffer();

// ---- write -----------------------------------------------------------------
const slug = slugApplication(manifest.application);
const finalRel = `/guide-visuals/${slug}/${manifest.id}.jpg`;
const finalAbs = path.join(outRoot, "public", finalRel);
fs.mkdirSync(path.dirname(finalAbs), { recursive: true });
fs.writeFileSync(finalAbs, finalBuf);

const entry = {
  step: manifest.step,
  id: manifest.id,
  src: finalRel,
  width: FINAL_W,
  height: FINAL_H,
  alt: manifest.alt,
  caption: manifest.caption,
  ...(callouts.length ? { callouts } : {}),
  application: manifest.application,
  provenance: {
    status: "verified",
    sourceType: manifest.raw.sourceType,
    source: manifest.raw.source,
    sourceRef: manifest.raw.sourceRef,
    license: manifest.raw.license,
    component: manifest.component,
    vehicleEvidence: manifest.verification.vehicleEvidence,
    verifiedBy: manifest.verification.verifiedBy,
    verifiedOn: manifest.verification.verifiedOn,
    technicalReviewBy: manifest.verification.technicalReviewBy,
    technicalReviewOn: manifest.verification.technicalReviewOn,
    ...(manifest.verification.technicalReviewNotes ? { technicalReviewNotes: manifest.verification.technicalReviewNotes } : {}),
    ...(manifest.raw.capturedOn ? { capturedOn: manifest.raw.capturedOn } : {}),
    calloutsVerified: callouts.length > 0,
    ...(callouts.length ? { calloutsVerifiedBy: manifest.calloutsVerified.by, calloutsVerifiedOn: manifest.calloutsVerified.on } : {}),
    rawSha256: sha256(rawBuf),
    finalSha256: sha256(finalBuf),
    treatment: { version: TREATMENT_VERSION, crop, rawSize, ops, brightness: b, contrast: c },
  },
};

const jsonPath = path.join(outRoot, "src/data/guide-visuals", manifest.registryFile ?? `${manifest.guideSlug}.visuals.json`);
const doc = fs.existsSync(jsonPath) ? JSON.parse(fs.readFileSync(jsonPath, "utf8")) : { visuals: [] };
doc.visuals = doc.visuals.filter((v) => v.id !== entry.id).concat(entry).sort((a, z) => a.step - z.step || a.id.localeCompare(z.id));
fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
fs.writeFileSync(jsonPath, JSON.stringify(doc, null, 2) + "\n");
console.log(`OK  ${manifest.id}: ${finalRel}  (${(finalBuf.length / 1024).toFixed(0)} KB)  callouts=${callouts.length}`);

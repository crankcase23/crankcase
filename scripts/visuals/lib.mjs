// Shared rules for the Crankcase visual pipeline. Plain ESM, no dependencies
// beyond `sharp` (already installed with Next.js).
import { createHash } from "node:crypto";

export const TREATMENT_VERSION = "cc-visual-1"; // keep equal to src/lib/guideVisuals.ts
export const FINAL_W = 1600;
export const FINAL_H = 1000; // every finished visual is 16:10
export const FRAME_BG = { r: 21, g: 24, b: 27, alpha: 1 }; // #15181b, the guide's graphite
export const JPEG_QUALITY = 86;

/** The ONLY things the treatment may do. None can add, move, remove or repaint a component. */
export const ALLOWED_OPS = ["crop", "scale-to-fit", "pad-to-frame", "brightness", "contrast", "jpeg-encode"];
export const BRIGHTNESS_RANGE = [0.85, 1.25];
export const CONTRAST_RANGE = [0.85, 1.35];

export const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const has = (v) => typeof v === "string" && v.trim().length > 0;

export function slugApplication(a) {
  return [a.year, a.make, a.model, a.trim, a.engine].filter(Boolean).map((x) => String(x).toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-|-$/g, "")).join("-");
}

/**
 * Every reason a manifest may NOT be published. Empty array = it may proceed.
 * `expected` is the application the guide is for (from the guide's vehicle).
 */
export function manifestProblems(m, expected, rawSize) {
  const bad = [];
  const need = (ok, msg) => { if (!ok) bad.push(msg); };

  need(has(m.id) && /^[a-z0-9-]+$/.test(m.id), "id must be lowercase letters, digits, dashes");
  need(Number.isInteger(m.step) && m.step > 0, "step must be a canonical step number");
  need(has(m.guideId), "guideId missing");
  need(has(m.alt) && has(m.caption), "alt text and caption are required");
  need(has(m.component), "component missing");

  const a = m.application ?? {};
  need(a.year === expected.year && norm(a.make) === norm(expected.make) && norm(a.model) === norm(expected.model) && norm(a.engine) === norm(expected.engine),
    `application ${JSON.stringify(a)} does not match the guide's vehicle ${JSON.stringify(expected)}`);
  if (expected.trim) need(norm(a.trim) === norm(expected.trim), "trim does not match the guide's vehicle");

  const r = m.raw ?? {};
  need(has(r.file), "raw.file missing");
  need(["own-photo", "licensed", "oem-manual", "other"].includes(r.sourceType), "raw.sourceType invalid");
  need(has(r.source), "raw.source missing");
  need(has(r.sourceRef), "raw.sourceRef (URL / manual+page / file reference) missing");
  need(["owned", "licensed", "permission-granted", "public-domain", "oem-authorized"].includes(r.license?.status), `usage rights not established (license.status = ${r.license?.status ?? "missing"})`);

  const v = m.verification ?? {};
  need(v.status === "verified", "verification.status is not 'verified'");
  need(has(v.vehicleEvidence), "verification.vehicleEvidence missing: say how the raw image is known to be THIS vehicle");
  need(has(v.verifiedBy) && /^\d{4}-\d{2}-\d{2}$/.test(v.verifiedOn ?? ""), "vehicle verification (verifiedBy / verifiedOn) missing");
  need(has(v.technicalReviewBy) && /^\d{4}-\d{2}-\d{2}$/.test(v.technicalReviewOn ?? ""), "technical review (technicalReviewBy / technicalReviewOn) missing");
  need(v.uncertainty === "none" || v.uncertainty === undefined, "verification.uncertainty must be 'none' or absent; an uncertain source is not approved");

  const t = m.treatment ?? {};
  const known = new Set(["crop", "brightness", "contrast"]);
  for (const k of Object.keys(t)) need(known.has(k), `treatment.${k} is not an allowed operation`);
  const b = t.brightness ?? 1, c = t.contrast ?? 1;
  need(b >= BRIGHTNESS_RANGE[0] && b <= BRIGHTNESS_RANGE[1], `brightness ${b} outside ${BRIGHTNESS_RANGE}`);
  need(c >= CONTRAST_RANGE[0] && c <= CONTRAST_RANGE[1], `contrast ${c} outside ${CONTRAST_RANGE}`);
  if (rawSize) {
    const k = t.crop ?? { x: 0, y: 0, w: rawSize.w, h: rawSize.h };
    need([k.x, k.y, k.w, k.h].every(Number.isFinite) && k.x >= 0 && k.y >= 0 && k.w > 0 && k.h > 0 && k.x + k.w <= rawSize.w && k.y + k.h <= rawSize.h, "crop must lie inside the raw image");
  }

  const cs = m.callouts ?? [];
  cs.forEach((c2, i) => {
    need(has(c2.label), `callout ${i + 1}: label missing`);
    need(c2.target && Number.isFinite(c2.target.x) && Number.isFinite(c2.target.y), `callout ${i + 1}: target missing`);
    need(c2.labelAt && Number.isFinite(c2.labelAt.x) && Number.isFinite(c2.labelAt.y), `callout ${i + 1}: labelAt missing`);
  });
  if (cs.length) need(m.calloutsVerified?.by && /^\d{4}-\d{2}-\d{2}$/.test(m.calloutsVerified?.on ?? ""), "callouts present but calloutsVerified {by,on} missing: someone must confirm each arrow points at its component");
  need(cs.length <= 6, "more than 6 callouts is clutter; split the visual");
  return bad;
}

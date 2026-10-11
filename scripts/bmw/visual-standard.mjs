#!/usr/bin/env node
// Crankcase Garage VISUAL STANDARD CG-VS-1.0 (owner-approved for STYLE ONLY, 2026-10-10).
//
// The approved reference illustration (docs/bmw-e90/visual-standard/reference/) sets the look: clean realistic 3D technical
// illustration, light neutral background, tight component framing, minimal unnecessary detail, orange guidance, and three image
// types: LOCATE (find it), IDENTIFY (this is it), DO (do the action). It was approved for style ONLY; its BMW mechanical accuracy
// was NOT certified (see docs/bmw-e90/visual-standard/STYLE-REFERENCE-REVIEW.md: verdict REJECT as a BMW accuracy reference).
//
// How the standard meets the evidence rules:
//   * Style never overrides evidence. Realism applies to materials and light only; any part the evidence ledger does not
//     establish stays a plain generic shape or is left out. Realistic rendering raises the hallucination risk, so the prompt says so.
//   * Banners, step numbers, labels, highlight outlines and arrows are NOT generated into the image (the factory contract is
//     NO TEXT, no arrows). They live in an EDITABLE vector overlay (overlay.spec.json -> overlay.svg) that is placed over the
//     accepted image. The orange belongs to the overlay; the generated picture must not contain orange accents.
//   * The factory code is hash-locked and untouched. The standard is enforced here (prompt text, type rules, overlay spec),
//     is part of the prompt the factory hashes and records, and is stamped into PIPELINE-REPORT.json.
//
//   node scripts/bmw/visual-standard.mjs overlay --spec overlay.spec.json --out overlay.svg
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const REF = path.join(ROOT, "docs/bmw-e90/visual-standard/reference/oil-drain-style-reference.png");

export const STANDARD = {
  id: "CG-VS-1.0",
  approvedBy: "owner, in session, 2026-10-10",
  scope: "STYLE ONLY. BMW mechanical accuracy of the reference illustration was not certified.",
  referenceImage: "docs/bmw-e90/visual-standard/reference/oil-drain-style-reference.png",
  palette: { orange: "#FE6C01", banner: "#1B1B1B", text: "#FFFFFF", highlight: "#FE6C01" },
  imageTypes: ["LOCATE", "IDENTIFY", "DO"],
};
export const referenceSha256 = () => (fs.existsSync(REF) ? crypto.createHash("sha256").update(fs.readFileSync(REF)).digest("hex") : null);

export const TYPES = {
  LOCATE: {
    title: "Find it",
    framing: "LOCATE image: wide enough that a mechanic can find the part. Show the hero in its simplified surrounding structure, the hero taking roughly 15-30% of the frame width, the surroundings plain and simplified.",
    tools: false,
  },
  IDENTIFY: {
    title: "This is it",
    framing: "IDENTIFY image: tight close-up of the hero part filling roughly 40-60% of the frame. The hero and only a small patch of the surface it sits in form one isolated object floating on the plain light background; the patch ends well inside the frame and never reaches the left, right or bottom edge. If an element's orientation is listed as not established, view it end-on with no ground, horizon, body edge or gravity cue.",
    tools: false,
  },
  DO: {
    title: "Do it",
    framing: "DO image: tight close-up of the hero part with the listed tool in working position, no hands. If an element's orientation is listed as not established, view it end-on with no ground, horizon, body edge or gravity cue.",
    tools: true,
  },
};

export const STYLE_LINE = "Style (CG-VS-1.0): clean, realistic 3D technical illustration; light neutral studio background (soft white to light grey); matte materials, soft light, soft contact shadows; tight component framing; minimal unnecessary detail. Realism applies to materials and lighting only: it does NOT license invented detail, so every part not listed below stays a plain generic shape. No orange or other saturated accent colours anywhere (a copper-coloured part may be copper); highlights and arrows are added later as an editable overlay.";

// Added after the first real candidate: the generator filled the frame edge to edge, which the fit-to-16:10 step must refuse
// (padding would smear content). The margin is plain light ground on all four sides so native output can be padded honestly.
export const MARGIN_LINE = "MARGIN: leave a plain, empty, light neutral margin of at least 8% of the image width on the left and right and at least 8% of the height at the bottom; no part, panel, shadow or structure may touch or run off the left, right or bottom edge of the image. The subject floats on the plain ground, fully inside the frame.";
export const framingLine = (type, viewpointText) => `Landscape, exactly 16:10 (deliver 1600x1000 px or larger at 16:10). ${viewpointText} ${TYPES[type].framing} ${MARGIN_LINE} ${STYLE_LINE}`;

export const CLEAR_SPACE_LINE = "CLEAR SPACE: keep one horizontal band plain and uncluttered (light neutral background only): the top 3%-17% of the height, across the full width. The step banner and labels are added later in software.";

// ---- editable overlay: JSON spec -> SVG layer. Regions are normalised boxes [x, y, w, h] in 0..1, null until the image exists.
export function overlaySpec(v, { stepNumber = 1, subtitle } = {}) {
  const hero = v.elements.filter((e) => e.role === "hero"), target = v.elements.filter((e) => e.role === "target");
  return {
    schema: "cg-overlay.v1",
    standard: STANDARD.id,
    visualId: v.id,
    note: "Editable guidance layer. Nothing here is baked into the image. Fill each highlight region (normalised x,y,w,h) after the accepted image exists, then render with scripts/bmw/visual-standard.mjs overlay.",
    banner: { step: stepNumber, tag: v.imageType, subtitle: subtitle ?? TYPES[v.imageType].title },
    highlights: [...hero, ...target].map((e, i) => ({ element: e.id, role: e.role, note: e.describe, label: null, region: null, arrowFrom: null, primary: i === 0 })),
    palette: STANDARD.palette,
  };
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function renderOverlaySvg(spec, W = 1600, H = 1000) {
  const p = spec.palette ?? STANDARD.palette;
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(spec.banner.tag)} ${esc(spec.banner.subtitle)}">`];
  const b = spec.banner;
  out.push(`<g id="banner"><rect x="0" y="0" width="${Math.round(W * 0.62)}" height="${Math.round(H * 0.17)}" fill="${p.banner}" opacity="0.92"/><rect x="0" y="0" width="${Math.round(H * 0.17)}" height="${Math.round(H * 0.17)}" fill="${p.orange}"/>`);
  out.push(`<text x="${Math.round(H * 0.085)}" y="${Math.round(H * 0.12)}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${Math.round(H * 0.095)}" fill="${p.text}">${esc(b.step)}</text>`);
  out.push(`<text x="${Math.round(H * 0.2)}" y="${Math.round(H * 0.075)}" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${Math.round(H * 0.052)}" fill="${p.text}">${esc(b.tag)}</text>`);
  out.push(`<text x="${Math.round(H * 0.2)}" y="${Math.round(H * 0.13)}" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(H * 0.034)}" fill="${p.text}">${esc(b.subtitle)}</text></g>`);
  const pills = [];
  for (const h of spec.highlights ?? []) {
    if (!h.region) continue; // no invented positions: nothing is drawn until the region is set
    const [x, y, w, hh] = h.region.map((n, i) => Math.round(n * (i % 2 ? H : W)));
    // shape "ring": an annulus for a part that sits concentric with another (e.g. a washer around a plug head). `region` is the outer
    // ellipse's bounding box, `inner` the inner ellipse's; the band between them is the part. A rectangle cannot isolate such a part.
    if (h.shape === "ring" && h.inner) {
      const [ix, iy, iw, ih] = h.inner.map((n, i) => Math.round(n * (i % 2 ? H : W)));
      out.push(`<g class="highlight" data-element="${esc(h.element)}" data-shape="ring"><ellipse cx="${x + w / 2}" cy="${y + hh / 2}" rx="${w / 2}" ry="${hh / 2}" fill="none" stroke="${p.highlight}" stroke-width="6"/><ellipse cx="${ix + iw / 2}" cy="${iy + ih / 2}" rx="${iw / 2}" ry="${ih / 2}" fill="none" stroke="${p.highlight}" stroke-width="6"/>`);
    } else out.push(`<g class="highlight" data-element="${esc(h.element)}"><rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="${Math.round(Math.min(w, hh) * 0.12)}" fill="none" stroke="${p.highlight}" stroke-width="6"/>`);
    if (h.arrowFrom) {
      const [ax, ay] = [Math.round(h.arrowFrom[0] * W), Math.round(h.arrowFrom[1] * H)];
      const [tx, ty] = [x + w / 2, y + hh / 2];
      const ang = Math.atan2(ty - ay, tx - ax), len = 22;
      const ex = tx - Math.cos(ang) * Math.max(w, hh) * 0.55, ey = ty - Math.sin(ang) * Math.max(w, hh) * 0.55;
      const l = [ex - Math.cos(ang - 0.45) * len, ey - Math.sin(ang - 0.45) * len], r = [ex - Math.cos(ang + 0.45) * len, ey - Math.sin(ang + 0.45) * len];
      out.push(`<line x1="${ax}" y1="${ay}" x2="${Math.round(ex)}" y2="${Math.round(ey)}" stroke="${p.highlight}" stroke-width="8" stroke-linecap="round"/><polygon points="${Math.round(ex)},${Math.round(ey)} ${Math.round(l[0])},${Math.round(l[1])} ${Math.round(r[0])},${Math.round(r[1])}" fill="${p.highlight}"/>`);
    }
    if (h.label) {
      // Label pill: dark ground + white text so it reads on any image. Default spot is just above the box; `labelAt` [x,y] (fractions) places it
      // on clear ground with a connector to the box. Pills never overlap each other or the banner (stacked/shifted until clear).
      const pw = Math.round(String(h.label).length * 17 + 28), ph = 44;
      let lx = h.labelAt ? Math.round(h.labelAt[0] * W) : x, ly = h.labelAt ? Math.round(h.labelAt[1] * H) : y - ph - 10;
      const bannerR = { x: 0, y: 0, w: Math.round(W * 0.62), h: Math.round(H * 0.17) };
      const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      lx = Math.min(Math.max(lx, 8), W - pw - 8); ly = Math.min(Math.max(ly, 8), H - ph - 8);
      for (let i = 0; i < 40; i++) {
        const r = { x: lx, y: ly, w: pw, h: ph };
        if (hit(r, bannerR)) { ly = bannerR.h + 8; continue; }
        const other = pills.find((q) => hit(r, q));
        if (other) { ly = other.y + other.h + 8; if (ly > H - ph - 8) ly = Math.max(8, other.y - ph - 8); continue; }
        break;
      }
      pills.push({ x: lx, y: ly, w: pw, h: ph });
      if (h.labelAt) {
        const cx = Math.min(Math.max(lx + pw / 2, x), x + w), cy = ly < y ? y : ly > y + hh ? y + hh : Math.min(Math.max(ly + ph / 2, y), y + hh);
        out.push(`<line x1="${Math.round(lx + pw / 2)}" y1="${ly < y ? ly + ph : ly}" x2="${Math.round(cx)}" y2="${Math.round(cy)}" stroke="${p.highlight}" stroke-width="4"/>`);
      }
      out.push(`<rect x="${lx}" y="${ly}" width="${pw}" height="${ph}" rx="8" fill="${p.banner}" opacity="0.92"/><text x="${lx + 14}" y="${ly + 30}" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="26" fill="${p.text}">${esc(h.label)}</text>`);
    }
    out.push("</g>");
  }
  out.push("</svg>");
  return out.join("\n") + "\n";
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2);
  const arg = (n) => { const i = a.indexOf(`--${n}`); return i >= 0 ? a[i + 1] : undefined; };
  if (a[0] !== "overlay" || !arg("spec") || !arg("out")) { console.error("usage: visual-standard.mjs overlay --spec overlay.spec.json --out overlay.svg"); process.exit(2); }
  fs.writeFileSync(path.resolve(arg("out")), renderOverlaySvg(JSON.parse(fs.readFileSync(path.resolve(arg("spec")), "utf8"))));
}

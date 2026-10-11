#!/usr/bin/env node
// Schema + consistency validation for docs/bmw-e90/evidence/guide-NN.json (second-pass schema).
//   node scripts/bmw/validate-evidence.mjs [DIR]     exit 1 on any error; warnings are printed but do not fail
// Exported: validateEvidence(dir) -> { errors, warnings, guides }
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const STATUS = /^\s*(VERIFIED_SECONDARY|VERIFIED|SINGLE_SOURCE|CONFLICT|MISSING)\b/;
const TIERS = new Set(["safety-critical", "standard"]);
const ROLES = new Set(["hero", "target", "context"]);
const CRIT = new Set(["identification", "procedure", "critical", "cosmetic"]);
const KINDS = new Set(["oem-figure", "oem-text", "parts-catalog", "third-party-guide", "third-party-photo", "user-supplied-photo"]); // factory REFERENCE_KINDS
const HARDWARE = /hardware|connector|clamp|release|fastener|bolt|screw|latch|tab/i; // factory rule: these may not be cosmetic
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return null; } };

export function statusOf(s) {
  const m = STATUS.exec(String(s ?? ""));
  return m ? m[1] : null;
}

export function validateEvidence(dir) {
  const errors = [];
  const warnings = [];
  const err = (g, m) => errors.push(`guide ${g}: ${m}`);
  const warn = (g, m) => warnings.push(`guide ${g}: ${m}`);
  const files = fs.readdirSync(dir).filter((f) => /^guide-\d\d\.json$/.test(f)).sort();
  const guides = [];
  const visualIds = new Set();
  if (files.length !== 16) errors.push(`expected 16 guide files, found ${files.length}`);
  for (const f of files) {
    const no = Number(f.slice(6, 8));
    let g;
    try { g = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch (e) { err(no, `invalid JSON: ${e.message}`); continue; }
    guides.push(g);
    if (g.guide !== no) err(no, `guide field ${g.guide} does not match filename`);
    for (const k of ["name", "summary", "recommendedStatus", "evidenceTier", "tools", "parts", "fluids", "torque", "steps", "safety", "missingEvidence", "ownerInputsNeeded", "visuals", "variantDependencies"]) {
      if (g[k] === undefined) err(no, `missing key ${k}`);
    }
    if (!TIERS.has(g.evidenceTier)) err(no, `bad evidenceTier ${g.evidenceTier}`);
    if (typeof g.primarySourceFound !== "boolean") err(no, "primarySourceFound must be boolean");
    for (const k of ["tools", "parts", "fluids", "torque", "steps"]) {
      for (const [i, x] of (g[k] ?? []).entries()) {
        if (!statusOf(x.status)) err(no, `${k}[${i}] unrecognised status "${String(x.status).slice(0, 40)}"`);
      }
    }
    // steps: sequential, with text
    (g.steps ?? []).forEach((s, i) => {
      if (s.n !== i + 1) err(no, `step ${i + 1} has n=${s.n}`);
      if (!s.title || !s.instruction) err(no, `step ${i + 1} lacks title/instruction`);
    });
    // torque rules
    for (const t of g.torque ?? []) {
      const st = statusOf(t.status);
      if (!t.fastener) err(no, "torque row without fastener");
      if ((st === "VERIFIED" || st === "VERIFIED_SECONDARY")) {
        const hosts = new Set((t.sources ?? []).map(host).filter(Boolean));
        if (hosts.size < 2) err(no, `torque "${t.fastener}" is ${st} with only ${hosts.size} independent host(s)`);
        if (/missing/i.test(t.value ?? "")) err(no, `torque "${t.fastener}" is ${st} but value says missing`);
        if (st === "VERIFIED_SECONDARY" && t.primary === true) warn(no, `torque "${t.fastener}" VERIFIED_SECONDARY but primary:true (should be VERIFIED?)`);
        if (st === "VERIFIED" && g.evidenceTier === "safety-critical" && t.primary === false) warn(no, `safety-critical torque "${t.fastener}" VERIFIED without primary source (should be VERIFIED_SECONDARY?)`);
      }
    }
    // visuals
    const nSteps = (g.steps ?? []).length;
    for (const v of g.visuals ?? []) {
      const where = `visual ${v.id}`;
      if (!v.id || !/^[a-z0-9-]+$/.test(v.id)) err(no, `${where}: bad id`);
      if (visualIds.has(v.id)) err(no, `${where}: duplicate id across guides`);
      visualIds.add(v.id);
      if (!v.viewpoint) err(no, `${where}: no viewpoint`);
      if (!Array.isArray(v.evidenceSteps) || !v.evidenceSteps.length || v.evidenceSteps.some((n) => !Number.isInteger(n) || n < 1 || n > nSteps)) err(no, `${where}: evidenceSteps out of range 1..${nSteps}`);
      const ids = new Set();
      for (const e of v.elements ?? []) {
        if (ids.has(e.id)) err(no, `${where}: duplicate element ${e.id}`);
        ids.add(e.id);
        if (!ROLES.has(e.role)) err(no, `${where}: element ${e.id} bad role ${e.role}`);
        if (!CRIT.has(e.criticality)) err(no, `${where}: element ${e.id} bad criticality ${e.criticality}`);
        if (!e.describe) err(no, `${where}: element ${e.id} has no describe`);
        if (HARDWARE.test(e.id) && e.criticality === "cosmetic") err(no, `${where}: hardware-keyword element ${e.id} may not be cosmetic`);
      }
      if (![...(v.elements ?? [])].some((e) => e.role === "hero")) err(no, `${where}: no hero element`);
      const src = v.sources ?? {};
      for (const [u, s] of Object.entries(src)) {
        if (!host(u)) err(no, `${where}: source key is not a URL: ${u}`);
        if (!s.kind || !s.establishes) err(no, `${where}: source ${u} lacks kind/establishes`);
        else if (!KINDS.has(s.kind)) err(no, `${where}: source ${u} has kind ${s.kind} (not a factory reference kind)`);
      }
      for (const f of v.facts ?? []) {
        if (!ids.has(f.element)) err(no, `${where}: fact for unknown element ${f.element}`);
        if (!f.attribute) err(no, `${where}: fact without attribute`);
        for (const u of f.urls ?? []) if (!(u in src)) err(no, `${where}: fact ${f.element}/${f.attribute} cites uncatalogued URL ${u}`);
      }
      for (const m of v.mustNotDepict ?? []) if (!ids.has(m.element)) err(no, `${where}: mustNotDepict for unknown element ${m.element}`);
    }
    if (!(g.visuals ?? []).length) warn(no, "no visuals proposed");
  }
  return { errors, warnings, guides };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = path.resolve(process.argv[2] ?? path.join(ROOT, "docs/bmw-e90/evidence"));
  const r = validateEvidence(dir);
  for (const w of r.warnings) console.log("WARN  " + w);
  for (const e of r.errors) console.log("ERROR " + e);
  console.log(`${r.guides.length} guides, ${r.errors.length} error(s), ${r.warnings.length} warning(s)`);
  process.exit(r.errors.length ? 1 : 0);
}

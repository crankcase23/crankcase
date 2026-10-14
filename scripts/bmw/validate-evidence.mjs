#!/usr/bin/env node
// Schema + consistency validation for docs/bmw-e90/evidence/guide-NN.json (second-pass schema).
//   node scripts/bmw/validate-evidence.mjs [DIR]     exit 1 on any error; warnings are printed but do not fail
// Exported: validateEvidence(dir, opts) -> { errors, warnings, guides, baselined }
//   opts.expectedGuides  number of guide files required (default 16, the BMW set); null skips the count (other vehicles)
//   STRICT-BASELINE.json in the evidence dir lists triaged legacy findings (see strictFindings). A baselined finding is reported as
//   baselined, not as an error; any finding NOT in the baseline is an error, and a baseline entry that no longer matches is an error
//   (the baseline may only shrink). A directory with no baseline file gets no exemptions.
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
// Added after the F-150 pilot probe: lug nuts, guide pins, studs, clips, springs, hoses, calipers, brackets, valves, caps and washers
// slipped past the substring list above (an element named "guide-pins" could be cosmetic). Matched on whole id tokens so "spinner" is not "pin".
const HARDWARE_TOKENS = /(^|[^a-z])(nuts?|pins?|studs?|clips?|springs?|hoses?|calipers?|brackets?|valves?|caps?|washers?|plugs?|lugs?)([^a-z]|$)/i;
export const isHardwareId = (id) => HARDWARE.test(id) || HARDWARE_TOKENS.test(id);
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return null; } };

export function statusOf(s) {
  const m = STATUS.exec(String(s ?? ""));
  return m ? m[1] : null;
}

// Evidence-claim rules that must hold for EVERY ledger. A claim tagged VERIFIED or VERIFIED_SECONDARY is the thing a customer-facing number
// is allowed to rest on, so the tag has to be backed by something the validator can see. Returns [{ guide, code, label, message }].
//   UNSOURCED_VERIFIED       VERIFIED/VERIFIED_SECONDARY with no source URL at all
//   SECONDARY_ONE_HOST       VERIFIED_SECONDARY resting on fewer than 2 independent hosts
//   VERIFIED_NO_PRIMARY      VERIFIED while the ledger says no primary (OEM) document was read
//   PRIMARY_FLAG_NO_PRIMARY  primary:true while the ledger says no primary document was read
//   TORQUE_NO_NUMBER         a torque tagged VERIFIED/VERIFIED_SECONDARY whose value contains no digit
//   HARDWARE_COSMETIC        a hardware element marked cosmetic in a visual
export function strictFindings(g) {
  const out = [];
  const add = (code, label, message) => out.push({ guide: g.guide, code, label, message });
  for (const kind of ["tools", "parts", "fluids", "torque", "steps"]) {
    (g[kind] ?? []).forEach((x, i) => {
      const st = statusOf(x.status);
      const label = `${kind}[${i}] ${String(x.item ?? x.fastener ?? x.title ?? "").slice(0, 50)}`;
      if (st === "VERIFIED" || st === "VERIFIED_SECONDARY") {
        const hosts = new Set((x.sources ?? []).map(host).filter(Boolean));
        if (hosts.size < 1) add("UNSOURCED_VERIFIED", label, `${label} is ${st} with no source`);
        else if (st === "VERIFIED_SECONDARY" && hosts.size < 2) add("SECONDARY_ONE_HOST", label, `${label} is VERIFIED_SECONDARY with ${hosts.size} host(s); needs 2`);
        if (kind === "torque" && !/\d/.test(String(x.value ?? ""))) add("TORQUE_NO_NUMBER", label, `${label} is ${st} but its value has no number`);
      }
      if (st === "VERIFIED" && g.primarySourceFound !== true) add("VERIFIED_NO_PRIMARY", label, `${label} is VERIFIED but primarySourceFound is false`);
      if (x.primary === true && g.primarySourceFound !== true) add("PRIMARY_FLAG_NO_PRIMARY", label, `${label} has primary:true but primarySourceFound is false`);
    });
  }
  for (const v of g.visuals ?? []) for (const el of v.elements ?? []) {
    if (isHardwareId(el.id ?? "") && el.criticality === "cosmetic") add("HARDWARE_COSMETIC", `${v.id}/${el.id}`, `visual ${v.id}: hardware element ${el.id} may not be cosmetic`);
  }
  return out;
}
export const findingKey = (f) => `${f.guide}|${f.code}|${f.label}`;

export function validateEvidence(dir, opts = {}) {
  const expectedGuides = opts.expectedGuides === undefined ? 16 : opts.expectedGuides;
  const errors = [];
  const warnings = [];
  const err = (g, m) => errors.push(`guide ${g}: ${m}`);
  const warn = (g, m) => warnings.push(`guide ${g}: ${m}`);
  const files = fs.readdirSync(dir).filter((f) => /^guide-\d\d\.json$/.test(f)).sort();
  const guides = [];
  const visualIds = new Set();
  if (expectedGuides !== null && files.length !== expectedGuides) errors.push(`expected ${expectedGuides} guide files, found ${files.length}`);
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
      if (!["LOCATE", "IDENTIFY", "DO"].includes(v.imageType)) err(no, `${where}: imageType must be LOCATE, IDENTIFY or DO`);
      if (!Array.isArray(v.evidenceSteps) || !v.evidenceSteps.length || v.evidenceSteps.some((n) => !Number.isInteger(n) || n < 1 || n > nSteps)) err(no, `${where}: evidenceSteps out of range 1..${nSteps}`);
      const ids = new Set();
      for (const e of v.elements ?? []) {
        if (ids.has(e.id)) err(no, `${where}: duplicate element ${e.id}`);
        ids.add(e.id);
        if (!ROLES.has(e.role)) err(no, `${where}: element ${e.id} bad role ${e.role}`);
        if (!CRIT.has(e.criticality)) err(no, `${where}: element ${e.id} bad criticality ${e.criticality}`);
        if (!e.describe) err(no, `${where}: element ${e.id} has no describe`);
        // (hardware-as-cosmetic is enforced by strictFindings below, so the baseline mechanism can see it)
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
  // strict claim rules, with the directory's triaged baseline (if any)
  const baselineFile = path.join(dir, "STRICT-BASELINE.json");
  const baseline = fs.existsSync(baselineFile) ? JSON.parse(fs.readFileSync(baselineFile, "utf8")).findings ?? [] : [];
  // A baseline entry is an exception, so each one must justify itself, be unique, and the file may not grow past its recorded ceiling.
  const baselineMeta = fs.existsSync(baselineFile) ? JSON.parse(fs.readFileSync(baselineFile, "utf8")) : {};
  const seenKeys = new Set();
  for (const b of baseline) {
    if (!b.key || !["LOW", "MEDIUM"].includes(b.risk) || String(b.rationale ?? "").length < 20) errors.push(`STRICT-BASELINE entry needs key, risk LOW or MEDIUM (HIGH must be fixed, not excepted) and a rationale: ${b.key ?? "(no key)"}`);
    if (seenKeys.has(b.key)) errors.push(`STRICT-BASELINE duplicate entry: ${b.key}`);
    seenKeys.add(b.key);
  }
  if (baseline.length && !(Number.isInteger(baselineMeta.ceiling) && baseline.length <= baselineMeta.ceiling)) errors.push(`STRICT-BASELINE has ${baseline.length} entries but ceiling is ${baselineMeta.ceiling}; the baseline may not grow`);
  const allowed = new Map(baseline.map((b) => [b.key, b]));
  const seen = new Set();
  const baselined = [];
  for (const g of guides) {
    for (const f of strictFindings(g)) {
      const k = findingKey(f);
      if (allowed.has(k)) { seen.add(k); baselined.push({ ...f, ...allowed.get(k) }); } else errors.push(`guide ${f.guide}: [${f.code}] ${f.message}`);
    }
  }
  for (const b of baseline) if (!seen.has(b.key)) errors.push(`STRICT-BASELINE entry no longer matches a finding (remove it, the baseline may only shrink): ${b.key}`);
  return { errors, warnings, guides, baselined };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = path.resolve(process.argv[2] ?? path.join(ROOT, "docs/bmw-e90/evidence"));
  const r = validateEvidence(dir, { expectedGuides: process.env.EXPECTED_GUIDES === undefined ? 16 : process.env.EXPECTED_GUIDES === "any" ? null : Number(process.env.EXPECTED_GUIDES) });
  for (const w of r.warnings) console.log("WARN  " + w);
  for (const e of r.errors) console.log("ERROR " + e);
  for (const b of r.baselined) console.log(`BASELINED [${b.risk}] guide ${b.guide} [${b.code}] ${b.message}`);
  console.log(`${r.guides.length} guides, ${r.errors.length} error(s), ${r.warnings.length} warning(s), ${r.baselined.length} baselined`);
  process.exit(r.errors.length ? 1 : 0);
}

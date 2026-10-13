#!/usr/bin/env node
// Pilot wrapper around the proven BMW evidence validator. The BMW validator is reused UNCHANGED; the only adaptation is that
// it hardcodes "expected 16 guide files", so that one message is filtered out here. The filter is the measured reuse friction.
//   node scripts/f150-pilot/validate.mjs [DIR]     exit 1 on any error; prints per-guide evidence-tag counts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateEvidence, statusOf } from "../bmw/validate-evidence.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const VEHICLE_ID = "2015-ford-f150-5.0l";

// Pilot-level checks added ON TOP of the unchanged BMW validator. Each closes a gap the pilot found (mutation-probed by the authors:
// a scratch ledger with the fault injected passed the BMW validator). Kept here, not in scripts/bmw, so the proven BMW layer is not
// reopened; promote to the shared validator only after checking the BMW ledgers pass them (see docs/f150-pilot/REPORT.md).
const HARDWARE_PLUS = /nut|pin|clip|spring|hose|caliper|bracket|bolt|screw|fastener|valve|cap\b/i; // BMW regex lacks nut, pin, clip, spring, hose
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return null; } };

export function pilotExtraChecks(g) {
  const errs = [];
  const e = (m) => errs.push(`guide ${g.guide}: ${m}`);
  const nodes = [["tools", g.tools], ["parts", g.parts], ["fluids", g.fluids], ["torque", g.torque], ["steps", g.steps]];
  for (const [kind, list] of nodes) {
    (list ?? []).forEach((x, i) => {
      const st = statusOf(x.status);
      const label = `${kind}[${i}] ${(x.item ?? x.fastener ?? x.title ?? "").slice(0, 50)}`;
      if (st === "VERIFIED" || st === "VERIFIED_SECONDARY") {
        const hosts = new Set((x.sources ?? []).map(hostOf).filter(Boolean));
        if (hosts.size < 1) e(`${label} is ${st} with no source`);
        if (st === "VERIFIED_SECONDARY" && hosts.size < 2) e(`${label} is VERIFIED_SECONDARY with ${hosts.size} host(s); needs 2`);
      }
      if (st === "VERIFIED" && g.primarySourceFound !== true) e(`${label} is VERIFIED but primarySourceFound is false (VERIFIED needs a Ford document)`);
      if (x.primary === true && g.primarySourceFound !== true) e(`${label} has primary:true but primarySourceFound is false`);
      if (kind === "torque" && (st === "VERIFIED" || st === "VERIFIED_SECONDARY") && !/\d/.test(String(x.value ?? ""))) e(`${label} is ${st} but its value has no number`);
    });
  }
  for (const v of g.visuals ?? []) for (const el of v.elements ?? []) {
    if (HARDWARE_PLUS.test(el.id) && el.criticality === "cosmetic") e(`visual ${v.id}: hardware-keyword element ${el.id} may not be cosmetic`);
  }
  return errs;
}

export function validatePilot(dir) {
  const r = validateEvidence(dir);
  const errors = r.errors.filter((e) => !/^expected 16 guide files/.test(e));
  for (const g of r.guides) errors.push(...pilotExtraChecks(g));
  for (const g of r.guides) {
    if (g.vehicle !== VEHICLE_ID) errors.push(`guide ${g.guide}: top-level "vehicle" must be "${VEHICLE_ID}" (Atlas ties every claim to one exact config)`);
  }
  const tags = (g) => {
    const c = { VERIFIED: 0, VERIFIED_SECONDARY: 0, SINGLE_SOURCE: 0, CONFLICT: 0, MISSING: 0, other: 0 };
    const nodes = [...(g.tools ?? []), ...(g.parts ?? []), ...(g.fluids ?? []), ...(g.torque ?? []), ...(g.steps ?? [])];
    for (const x of nodes) { const s = statusOf(x.status); c[s ?? "other"]++; }
    return c;
  };
  return { errors, warnings: r.warnings, guides: r.guides, tags };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = path.resolve(process.argv[2] ?? path.join(ROOT, "docs/f150-pilot/evidence"));
  const r = validatePilot(dir);
  for (const g of r.guides) console.log(`guide ${g.guide} ${g.name}: ` + JSON.stringify(r.tags(g)));
  for (const w of r.warnings) console.log("WARN  " + w);
  for (const e of r.errors) console.log("ERROR " + e);
  console.log(`${r.guides.length} guides, ${r.errors.length} error(s), ${r.warnings.length} warning(s)`);
  process.exit(r.errors.length ? 1 : 0);
}

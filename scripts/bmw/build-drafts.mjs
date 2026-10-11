#!/usr/bin/env node
// Builds the ADMIN-ONLY draft guides for the 2010 BMW 328i (E90) from the evidence ledger.
//
//   docs/bmw-e90/evidence/guide-NN.json  --(this script)-->  src/data/admin-test-guides/bmw-2010-328i-drafts.ts
//                                                            docs/bmw-e90/EVIDENCE-SUMMARY.md
//
// Rules this script enforces (so the output cannot quietly overstate the evidence):
//  * A torque value is printed as a number ONLY when its evidence status is VERIFIED. Anything else renders the
//    house warning "VERIFY EXACT TORQUE BEFORE SERVICE" and keeps the reference figure in the notes.
//  * Every step that is not VERIFIED carries a visible warning.
//  * Nothing here makes a guide publishable. The output lives in src/data/admin-test-guides, which only /admin imports.
//
// Usage: node scripts/bmw/build-drafts.mjs          write outputs
//        node scripts/bmw/build-drafts.mjs --check  exit 1 if the committed outputs are stale
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const EVID = path.join(ROOT, "docs/bmw-e90/evidence");
const OUT_TS = path.join(ROOT, "src/data/admin-test-guides/bmw-2010-328i-drafts.ts");
const OUT_MD = path.join(ROOT, "docs/bmw-e90/EVIDENCE-SUMMARY.md");

const V_TORQUE = "⚠ VERIFY EXACT TORQUE BEFORE SERVICE";

// Editorial metadata the research files do not carry. Difficulty and time are the author's estimates, not sourced facts.
const META = {
  1: { slug: "front-brake-pads", job: "brake-pads-front", diff: "Moderate", time: "About 1.5–2.5 hours for both sides" },
  2: { slug: "fuse-bulb", job: "fuse-bulb", diff: "Easy", time: "About 15–45 minutes depending on the bulb" },
  3: { slug: "key-fob-battery", job: "key-fob-battery", diff: "Easy", time: "About 10 minutes" },
  4: { slug: "oxygen-sensor", job: "o2-sensor", diff: "Moderate", time: "About 1–2 hours per sensor" },
  5: { slug: "rear-brake-pads", job: "brake-pads-rear", diff: "Moderate", time: "About 1.5–2.5 hours for both sides" },
  6: { slug: "serpentine-belt", job: "serpentine-belt", diff: "Moderate", time: "About 1–2 hours" },
  7: { slug: "battery", job: "battery", diff: "Moderate", time: "About 45–90 minutes including registration" },
  8: { slug: "coolant", job: "coolant", diff: "Moderate", time: "About 2–3 hours including bleeding" },
  9: { slug: "fluid-checks", job: "fluid-checks", diff: "Easy", time: "About 15–30 minutes" },
  10: { slug: "cabin-air-filter", job: "cabin-air-filter", diff: "Easy", time: "About 15–30 minutes" },
  11: { slug: "pcv-valve", job: "pcv-valve", diff: "Moderate", time: "Inspection about 30 minutes" },
  12: { slug: "engine-air-filter", job: "engine-air-filter", diff: "Easy", time: "About 15–30 minutes" },
  13: { slug: "tire-rotation", job: "tire-rotation", diff: "Easy", time: "About 45–60 minutes" },
  14: { slug: "wiper-blades", job: "wiper-blades", diff: "Easy", time: "About 10 minutes" },
  15: { slug: "differential-fluid", job: "driveline-fluid", diff: "Moderate", time: "About 1–1.5 hours" },
  16: { slug: "oil-change", job: "oil-change", diff: "Easy", time: "About 45–75 minutes" },
};
// Jobs with no torqued fastener anywhere in the procedure (types.ts noFasteners rule). Everything else keeps its torque list.
const NO_FASTENERS = new Set([3, 14]);

function norm(status) {
  const s = String(status ?? "");
  if (/conflict/i.test(s)) return "conflict";
  if (/^\s*verified/i.test(s)) return "verified";
  if (/missing/i.test(s)) return "missing";
  return "single";
}

const q = (s) => JSON.stringify(String(s));
const files = fs.readdirSync(EVID).filter((f) => /^guide-\d\d\.json$/.test(f)).sort();
const guides = files.map((f) => JSON.parse(fs.readFileSync(path.join(EVID, f), "utf8")));

function counts(g) {
  const all = [...g.tools, ...g.parts, ...g.fluids, ...g.torque, ...g.steps];
  const c = { verified: 0, single: 0, conflict: 0, missing: 0 };
  for (const x of all) c[norm(x.status)]++;
  return c;
}

function buildGuide(g) {
  const m = META[g.guide];
  if (!m) throw new Error(`no META for guide ${g.guide}`);
  const c = counts(g);
  const steps = [];
  if (g.variantDependencies?.length) {
    steps.push({
      title: "Confirm your car's configuration first",
      instructions:
        "This draft depends on how your car was built. Check each item before buying parts: " +
        g.variantDependencies.join(" | "),
      warning: "⚠ CONFIGURATION NOT CONFIRMED FOR THIS VIN — see the evidence summary for the exact open items.",
    });
  }
  for (const s of g.steps) {
    const st = norm(s.status);
    const warn = [...(s.warnings ?? [])];
    if (st !== "verified") warn.push(`⚠ ${st === "conflict" ? "SOURCES DISAGREE" : st === "missing" ? "NOT FOUND IN ANY SOURCE" : "SINGLE-SOURCE STEP"} — confirm before relying on it.`);
    steps.push({ title: s.title, instructions: s.instruction, warning: warn.length ? warn.join(" ") : undefined });
  }
  const torque = g.torque.map((t) => {
    const ok = norm(t.status) === "verified" && t.value && !/missing/i.test(t.value);
    return ok
      ? { fastener: t.fastener, value: t.value, notes: "Reference from secondary sources only (no BMW document was reachable). Confirm against your owner's manual before use." }
      : {
          fastener: t.fastener,
          value: V_TORQUE,
          notes: `Reference only, NOT verified (${norm(t.status)}): ${t.value ?? "no value found"}.${t.conflicts ? ` ${t.conflicts}` : ""}`,
        };
  });
  const parts = [
    ...g.parts.map((p) => `${p.item}${p.partNumber ? ` — ${p.partNumber}` : ""} [${norm(p.status)}]`),
    ...g.fluids.map((f) => `Fluid: ${f.item} — ${f.spec}${f.capacity ? `, ${f.capacity}` : ""} [${norm(f.status)}]`),
  ];
  return {
    no: g.guide,
    id: `admin-draft-bmw-2010-328i-${m.slug}`,
    slug: m.slug,
    title: `${g.name} — 2010 BMW 328i (DRAFT)`,
    summary:
      `DRAFT, not published and not certified. Built from secondary sources only; no BMW owner's manual, TIS or ETK document was reachable. ` +
      `Evidence: ${c.verified} item(s) agreed by 2+ independent sources, ${c.single} single-source, ${c.conflict} conflicting, ${c.missing} not found. ` +
      `Status: ${g.recommendedStatus}.`,
    difficulty: m.diff,
    estTime: `${m.time} (author's estimate)`,
    job: m.job,
    tools: g.tools.map((t) => ({ name: t.item, note: norm(t.status) === "verified" ? undefined : `[${norm(t.status)}]` })),
    parts,
    safety: g.safety.length ? g.safety : ["Follow standard jack-stand and fluid-handling safety."],
    torque,
    steps,
    noFasteners: NO_FASTENERS.has(g.guide),
  };
}

const built = guides.map(buildGuide);

function ts() {
  const L = [];
  L.push("// GENERATED by scripts/bmw/build-drafts.mjs from docs/bmw-e90/evidence/*.json. DO NOT EDIT BY HAND.");
  L.push("// ADMIN-ONLY DRAFTS for the 2010 BMW 328i (E90). Nothing here is published or certified: this directory is imported only");
  L.push("// by /admin routes (same gate as the Charger admin test guide). Any torque not VERIFIED renders the VERIFY warning.");
  L.push('import type { ResolvedGuide, RepairStep, TorqueSpec } from "@/types/vehicle";');
  L.push('import type { AdminTestGuide } from "./charger-2016-sxt-multi-job";');
  L.push('import { getVehicleById } from "@/data/vehicles";');
  L.push("");
  L.push('const VEHICLE_ID = "2010-bmw-328i-3.0l";');
  L.push("");
  L.push("function mk(g: Omit<ResolvedGuide, \"vehicleId\"> ): ResolvedGuide {");
  L.push("  return { ...g, vehicleId: VEHICLE_ID };");
  L.push("}");
  L.push("");
  L.push("const GUIDES: ResolvedGuide[] = [");
  for (const g of built) {
    L.push("  mk({");
    L.push(`    id: ${q(g.id)},`);
    L.push(`    jobType: ${q(g.job)},`);
    L.push(`    title: ${q(g.title)},`);
    L.push(`    summary: ${q(g.summary)},`);
    L.push(`    difficulty: ${q(g.difficulty)},`);
    L.push(`    estTime: ${q(g.estTime)},`);
    L.push(`    tier: "free",`);
    if (g.noFasteners) L.push("    noFasteners: true,");
    L.push("    tools: [" + g.tools.map((t) => `{ name: ${q(t.name)}${t.note ? `, note: ${q(t.note)}` : ""} }`).join(", ") + "],");
    L.push("    parts: [" + g.parts.map(q).join(", ") + "],");
    L.push("    safety: [" + g.safety.map(q).join(", ") + "],");
    L.push("    torqueSpecs: [" + g.torque.map((t) => `{ fastener: ${q(t.fastener)}, value: ${q(t.value)}, notes: ${q(t.notes)} }`).join(", ") + "],");
    L.push("    steps: [");
    g.steps.forEach((s, i) => {
      L.push(`      { number: ${i + 1}, title: ${q(s.title)}, instructions: ${q(s.instructions)}${s.warning ? `, warning: ${q(s.warning)}` : ""} },`);
    });
    L.push("    ],");
    L.push("  }),");
  }
  L.push("];");
  L.push("");
  L.push("const SLUGS: Record<string, string> = {");
  for (const g of built) L.push(`  ${q(g.id)}: ${q("bmw-2010-328i-" + g.slug)},`);
  L.push("};");
  L.push("");
  L.push("export const bmwDraftGuides: AdminTestGuide[] = GUIDES.flatMap((guide) => {");
  L.push("  const vehicle = getVehicleById(VEHICLE_ID);");
  L.push("  return vehicle ? [{ slug: SLUGS[guide.id], vehicle, guide }] : [];");
  L.push("});");
  L.push("");
  L.push("// Silence unused-type warnings for the helper types kept for hand edits during review.");
  L.push("export type _BmwDraftTypes = [RepairStep, TorqueSpec];");
  L.push("");
  return L.join("\n");
}

function md() {
  const L = [];
  L.push("# 2010 BMW 328i (E90) — evidence summary by guide");
  L.push("");
  L.push("GENERATED by `scripts/bmw/build-drafts.mjs` from `docs/bmw-e90/evidence/*.json`. Do not edit by hand.");
  L.push("");
  L.push("Nothing here is published or certified. No BMW primary document (owner's manual, TIS, ETK) was reachable; every source is a forum, retailer or independent-shop page. \"Verified\" below means 2+ independent secondary sources agree.");
  L.push("");
  L.push("| # | Guide | Status | Verified | Single-source | Conflict | Missing |");
  L.push("|---|---|---|---|---|---|---|");
  for (const g of guides) {
    const c = counts(g);
    L.push(`| ${g.guide} | ${g.name} | ${g.recommendedStatus} | ${c.verified} | ${c.single} | ${c.conflict} | ${c.missing} |`);
  }
  for (const g of guides) {
    L.push("");
    L.push(`## ${g.guide}. ${g.name} — ${g.recommendedStatus}`);
    L.push("");
    L.push("**Missing or unresolved evidence**");
    for (const m of g.missingEvidence) L.push(`- ${m}`);
    L.push("");
    L.push("**Needs owner input**");
    if (g.ownerInputsNeeded.length) for (const m of g.ownerInputsNeeded) L.push(`- ${m}`);
    else L.push("- none recorded");
  }
  L.push("");
  return L.join("\n");
}

const outputs = [[OUT_TS, ts()], [OUT_MD, md()]];
if (process.argv.includes("--check")) {
  let stale = 0;
  for (const [p, content] of outputs) {
    if (!fs.existsSync(p) || fs.readFileSync(p, "utf8") !== content) { console.error("STALE: " + path.relative(ROOT, p)); stale++; }
  }
  process.exit(stale ? 1 : 0);
}
for (const [p, content] of outputs) fs.writeFileSync(p, content);
console.log(`wrote ${built.length} draft guides, ${built.reduce((n, g) => n + g.steps.length, 0)} steps, ${built.reduce((n, g) => n + g.torque.length, 0)} torque rows`);

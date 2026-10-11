#!/usr/bin/env node
// Builds the ADMIN-ONLY draft guides for the 2010 BMW 328i (E90) from the evidence ledger.
//
//   docs/bmw-e90/evidence/guide-NN.json  --(this script)-->  src/data/admin-test-guides/bmw-2010-328i-drafts.ts
//                                                            docs/bmw-e90/EVIDENCE-SUMMARY.md
//
// Rules this script enforces (so the output cannot quietly overstate the evidence):
//  * A torque value is printed as a number ONLY when its evidence status is VERIFIED (BMW document, or 2+ agreeing
//    sources with a primary) or VERIFIED_SECONDARY (2+ independent hosts, no BMW document; the note says so). Anything
//    else (SINGLE_SOURCE, CONFLICT, MISSING) renders the house warning "VERIFY EXACT TORQUE BEFORE SERVICE" and keeps
//    the reference figure in the notes.
//  * Every step that is not VERIFIED carries a visible warning (secondary-source steps get a milder one).
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
export const NOT_A_TORQUE_PREFIX = "Not a torque value: ";
// Ledger rows that are not torque figures. Keyed by guide + fastener text; a stale entry throws (see buildGuide).
const NOT_A_TORQUE = [
  { g: 3, re: /^None applicable/i, value: `${NOT_A_TORQUE_PREFIX}nothing to tighten`, notes: "This job has no torqued fasteners." },
  { g: 8, re: /^Expansion tank cap/i, value: `${NOT_A_TORQUE_PREFIX}turn until it clicks`, notes: "The owner's manual describes this cap as closing with an audible click. No torque figure applies." },
  { g: 9, re: /^Coolant expansion tank cap/i, value: `${NOT_A_TORQUE_PREFIX}turn until it clicks`, notes: "The owner's manual describes this cap as closing with an audible click. No torque figure applies." },
  { g: 13, re: /^Tire pressures/i, value: `${NOT_A_TORQUE_PREFIX}tire pressure`, notes: "Use the pressures on the door-jamb placard. The figures in the evidence file come from one third-party table and are not shown here." },
  { g: 14, re: /^Wiper arm nut/i, value: `${NOT_A_TORQUE_PREFIX}not touched in this job`, notes: "A blade swap does not disturb the arm nut." },
  { g: 15, re: /^xDrive transfer case plugs/i, value: `${NOT_A_TORQUE_PREFIX}xDrive only`, notes: "Not applicable if this car is rear-wheel drive. Confirm the drivetrain before skipping." },
  { g: 15, re: /^xDrive front differential plug/i, value: `${NOT_A_TORQUE_PREFIX}xDrive only`, notes: "Not applicable if this car is rear-wheel drive. Confirm the drivetrain before skipping." },
];

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
  11: { slug: "pcv-valve", job: "pcv-valve", diff: "Easy", time: "About 30 minutes (inspection and hose check only)" },
  12: { slug: "engine-air-filter", job: "engine-air-filter", diff: "Easy", time: "About 15–30 minutes" },
  13: { slug: "tire-rotation", job: "tire-rotation", diff: "Easy", time: "About 45–60 minutes" },
  14: { slug: "wiper-blades", job: "wiper-blades", diff: "Easy", time: "About 10 minutes" },
  15: { slug: "differential-fluid", job: "driveline-fluid", diff: "Moderate", time: "About 1–1.5 hours" },
  16: { slug: "oil-change", job: "oil-change", diff: "Easy", time: "About 45–75 minutes" },
};
// Jobs with no torqued fastener anywhere in the procedure (types.ts noFasteners rule). Everything else keeps its torque list.
const NO_FASTENERS = new Set([3, 11, 14]);

// Normalised evidence class. "secondary" = VERIFIED_SECONDARY (2+ independent hosts, no BMW document).
// Compound strings such as "VERIFIED (capacity); MISSING (spec)" classify by their first token, then downgrade if they
// also mention a conflict or a missing part.
function norm(status) {
  const s = String(status ?? "");
  if (/conflict/i.test(s)) return "conflict";
  if (/^\s*verified_secondary/i.test(s)) return /missing/i.test(s) ? "missing" : "secondary";
  if (/^\s*verified/i.test(s)) return /missing/i.test(s) ? "missing" : "verified";
  if (/missing/i.test(s)) return "missing";
  return "single";
}
const PRINTABLE = new Set(["verified", "secondary"]);

// ---------------------------------------------------------------------------------------------------------------------------
// STEP DISPOSITIONS. Every ledger step whose evidence status is CONFLICT or MISSING MUST be decided here, or the build fails
// (so a new unresolved step can never slip into a guide silently).
//   BLOCKED       unresolved AND safety-critical (or BMW says shop-only): the procedure text is NOT shown. The step stays in the
//                 walkthrough as a visible stop, with the reason and the safe alternative. The original text stays in the ledger.
//   INAPPLICABLE  does not exist on this car (RWD 328i): removed from the walkthrough, stated once in the guide summary.
//   ACCEPTED      unresolved only in a detail that is not safety-critical, or the step text itself already tells the reader to
//                 stop/verify: shown with its warning. The reason is recorded here so the decision is reviewable.
// ---------------------------------------------------------------------------------------------------------------------------
const DISPOSITION = [
  { g: 2, re: /^Engine-bay fuses/i, kind: "BLOCKED", reason: "Where the engine-bay fuse boxes are and how they open is not established by any BMW document (web sources disagree).", instead: "Do not open or probe them. Use the glove-box fuse box only; if an engine-electronics fault remains after that, have the car diagnosed." },
  { g: 2, re: /^Xenon low-beam/i, kind: "BLOCKED", reason: "BMW states xenon lamp work, including bulb replacement, is for a BMW center or qualified workshop only (high voltage).", instead: "Do not replace a xenon bulb yourself. Have a BMW center or qualified workshop do it." },
  { g: 6, re: /^Replace the idler pulley/i, kind: "BLOCKED", reason: "The idler pulley bolt torque is unresolved: sources disagree by a factor of two, and BMW's own printed value was later corrected without the new number being readable. No figure is shown here on purpose.", instead: "Skip this step. Leave the idler pulley in place and re-inspect it at step 5; if it is worn or noisy, have it replaced with BMW repair data." },
  { g: 15, re: /^xDrive only/i, kind: "INAPPLICABLE", reason: "Transfer case and front differential exist only on xDrive. The VIN decode and the parts catalog show a rear-wheel-drive 328i." },
  { g: 2, re: /^Parking \/ halo/i, kind: "ACCEPTED", reason: "Bulb type disputed; the step tells the reader to match the old bulb's marking. Not a safety-critical fastener or procedure." },
  { g: 6, re: /^Clear access to the belt/i, kind: "ACCEPTED", reason: "Two sourced access methods are given; the conflict is about which fasteners, and the step says to use what is on the car." },
  { g: 7, re: /^Tightening torques/i, kind: "ACCEPTED", reason: "No torque exists in any source; the step says snug, do not over-tighten, and publishes no number." },
  { g: 9, re: /^Transmission and differential/i, kind: "ACCEPTED", reason: "The step itself tells the owner not to top up or service these and to go to a shop." },
  { g: 13, re: /^Support the car on stands/i, kind: "ACCEPTED", reason: "Stand positions are unsourced; the step itself says never rely on the jack and to stop and use a shop lift if no safe point is found." },
  { g: 14, re: /^Release the old blade/i, kind: "ACCEPTED", reason: "Direction of the final pull conflicts between sources; the step says try BMW's direction and never force it." },
  { g: 16, re: /^Drain the sump/i, kind: "ACCEPTED", reason: "Plug orientation unestablished; the step says shield your hand, angle the pan, and remove only the 17 mm plug with the copper washer." },
];
export function dispositionFor(guideNo, title) {
  return DISPOSITION.find((d) => d.g === guideNo && d.re.test(title));
}
const BLOCK_PREFIX = "⛔ BLOCKED — ";


// Raw URLs are unreadable on a phone and run off the screen. The ledger (docs/bmw-e90/evidence/*.json) keeps every full URL;
// the customer-facing text keeps only the host, e.g. "[https://vpic.nhtsa.dot.gov/api/...]" -> "(vpic.nhtsa.dot.gov)".
const host = (u) => u.replace(/^https?:\/\//, "").split(/[\/?#]/)[0];
export function stripUrls(text) {
  return String(text)
    .replace(/\((https?:\/\/[^\s)\]]+)\)/g, (_, u) => `(${host(u)})`)
    .replace(/\[(https?:\/\/[^\s\]]+)\]/g, (_, u) => `(${host(u)})`)
    .replace(/https?:\/\/[^\s)\]]+/g, (u) => `(${host(u)})`);
}
// One checklist item -> one sentence, so Wrench Mode renders it as its own numbered line.
const asSentence = (t) => {
  const x = stripUrls(t).replace(/\s+/g, " ").trim();
  const cap = x.charAt(0).toUpperCase() + x.slice(1);
  return /[.!?]$/.test(cap) ? cap : cap + ".";
};
// Internal evidence jargon -> words a customer understands. Wording only: no fact, number or uncertainty flag is dropped.
const PLAIN = [
  [/VIN-DECODE\.md/g, "the VIN decode"],
  [/NHTSA vPIC/g, "NHTSA's VIN decoder"],
  [/\bBMW TIS\b/g, "BMW service manual"],
  [/\bTIS\b/g, "BMW service manual"],
  [/\bETK\b/g, "BMW parts catalog"],
  [/older ledger entry/g, "older catalog entry"],
  [/hence primary:false and VERIFIED_SECONDARY, not VERIFIED\./g, "so it counts as independent-source confirmation, not a BMW document."],
  [/VERIFIED_SECONDARY/g, "confirmed by independent sources"],
  [/\bnot VERIFIED\b/g, "not confirmed from a BMW document"],
  [/\bvariantDependencies\b/g, "the build checks above"],
  [/\bCONFLICT\b/g, "disagreement"],
  [/secondary[- ]sourced/gi, "sourced from independent websites"],
  [/secondary hosts/gi, "independent websites"],
  [/secondary[- ]sources?/gi, "independent websites"],
];
export function plain(text) {
  return PLAIN.reduce((t, [re, to]) => t.replace(re, to), String(text));
}
const q = (s) => JSON.stringify(plain(stripUrls(String(s))));

// How confidence is shown to the reader (the raw ledger status words stay internal).
const TAGS = { verified: "", secondary: "(confirmed by 2+ independent sources)", single: "(one source only: confirm)", conflict: "(sources disagree: confirm)", missing: "(not confirmed)" };
const tagOf = (st) => TAGS[st] ?? "";
const STEP_WARN = {
  conflict: "⚠ Sources disagree on this step. Confirm before relying on it.",
  missing: "⚠ No source confirms this step. Confirm before relying on it.",
  secondary: "⚠ Based on independent websites, not a BMW document. Confirm against your owner's manual before relying on it.",
  single: "⚠ Only one source supports this step. Confirm before relying on it.",
};

// ---- long-step handling (display only; every word is kept, only the grouping changes) ----
// Same sentence rule as splitInstruction in src/lib/wrenchSteps.ts (Wrench Mode shows each sentence as a numbered line).
export function sentencesOf(text) {
  const parts = []; let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c !== "." && c !== "!" && c !== "?") continue;
    if (!/\s/.test(text[i + 1] ?? "")) continue;
    let j = i + 1; while (j < text.length && /\s/.test(text[j])) j++;
    if (j < text.length && /[A-Z⚠]/.test(text[j])) { parts.push(text.slice(start, i + 1).trim()); start = j; i = j - 1; }
  }
  parts.push(text.slice(start).trim());
  return parts.filter(Boolean);
}
const LONG_STEP = 650;
/** One long step -> two steps of similar size, cut at a sentence boundary. Short, single-sentence or blocked steps are untouched. */
function splitLong(step) {
  const sents = sentencesOf(step.instructions);
  if (step.instructions.length <= LONG_STEP || sents.length < 4 || step.title.startsWith(BLOCK_PREFIX)) return [step];
  let best = 1, bestDiff = Infinity;
  for (let k = 1; k < sents.length; k++) {
    const a = sents.slice(0, k).join(" ").length, b = sents.slice(k).join(" ").length;
    if (Math.abs(a - b) < bestDiff) { bestDiff = Math.abs(a - b); best = k; }
  }
  const halves = [sents.slice(0, best).join(" "), sents.slice(best).join(" ")];
  return halves.map((instructions, i) => ({ ...step, title: `${step.title} (part ${i + 1} of 2)`, instructions }));
}
/** The pre-job configuration checklist -> a few short "Before you start" steps instead of one wall of text. */
function configSteps(deps) {
  const items = deps.map(asSentence);
  const groups = [[]]; let len = 0;
  for (const it of items) {
    if (groups[groups.length - 1].length && len + it.length > 780) { groups.push([]); len = 0; }
    groups[groups.length - 1].push(it); len += it.length;
  }
  return groups.map((g, i) => ({
    title: `Before you start: check your car's build (${i + 1} of ${groups.length})`,
    instructions: (i === 0 ? "This guide depends on how your car was built. Check each item before buying parts. " : "") + g.join(" "),
    warning: i === 0 ? "⚠ Your car's exact build is not confirmed from the VIN alone. Check every item in this section before buying parts." : undefined,
  }));
}
const files = fs.readdirSync(EVID).filter((f) => /^guide-\d\d\.json$/.test(f)).sort();
const guides = files.map((f) => JSON.parse(fs.readFileSync(path.join(EVID, f), "utf8")));

function counts(g) {
  const all = [...g.tools, ...g.parts, ...g.fluids, ...g.torque, ...g.steps];
  const c = { verified: 0, secondary: 0, single: 0, conflict: 0, missing: 0 };
  for (const x of all) c[norm(x.status)]++;
  return c;
}

function buildGuide(g) {
  const m = META[g.guide];
  if (!m) throw new Error(`no META for guide ${g.guide}`);
  const c = counts(g);
  const steps = [];
  if (g.variantDependencies?.length) steps.push(...configSteps(g.variantDependencies));
  const inapplicable = [];
  for (const s of g.steps) {
    const st = norm(s.status);
    const disp = dispositionFor(g.guide, s.title);
    if ((st === "conflict" || st === "missing") && !disp) throw new Error(`guide ${g.guide} step "${s.title}" is ${st} in the ledger but has no DISPOSITION (BLOCKED / INAPPLICABLE / ACCEPTED). Decide it in build-drafts.mjs.`);
    if (disp?.kind === "INAPPLICABLE") { inapplicable.push(`${s.title.replace(/\s*\(.*$/, "")}: not applicable. ${disp.reason}`); continue; }
    if (disp?.kind === "BLOCKED") {
      steps.push({
        title: BLOCK_PREFIX + s.title.replace(/\s*\(.*$/, ""),
        instructions: `This step is blocked: it cannot be done safely from this guide. ${disp.reason} ${disp.instead}`,
        warning: "⛔ BLOCKED — unresolved safety-critical item. Do not perform this procedure from this guide.",
      });
      continue;
    }
    const warn = [...(s.warnings ?? [])];
    if (st !== "verified") warn.push(STEP_WARN[st] ?? STEP_WARN.single);
    steps.push(...splitLong({ title: s.title, instructions: s.instruction, warning: warn.length ? warn.join(" ") : undefined }));
  }
  for (const d of DISPOSITION.filter((x) => x.g === g.guide)) {
    if (!g.steps.some((s) => d.re.test(s.title))) throw new Error(`DISPOSITION for guide ${g.guide} (${d.re}) matches no ledger step: table is stale.`);
  }
  for (const r of NOT_A_TORQUE.filter((x) => x.g === g.guide)) {
    if (!g.torque.some((t) => r.re.test(t.fastener))) throw new Error(`NOT_A_TORQUE for guide ${g.guide} (${r.re}) matches no ledger torque row: table is stale.`);
  }
  const torque = g.torque.map((t) => {
    const st = norm(t.status);
    // Rows that are not a torque figure at all (nothing to tighten, a click-type cap, a tire pressure, a part this car lacks)
    // must not shout "VERIFY EXACT TORQUE": that would send a reader hunting for a spec that does not exist.
    // The label never carries a number and never turns an unknown torque into a known one.
    const nt = NOT_A_TORQUE.find((r) => r.g === g.guide && r.re.test(t.fastener));
    if (nt) return { fastener: t.fastener, value: nt.value, notes: nt.notes };
    const ok = PRINTABLE.has(st) && t.value && /\d/.test(t.value) && !/no torque|not found|missing/i.test(t.value);
    return ok
      ? {
          fastener: t.fastener,
          value: t.value,
          notes: st === "verified"
            ? `Confirmed from BMW documentation or agreeing sources. Still check your owner's manual or service data before use.${t.conflicts ? ` Note: ${t.conflicts}` : ""}`
            : `Two or more independent sources agree on this figure; no BMW document was available. Confirm against BMW service data before use.${t.conflicts ? ` Note: ${t.conflicts}` : ""}`,
        }
      : {
          fastener: t.fastener,
          value: V_TORQUE,
          // A CONFLICT must not leak either candidate number into the guide (a reader would pick one). Single-source and missing
          // rows keep their reference text; the full conflict detail stays in the evidence ledger.
          notes: st === "conflict"
            ? "Sources conflict on this value, so no figure is shown. Use BMW repair data for this fastener."
            : `Reference only, not confirmed${st === "missing" ? " (no figure found)" : " (one source)"}: ${t.value ?? "no value found"}.${t.conflicts ? ` ${t.conflicts}` : ""}`,
        };
  });
  const parts = [
    ...g.parts.map((p) => `${p.item}${p.partNumber ? ` — ${p.partNumber}` : ""}${tagOf(norm(p.status)) ? ` ${tagOf(norm(p.status))}` : ""}`),
    ...g.fluids.map((f) => `Fluid: ${f.item} — ${f.spec}${f.capacity ? `, ${f.capacity}` : ""}${tagOf(norm(f.status)) ? ` ${tagOf(norm(f.status))}` : ""}`),
  ];
  return {
    no: g.guide,
    id: `admin-draft-bmw-2010-328i-${m.slug}`,
    slug: m.slug,
    title: `${g.name} — 2010 BMW 328i (DRAFT)`,
    summary:
      `Draft for owner testing: not published and not certified. ${g.primarySourceFound ? "Some facts come from BMW document text (owner's-manual copies or training material); the rest from independent websites." : "Built from independent websites only; no BMW document was found for the key safety facts."} ` +
      `Of the facts behind this guide: ${c.verified} confirmed from BMW documents or agreeing sources, ${c.secondary} confirmed by 2+ independent sources, ${c.single} from a single source, ${c.conflict} where sources disagree, ${c.missing} not found. ` +
      `Anything not confirmed is flagged in the step it affects.` +
      (inapplicable.length ? ` Not applicable to this car: ${inapplicable.join(" ")}` : "") +
      (steps.some((x) => x.title.startsWith(BLOCK_PREFIX)) ? ` Blocked steps (unresolved safety-critical): ${steps.filter((x) => x.title.startsWith(BLOCK_PREFIX)).length}.` : ""),
    difficulty: m.diff,
    estTime: `${m.time} (author's estimate)`,
    job: m.job,
    tools: g.tools.map((t) => ({ name: t.item, note: tagOf(norm(t.status)) || undefined })),
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

// Readiness is about the TEXT of the guide. It is never certification: images, independent QA and owner sign-off are separate.
function readiness(g) {
  const rows = [...g.parts, ...g.fluids, ...g.torque, ...g.steps];
  const conflicts = rows.filter((x) => norm(x.status) === "conflict").length;
  const missingContent = [...g.parts, ...g.fluids, ...g.steps].filter((x) => norm(x.status) === "missing").length;
  const blockers = [];
  if (conflicts) blockers.push(`${conflicts} conflicting item(s)`);
  if (missingContent) blockers.push(`${missingContent} part/fluid/step item(s) not found`);
  const caveats = [];
  const noTorque = g.torque.filter((t) => !PRINTABLE.has(norm(t.status)));
  if (noTorque.length && !NO_FASTENERS.has(g.guide)) caveats.push(`${noTorque.length} torque value(s) withheld (house VERIFY warning shows)`);
  if (g.evidenceTier === "safety-critical" && !g.primarySourceFound) caveats.push("safety-critical with no BMW document found");
  if (g.variantDependencies?.length) caveats.push("configuration items need owner confirmation");
  return { level: blockers.length ? "NEEDS_EVIDENCE" : "READY_FOR_QA", blockers, caveats };
}

function md() {
  const L = [];
  L.push("# 2010 BMW 328i (E90) — evidence summary by guide");
  L.push("");
  L.push("GENERATED by `scripts/bmw/build-drafts.mjs` from `docs/bmw-e90/evidence/*.json`. Do not edit by hand.");
  L.push("");
  L.push("Nothing here is published or certified. Evidence classes: **verified** = a BMW document, or 2+ agreeing sources including one; **secondary** = 2+ independent hosts agree, no BMW document; **single** = one source; **conflict** = sources disagree; **missing** = not found. Criticality tier decides how much evidence a fact needs: safety-critical guides may not print a figure from a single source.");
  L.push("");
  L.push("Readiness describes the guide TEXT only. `READY_FOR_QA` = no conflicts and no missing parts/fluids/steps; it is not certification. Certification also needs certified images, independent (Hermes) QA, and owner sign-off. Certified images today: 0.");
  L.push("");
  L.push("| # | Guide | Tier | BMW doc | Readiness | Verified | Secondary | Single | Conflict | Missing | Visuals proposed |");
  L.push("|---|---|---|---|---|---|---|---|---|---|---|");
  for (const g of guides) {
    const c = counts(g);
    L.push(`| ${g.guide} | ${g.name} | ${g.evidenceTier} | ${g.primarySourceFound ? "yes" : "no"} | ${readiness(g).level} | ${c.verified} | ${c.secondary} | ${c.single} | ${c.conflict} | ${c.missing} | ${(g.visuals ?? []).length} |`);
  }
  for (const g of guides) {
    const r = readiness(g);
    L.push("");
    L.push(`## ${g.guide}. ${g.name} — ${g.recommendedStatus} (${r.level})`);
    L.push("");
    if (r.blockers.length) L.push(`**Blockers:** ${r.blockers.join("; ")}`, "");
    if (r.caveats.length) L.push(`**Caveats:** ${r.caveats.join("; ")}`, "");
    if (g.primaryScope) L.push(`**BMW-document scope:** ${g.primaryScope}`, "");
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

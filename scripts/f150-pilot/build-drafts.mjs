#!/usr/bin/env node
// PILOT builder: admin-only DRAFT guides for the 2015 Ford F-150 XLT SuperCrew 4x4 5.0L (6R80) from docs/f150-pilot/evidence/*.json.
//
// This file is a MEASURED COPY of the admin-draft core of scripts/bmw/build-drafts.mjs (norm, wording, long-step split, configuration
// steps, cross-reference re-pointing, torque rules, buildGuide, ts()). Reason: build-drafts.mjs cannot be imported: it has no main
// guard, so importing it rewrites the BMW outputs, and its DISPOSITION / META / NOT_A_TORQUE tables are keyed by BMW guide numbers.
// The customer scrub / neutralize / configure path is BMW-specific (the owner's VIN, config-axes) and is NOT copied.
// Rules are unchanged: a torque prints as a number only when VERIFIED or VERIFIED_SECONDARY; every unconfirmed step carries a warning;
// every CONFLICT/MISSING step must have a DISPOSITION or the build fails.
//
//   node scripts/f150-pilot/build-drafts.mjs           write outputs
//   node scripts/f150-pilot/build-drafts.mjs --check   exit 1 if the committed outputs are stale
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const EVID = path.join(ROOT, "docs/f150-pilot/evidence");
const OUT_TS = path.join(ROOT, "src/data/admin-test-guides/f150-2015-drafts.ts");
const OUT_MD = path.join(ROOT, "docs/f150-pilot/EVIDENCE-SUMMARY.md");
export const VEHICLE_ID = "2015-ford-f150-5.0l";

const V_TORQUE = "⚠ VERIFY EXACT TORQUE BEFORE SERVICE";
export const NOT_A_TORQUE_PREFIX = "Not a torque value: ";
// Ledger rows that are not torque figures. Keyed by guide + fastener text; a stale entry throws (see buildGuide).
const NOT_A_TORQUE = [
  { g: 1, re: /^Front rotor discard/i, value: `${NOT_A_TORQUE_PREFIX}rotor minimum thickness`, notes: "This is a wear limit, not a fastener torque. No figure for this truck was found; do not guess one. Have a shop measure the rotor if in doubt." },
  { g: 3, re: /^Degas bottle/i, value: `${NOT_A_TORQUE_PREFIX}turn until it stops`, notes: "No torque figure applies to the reservoir cap. The wording comes from one source; follow the cap's own markings." },
  { g: 3, re: /^Block-heater plug/i, value: `${NOT_A_TORQUE_PREFIX}not touched in this job`, notes: "The block-heater plug and engine block drain are not used in this procedure." },
];
// Editorial metadata the research files do not carry. Difficulty and time are the author's estimates, not sourced facts.
const META = {
  1: { slug: "front-brake-pads", job: "brake-pads-front", diff: "Moderate", time: "About 1.5-2.5 hours for both sides" },
  2: { slug: "battery", job: "battery", diff: "Easy", time: "About 30-60 minutes" },
  3: { slug: "coolant", job: "coolant", diff: "Moderate", time: "About 2-3 hours including bleeding" },
};
const NO_FASTENERS = new Set([]);

// ---------------------------------------------------------------------------------------------------------------------------
// STEP DISPOSITIONS (PROPOSED by the pilot author. They are safety decisions and need owner review before anything is built for a customer.)
//   BLOCKED / INAPPLICABLE / ACCEPTED: same meaning as the BMW table.
// ---------------------------------------------------------------------------------------------------------------------------
const DISPOSITION = [
  { g: 1, re: /^Inspect the rotor and the caliper/i, kind: "ACCEPTED", reason: "No rotor discard thickness was found for this truck. The step publishes no number, tells the reader to replace pads and rotors in pairs, and sends doubtful rotors to a shop." },
  { g: 2, re: /^Battery monitoring reset/i, kind: "ACCEPTED", reason: "Sources disagree and none covers this exact truck. The step makes no claim either way and sends the reader to the owner's manual section on changing the battery." },
  { g: 2, re: /^Tightening torques/i, kind: "ACCEPTED", reason: "No torque exists in any source read; the step says tighten firmly without crushing and publishes no number." },
  { g: 3, re: /^Decide whether the truck must be raised/i, kind: "ACCEPTED", reason: "Access to the drain valve is not established; the step carries the jack-stand policy and tells the reader to stop and use a lift if no safe point is found." },
  { g: 3, re: /^Run the engine and bleed air/i, kind: "ACCEPTED", reason: "The conflict is only the cabin-heater setting during bleeding; the step defers to Ford's workshop manual, keeps the cool-down, level and overheat rules, and does not publish either heater setting." },
];
export function dispositionFor(guideNo, title) {
  return DISPOSITION.find((d) => d.g === guideNo && d.re.test(title));
}

// Normalised evidence class. "secondary" = VERIFIED_SECONDARY (2+ independent hosts, no Ford document).
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
  [/\bFord TIS\b/g, "Ford service manual"],
  [/\bTIS\b/g, "Ford service manual"],
  [/\bETK\b/g, "Ford parts catalog"],
  [/older ledger entry/g, "older catalog entry"],
  [/hence primary:false and VERIFIED_SECONDARY, not VERIFIED\./g, "so it counts as independent-source confirmation, not a Ford document."],
  [/VERIFIED_SECONDARY/g, "confirmed by independent sources"],
  [/\bnot VERIFIED\b/g, "not confirmed from a Ford document"],
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
  secondary: "⚠ Based on independent websites, not a Ford document. Confirm against your owner's manual before relying on it.",
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

// ---- cross-references (both copies) ----
// The evidence ledgers refer to their own steps ("go to step 7") and to other guides ("see guide 16") by LEDGER number. The built guide adds
// "Before you start" steps, splits long steps and drops inapplicable ones, so those numbers went stale. Every reference is re-pointed at the
// number the reader actually sees, and a guide number becomes the guide's name. A step reference that cannot be resolved drops its sentence.
const GUIDE_NAME = new Map(guides.map((x) => [x.guide, x.name]));
// Ledger sentences that are wrong once built, fixed before the numbers are re-pointed. Each must match (stale guard below).
const LEDGER_TEXT_FIXES = [];
const LEDGER_FIXES_USED = new Set();
export const CHANGES = []; // every sentence the build rewrote or dropped, for docs/bmw-e90/CUSTOMER-SCRUB-REPORT.md
const SENT_SPLIT = /(?<=[.!?\]])\s+(?=[A-Z⚠⛔\[])/;
const STEP_REF = /\b([Ss]teps?) (\d{1,2})(?:(\s*(?:to|-|–)\s*|\s+(?:and|or)\s+)(\d{1,2}))?\b/g;
function relinkText(text, ctx, field) {
  let t = String(text);
  for (const f of LEDGER_TEXT_FIXES) if (f.g === ctx.g && t.includes(f.from)) { t = t.split(f.from).join(f.to); LEDGER_FIXES_USED.add(f); }
  t = t.replace(/\bguide (\d{1,2})\b/g, (m, n) => {
    const name = GUIDE_NAME.get(Number(n));
    if (!name) throw new Error(`guide ${ctx.g}: ${field} refers to ${m}, which does not exist`);
    return `the ${name} guide`;
  });
  const out = [];
  for (const sent of t.split(SENT_SPLIT)) {
    let missing = false;
    const fixed = sent.replace(STEP_REF, (m, word, a, sep, b) => {
      const A = ctx.map.get(Number(a)), B = b ? ctx.map.get(Number(b)) : null;
      if (!A || (b && !B)) { missing = true; return m; }
      if (!b) return `${word} ${A.first}`;
      if (/\b(and|or)\b/.test(sep)) return `${word} ${A.first} ${sep.trim()} ${B.first}`;
      return `${word} ${A.first}${/to/.test(sep) ? " to " : "-"}${B.last}`;
    });
    if (missing) { CHANGES.push({ job: ctx.job, field, kind: "dropped (points at a step this guide does not contain)", before: sent }); continue; }
    if (fixed !== sent) CHANGES.push({ job: ctx.job, field, kind: "step number re-pointed", before: sent, after: fixed });
    out.push(fixed);
  }
  return out.join(" ");
}
function relinkGuide(res, map, job) {
  const ctx = { g: res.no, map, job };
  const r = (t, field) => (t == null ? t : relinkText(t, ctx, field));
  return {
    ...res,
    summary: r(res.summary, "summary"),
    tools: res.tools.map((t, i) => ({ ...t, name: r(t.name, `tool ${i + 1}`) })),
    parts: res.parts.map((p, i) => r(p, `part ${i + 1}`)),
    safety: res.safety.map((s, i) => r(s, `safety ${i + 1}`)),
    torque: res.torque.map((t, i) => ({ ...t, fastener: r(t.fastener, `torque ${i + 1}`), notes: r(t.notes, `torque ${i + 1} notes`) })),
    steps: res.steps.map((s, i) => ({ ...s, instructions: r(s.instructions, `step ${i + 1}`), ...(s.warning ? { warning: r(s.warning, `step ${i + 1} warning`) } : {}) })),
  };
}

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
  const leadCount = steps.length;
  const inapplicable = [];
  const ledgerMap = new Map(); // ledger step number -> { first, last } displayed step numbers
  for (const [idx, s] of g.steps.entries()) {
    if (s.n !== idx + 1) throw new Error(`guide ${g.guide}: ledger step numbers are not 1..N in order (step ${idx + 1} has n=${s.n})`);
    const start = steps.length;
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
      ledgerMap.set(s.n, { first: start + 1, last: steps.length });
      continue;
    }
    const warn = [...(s.warnings ?? [])];
    if (st !== "verified") warn.push(STEP_WARN[st] ?? STEP_WARN.single);
    steps.push(...splitLong({ title: s.title, instructions: s.instruction, warning: warn.length ? warn.join(" ") : undefined }));
    ledgerMap.set(s.n, { first: start + 1, last: steps.length });
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
            ? `Confirmed from Ford documentation or agreeing sources. Still check your owner's manual or service data before use.${t.conflicts ? ` Note: ${t.conflicts}` : ""}`
            : `Two or more independent sources agree on this figure; no Ford document was available. Confirm against Ford service data before use.${t.conflicts ? ` Note: ${t.conflicts}` : ""}`,
        }
      : {
          fastener: t.fastener,
          value: V_TORQUE,
          // A CONFLICT must not leak either candidate number into the guide (a reader would pick one). Single-source and missing
          // rows keep their reference text; the full conflict detail stays in the evidence ledger.
          notes: st === "conflict"
            ? "Sources conflict on this value, so no figure is shown. Use Ford service data for this fastener."
            : `Reference only, not confirmed${st === "missing" ? " (no figure found)" : " (one source)"}: ${t.value ?? "no value found"}.${t.conflicts ? ` ${t.conflicts}` : ""}`,
        };
  });
  const parts = [
    ...g.parts.map((p) => `${p.item}${p.partNumber ? ` — ${p.partNumber}` : ""}${tagOf(norm(p.status)) ? ` ${tagOf(norm(p.status))}` : ""}`),
    ...g.fluids.map((f) => `Fluid: ${f.item} — ${f.spec}${f.capacity ? `, ${f.capacity}` : ""}${tagOf(norm(f.status)) ? ` ${tagOf(norm(f.status))}` : ""}`),
  ];
  return relinkGuide({
    no: g.guide,
    id: `admin-draft-f150-2015-5-0l-${m.slug}`,
    slug: m.slug,
    title: `${g.name} — 2015 Ford F-150 XLT SuperCrew 4x4 5.0L (DRAFT)`,
    summary:
      `Draft for owner testing: not published and not certified. ${g.primarySourceFound ? "Some facts come from Ford document text (owner's-manual copies or training material); the rest from independent websites." : "Built from independent websites only; no Ford document was found for the key safety facts."} ` +
      `Of the facts behind this guide: ${c.verified} confirmed from Ford documents or agreeing sources, ${c.secondary} confirmed by 2+ independent sources, ${c.single} from a single source, ${c.conflict} where sources disagree, ${c.missing} not found. ` +
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
    leadCount,
    ledger: g.guide,
  }, ledgerMap, m.job);
}

const built = guides.map(buildGuide);
for (const f of LEDGER_TEXT_FIXES) if (!LEDGER_FIXES_USED.has(f)) throw new Error(`LEDGER_TEXT_FIXES for guide ${f.g} matched nothing: table is stale.`);

function ts() {
  const L = [];
  L.push("// GENERATED by scripts/f150-pilot/build-drafts.mjs from docs/f150-pilot/evidence/*.json. DO NOT EDIT BY HAND.");
  L.push("// PILOT DRAFTS for the 2015 Ford F-150 XLT SuperCrew 4x4, 5.0L, 6R80. Not imported by any route, not published, not certified.");
  L.push("// Any torque that is not VERIFIED or VERIFIED_SECONDARY renders the VERIFY warning.");
  L.push('import type { ResolvedGuide } from "@/types/vehicle";');
  L.push("");
  L.push(`export const F150_PILOT_VEHICLE_ID = ${q(VEHICLE_ID)};`);
  L.push("");
  L.push("export const f150PilotDraftGuides: ResolvedGuide[] = [");
  for (const g of built) {
    L.push("  {");
    L.push(`    id: ${q(g.id)},`);
    L.push(`    vehicleId: ${q(VEHICLE_ID)},`);
    L.push(`    jobType: ${q(g.job)},`);
    L.push(`    title: ${q(g.title)},`);
    L.push(`    summary: ${q(g.summary)},`);
    L.push(`    difficulty: ${q(g.difficulty)},`);
    L.push(`    estTime: ${q(g.estTime)},`);
    L.push(`    tier: "free",`);
    L.push(`    preview: true,`);
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
    L.push("  },");
  }
  L.push("];");
  L.push("");
  return L.join("\n");
}

function md() {
  const L = ["# F-150 pilot: evidence summary (generated, do not edit)", "", "Vehicle: 2015 Ford F-150 XLT SuperCrew 4x4, 5.0L Coyote Gen 2, 6R80 (catalog id `2015-ford-f150-5.0l`). Drafts only: unpublished, uncertified.", "",
    "| # | Guide | Tier | Ford document read | verified | secondary | single | conflict | missing | steps built | blocked |", "|---|---|---|---|---|---|---|---|---|---|---|"];
  for (const g of guides) {
    const c = counts(g), b = built.find((x) => x.no === g.guide);
    L.push(`| ${g.guide} | ${g.name} | ${g.evidenceTier} | ${g.primarySourceFound ? "partial" : "no"} | ${c.verified} | ${c.secondary} | ${c.single} | ${c.conflict} | ${c.missing} | ${b.steps.length} | ${b.steps.filter((x) => x.title.startsWith(BLOCK_PREFIX)).length} |`);
  }
  L.push("", "No guide here is certified. Counts are ledger tags: VERIFIED means a Ford document or agreeing sources including one was read, not that the guide is certified.", "");
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

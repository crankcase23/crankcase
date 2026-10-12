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
import { denied } from "./customer-deny.mjs";
import { GUIDE_CONFIG, NEUTRAL_REWRITE, NEUTRAL_DROP, OUT_RE, STEP_OVERRIDES, LEAD_OVERRIDES } from "./config-axes.mjs";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const EVID = path.join(ROOT, "docs/bmw-e90/evidence");
const OUT_TS = path.join(ROOT, "src/data/admin-test-guides/bmw-2010-328i-drafts.ts");
const OUT_CUSTOMER = path.join(ROOT, "src/data/repairs-bmw-e90.ts");
const OUT_MD = path.join(ROOT, "docs/bmw-e90/EVIDENCE-SUMMARY.md");
const OUT_REPORT = path.join(ROOT, "docs/bmw-e90/CUSTOMER-SCRUB-REPORT.md");

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
  { g: 5, re: /^Release the caliper/i, kind: "BLOCKED", reason: "Rear caliper hardware is unresolved: sources disagree on the guide-screw head type, tool size and torque, and the parts catalog and how-to guides describe the carrier fastener differently. No size or torque is shown here on purpose.", instead: "Stop the job here: the pads cannot be changed without this step. Refit the wheel and have a BMW-qualified shop do the rear pads, or use BMW repair data with the verified sizes and torques." },
  { g: 5, re: /^Refit the caliper and torque/i, kind: "BLOCKED", reason: "The caliper fasteners and their torque are not established from a BMW document, so no size or figure is shown.", instead: "If a caliper is already off, do not refit it by feel and do not drive the car: have it taken to a BMW-qualified shop." },
  { g: 11, re: /^Remove the breather hose only if replacing it/i, kind: "BLOCKED", reason: "The breather hose is brittle plastic and its connection at the back of the valve cover can break during removal (a broken connection means a new valve cover). Sources also disagree on its routing and on whether it carries a heater plug, and no BMW removal procedure was found.", instead: "Do not pull, twist or pry the hose. If it looks cracked, oily or loose, stop here and have a BMW-qualified shop replace it." },
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

// ---- cross-references (both copies) ----
// The evidence ledgers refer to their own steps ("go to step 7") and to other guides ("see guide 16") by LEDGER number. The built guide adds
// "Before you start" steps, splits long steps and drops inapplicable ones, so those numbers went stale. Every reference is re-pointed at the
// number the reader actually sees, and a guide number becomes the guide's name. A step reference that cannot be resolved drops its sentence.
const GUIDE_NAME = new Map(guides.map((x) => [x.guide, x.name]));
// Ledger sentences that are wrong once built, fixed before the numbers are re-pointed. Each must match (stale guard below).
const LEDGER_TEXT_FIXES = [
  { g: 2, from: "step 8 records what retailer guides describe and is not recommended", to: "this guide blocks that step (step 8)" },
];
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
  return relinkGuide({
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
    leadCount,
    ledger: g.guide,
  }, ledgerMap, m.job);
}

const built = guides.map(buildGuide);
for (const f of LEDGER_TEXT_FIXES) if (!LEDGER_FIXES_USED.has(f)) throw new Error(`LEDGER_TEXT_FIXES for guide ${f.g} ("${f.from}") matched nothing: table is stale.`);

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


// ---- CUSTOMER output: the same guides, shaped for the public catalog (src/data/repairs.ts spreads this in).
// Differences from the admin drafts, and ONLY these: public ids, no "(DRAFT)" title, an "incomplete guide" summary lead, a
// leading safety warning (plus a blocked-steps warning), house tier convention (oil change free, rest premium) kept so the Get the Keys model still fits, plus preview + wrenchMode flags: preview means readable by everyone, never gated or sold until certified, and the
// owner's own VIN removed from the text (other customers will read it). Steps, torque rows and blocked steps are byte-identical
// to the drafts: nothing is loosened for the public.
const OWN_ID = /WBAPH7C58AA175760|A175760/;
// Sentences in STEP TEXT that state a finding about the owner's own car (its VIN, VIN-tail serial or decode result, "for this VIN") are
// dropped from the public copy, not paraphrased into a claim about every 328i. The rest of the "check your build" text stays.
const dropOwn = (t) => String(t).split(/(?<=[.)])\s+(?=[A-Z])/).filter((x) => !OWN_ID.test(x) && !/\b(for|of|on|to) this VIN\b/.test(x) && !/^[^.]*\bthis VIN\b/.test(x)).join(" ");
// Everywhere else (parts, fluids, torque names, tools, safety) nothing may disappear: only wording changes.
const soft0 = (t) => String(t);
const soft = (t) => String(t).replace(/\bthis VIN\b/g, "this car");

// ---- owner-specific and internal text -> removed or made generic (CUSTOMER copy only; the admin review drafts keep the full research text) ----
// The research ran on one owner's car. Its VIN decode, what the owner said it has and its build month are facts about THAT car, not about the
// next customer's 328i; internal build/research instructions mean nothing to a reader. Rules apply per sentence:
//   REWRITE: the sentence carries a real check or fact, so only the owner-specific part changes ("owner states automatic" -> "check whether yours is an automatic").
//            Nothing is invented: a rewrite turns an assertion about the owner's car into the same check for the reader's car.
//   DROP:    the sentence is only about the owner's decode or internal process.
// Every change is listed in docs/bmw-e90/CUSTOMER-SCRUB-REPORT.md. A rule that matches nothing throws (stale guard), and anything in
// customer-deny.mjs that survives throws too.
const SCRUB_PRE = [/\s*\[Decoded[^\]]*\]/g]; // "[Decoded from the owner's VIN by one free decoder ... Treat as probable.]"
const SCRUB_REWRITE = [
  // --- how a check is confirmed / what the guide assumes
  [/HOW THE USER CONFIRMS:/, "To confirm:"],
  [/Use the halogen H7 \/ fog H8 paths; the xenon D1 path is probably not this car\./, "Check which headlight type your car has: halogen (the H7 and fog H8 paths) or xenon (D1S, a blocked step in this guide)."],
  [/Xenon or adaptive \(not expected\):/, "Xenon or adaptive:"],
  [/PRIMARY \(probable for this car\): standard key, no Comfort Access\./, "PRIMARY: standard key, no Comfort Access."],
  [/Tire size and run-flat status are not coded, so the guide branches on what the user reads from the sidewalls\./, "Tire size and run-flat status vary by car, so the guide branches on what you read from the sidewalls."],
  [/Label stays UNRESOLVED as a name but is not a procedure variable\./, "The engine label is not settled, but it does not change this procedure."],
  [/Do not publish or rely on the idler pulley torque until conflict resolved\./, "Do not rely on any idler pulley torque figure: sources conflict, so none is shown here."],
  // --- drive / transmission: the owner's answers become the reader's checks
  [/Transmission: owner states automatic \(RealOEM decode does not show it\)\./, "Transmission: check whether your car is an automatic or a manual."],
  [/Drive: owner states rear-wheel drive \(PH73 type code\); xDrive not applicable\./, "Drive: check whether your car is rear-wheel drive or xDrive."],
  [/This car is an automatic \(owner-stated\), so if the fan shroud comes out, expect/, "If your car is an automatic and the fan shroud comes out, expect"],
  [/Drive: owner states rear-wheel drive;/, "Drive:"],
  [/Transmission \(owner states automatic\): irrelevant to this job\./, "Transmission: irrelevant to this job."],
  [/Transmission: the owner supplied automatic and the VIN option list shows S205A; the catalog lists/, "Transmission: for an automatic (S205A) the catalog lists"],
  [/Drive: rear-wheel drive \(PH73 type code, NHTSA\/decoder\), so/, "Drive: if your car is rear-wheel drive (not xDrive),"],
  [/; the NHTSA decode and bimmer\.work agree on a 328i \(not xi\)\./, "; check whether your car is rear-wheel drive or xDrive."],
  [/Transmission \(decoded automatic S205A, probable not proven\):/, "Transmission (automatic S205A or manual):"],
  [/; NHTSA's VIN decoder gives displacement 3\.0 L, 6 cyl and no engine model/, ""],
  [/; VIN positions 4-6 \(PH7\) match the catalog type code PH73/, ""],
  [/; this is a 328i \(NHTSA decode and catalog show no front axle\)/, "; this guide is for the rear-wheel-drive 328i"],
  [/No LSD option in the VIN decode, no LSD variant/, "No LSD variant"],
  [/RWD assumed from the unconfirmed VIN decode\./, "This guide assumes rear-wheel drive; check yours."],
  [/The VIN decode and the parts catalog show a rear-wheel-drive 328i\./, "This guide is for the rear-wheel-drive 328i."],
  [/is catalog-level inference from the VIN decode, not proven for the VIN\./, "is a catalog-level inference, not proven."],
  [/This car is an automatic \(S205\), so the part numbers are now catalog-backed, but plug position and orientation on ITS pan are NOT established/, "For an automatic (S205) the part numbers are catalog-backed, but plug position and orientation on its pan are NOT established"],
  // --- build date / option codes of the owner's car -> conditions the reader can check
  [/RealOEM item for this car from 09\/2009/, "RealOEM item for cars built from 09/2009"],
  [/, the style the VIN decode lists/, ""],
  [/Drive and build date \(the VIN decode, bimmer\.work and RealOEM; probable, not proven\): rear-wheel drive \(PH73 type code\), start of production 09\/2009\./, "Drive and build date: check whether your car is rear-wheel drive or xDrive and when it was built; some part numbers below depend on both."],
  [/Consequences used here:/, "Part numbers used here assume a rear-wheel-drive car built in the date range shown:"],
  [/; the VIN decode shows no sport\/M brake option/, ""],
  [/match the parts to this car \(VIN decode, probable not proven: ([^)]*)\)/, "match the parts to your car (these numbers fit: $1; if yours differs, get the right ones by VIN)"],
  [/so this 09\/2009 car is on the newest glove-box layout/, "so a 2010 car is on the newest glove-box layout"],
  [/^This 09\/2009 car is on the newest glove-box layout/, "A 2010 car is on the newest glove-box layout"],
  [/which maker the car has is not decoded and only changes cover part numbers/, "which maker your car has only changes cover part numbers"],
  [/\s*\(the decode shows no M package option\)/, ""],
  [/do not apply to the decoded halogen car/, "do not apply to cars with halogen headlights"],
  [/so a 09\/2009 build might carry the older all-bulb lamp/, "so a car built before 03/2010 might carry the older all-bulb lamp"],
  [/^A 09\/2009 build may carry an older all-bulb lamp/, "A car built before 03/2010 may carry an older all-bulb lamp"],
  [/\s*\(09\/2009 build\)/, ""],
  [/Whether the adapter applies to a 09\/2009 build is unresolved/, "Whether the adapter applies to every build date is unresolved"],
  [/this car is catalogued as N52N \(09\/2009 selection\) and is expected to be the plastic design/, "a later N52 is expected to be the plastic design"],
  [/^Build date: the VIN decode gives start of production 2009-09-07[^.]*\./, "Build date: wiper sets split at 09/2009 (BMW parts catalog, Turner, Bimmerworld and Oximo agree on the 09/2009 split), so a car built before 09/2009 needs the older set 61610427668."],
  [/; not coded on this car per the decode\./, "."],
  // --- battery option codes
  [/VO code B080 \(80 Ah\) \/ A080 \(80 Ah AGM\) naming is from coding forums/, "VO code naming (B080 for 80 Ah, A080 for 80 Ah AGM) is from coding forums"],
  [/are not shown by the decode; they do not change the battery location/, "do not change the battery location"],
  [/\s*\(not decoded\)/, ""],
  [/\s*\(not decoded on this car\), so the grommet is probably not on this car/, ", so the grommet applies only if your car has that option"],
  [/only with S146A \(not expected on this car\)/, "only with S146A"],
  [/If the car is automatic \(probable, see the build checks above\),/, "If the car is automatic,"],
  [/Screw count and head size on THIS car are/, "Screw count and head size on this model are"],
  // --- fluid checks
  [/S217A is not in the VIN option list \(absence is an inference\), so the non-active reservoir is expected\./, "Cars without S217A (active steering) use the non-active reservoir."],
  [/; S502A is not coded on this car per the decode, so the base reservoir is expected and its capacity is not published\./, "; without S502A the base reservoir applies, and its capacity is not published."],
  [/Do not publish it as a BMW specification\./, "Do not treat it as a BMW specification."],
  [/^Do not publish a number\./, "No torque number is confirmed for this step."],
  [/^Do not publish a total capacity figure or a coolant specification code as verified: no BMW document was found for them\./, "No BMW document was found for a total capacity figure or a coolant specification code, so treat any figure here as unverified."],
  [/, so primary:false/, ", so it is not confirmed from a BMW document"],
  [/the bulb they pull out/, "the bulb you pull out"],
  [/Confirm engine code from the engine cover\/underhood label or VIN decode\./, "Confirm the engine code from the engine cover or underhood label."],
  [/ \(RealOEM E90N \/ bimmer\.work N52K vs N52N labels differ\)/, ""],
  [/Engine label unresolved between decoders \(N52K per bimmer\.work, N52N per RealOEM\)\./, "Engine label differs between sources (N52K vs N52N)."],
  [/, which matches the bimmer\.work decode;/, ";"],
  [/\s*No 328i LSD option code was found in the VIN decode\./, ""],
  [/RESOLVED to hydraulic/, "hydraulic"],
  [/RESOLVED for ordering/, "settled for ordering"],
  [/RESOLVED to 'open, probable'/, "probably open"],
  [/^Label unresolved as a name, not a procedure variable\./, "The engine label is not settled, but it does not change this procedure."],
  [/the owner should compare with the oil-cap label or manual/, "compare with the oil-cap label or your manual"],
  // --- wording
  [/tell the user to compare/, "tell you to compare"],
  [/so the user must follow the chart/, "so you must follow the chart"],
  [/\s*\((?:see specs|see the specs)\)/, ""],
];
const SCRUB_DROP = [
  /DECODED CONFIG/, /\bdecod(e|ed|er|ers|es|ing)\b/i,
  /^This car is a sedan per NHTSA/, /^Keep the pan a plain generic mass/, /^Treat as probable/,
];
const SCRUB_USED = new Map();
const DENY_HITS = [];
const used = (rule) => SCRUB_USED.set(rule, (SCRUB_USED.get(rule) ?? 0) + 1);
function scrubText(text, job, field) {
  let t = plain(stripUrls(String(text))); // rules are written against the emitted (plain-language) wording
  for (const re of SCRUB_PRE) { const n = t.replace(re, ""); if (n !== t) used(re); t = n; }
  t = t.replace(/\.\s+\.(?=\s|$)/g, ".").replace(/([^.])\.\.(?=\s|$)/g, "$1.");
  const out = [];
  for (const sent of t.split(SENT_SPLIT)) {
    let s = sent;
    for (const rule of SCRUB_REWRITE) { const n = s.replace(rule[0], rule[1]); if (n !== s) { used(rule); s = n; } }
    if (s !== sent) CHANGES.push({ job, field, kind: "rewritten", before: sent, after: s });
    const drop = SCRUB_DROP.find((re) => re.test(s));
    if (drop) { used(drop); CHANGES.push({ job, field, kind: "removed", before: sent }); continue; }
    out.push(s);
  }
  return out.join(" ").replace(/\.\s+\.(?=\s|$)/g, ".").replace(/([^.])\.\.(?=\s|$)/g, "$1.");
}

// ---- Vehicle Configuration V1: customer copy is built for the researched build (see config-axes.mjs) ----
const NEUTRAL_USED = new Set();
const KIND_RW = "rewritten (resolved by saved configuration)";
const KIND_RM = "removed (resolved by saved configuration)";
const PART_NO = /\b\d{7,}\b/;
/** Rewrites, then removes, wording about builds the guide does not cover. Returns the text and whether an auto-removed sentence carried a part number or a caution marker. */
function neutralize(text, job, field) {
  const out = []; let lost = false;
  for (const sent of String(text).split(SENT_SPLIT)) {
    let s = sent;
    for (const rule of NEUTRAL_REWRITE) { const n = s.replace(rule[0], rule[1]); if (n !== s) { NEUTRAL_USED.add(rule); s = n; } }
    if (s !== sent) CHANGES.push({ job, field, kind: KIND_RW, before: sent, after: s });
    const drop = NEUTRAL_DROP.find((re) => re.test(s));
    if (drop) { NEUTRAL_USED.add(drop); CHANGES.push({ job, field, kind: KIND_RM, before: sent }); continue; }
    if (OUT_RE.test(s)) {
      if (PART_NO.test(s) || /^[⚠⛔]/.test(s)) lost = true;
      CHANGES.push({ job, field, kind: KIND_RM, before: sent });
      continue;
    }
    out.push(s);
  }
  return { text: out.join(" "), lost };
}
function shiftRefs(text, from, delta) {
  if (text == null || !delta) return text;
  const sh = (n) => (Number(n) > from ? Number(n) + delta : Number(n));
  return String(text).replace(STEP_REF, (m, word, a, sep, b) => (b ? `${word} ${sh(a)}${sep}${sh(b)}` : `${word} ${sh(a)}`));
}
function configure(out, g) {
  const job = g.job, num = g.ledger, cfg = GUIDE_CONFIG[num] ?? {};
  const must = (cond, msg) => { if (!cond) throw new Error(`customer guide ${g.slug}: ${msg}`); };
  const clean = (t, field, { row = false } = {}) => {
    const r = neutralize(t, job, field);
    must(!r.lost || (row && !r.text.trim()), `${field}: removing out-of-build wording would lose a part number or caution (${String(t).slice(0, 120)}). Add a NEUTRAL_REWRITE rule that keeps it.`);
    return r.text;
  };
  // 1. wholesale replacements of research-note steps
  const used = new Set();
  let steps = out.steps.map((x, i) => {
    const ov = STEP_OVERRIDES.find((o) => o.g === num && o.title === x.title);
    if (!ov) return x;
    must(ov.must.test(x.instructions), `STEP_OVERRIDES for "${ov.title}" no longer matches the ledger text`);
    used.add(ov);
    CHANGES.push({ job, field: `step ${i + 1}`, kind: "rewritten (customer wording)", before: x.instructions, after: ov.instructions });
    return { ...x, instructions: ov.instructions };
  });
  for (const o of STEP_OVERRIDES.filter((o) => o.g === num)) must(used.has(o), `STEP_OVERRIDES "${o.title}" matched no step`);

  // 2. the "Before you start" checks: keep what is still a real check, regroup, drop the "your build is unconfirmed" framing
  const oldLead = g.leadCount;
  const procedure = steps.slice(oldLead);
  // The research notes behind the build checks stay in the ledger. The customer gets a short, practical check written from them.
  const leadOv = LEAD_OVERRIDES[num];
  must(Boolean(leadOv) === (oldLead > 0), `LEAD_OVERRIDES must exist exactly for guides that have build checks (guide ${num})`);
  let lead = [];
  if (leadOv) {
    const src = steps.slice(0, oldLead).map((x) => x.instructions).join(" ");
    must(leadOv.must.test(src), `LEAD_OVERRIDES ${num} no longer matches the ledger's build notes`);
    const sents = leadOv.text.split(SENT_SPLIT);
    const groups = [[]]; let len = 0;
    for (const it of sents) { if (groups[groups.length - 1].length && len + it.length > 780) { groups.push([]); len = 0; } groups[groups.length - 1].push(it); len += it.length; }
    CHANGES.push({ job, field: "before you start", kind: "rewritten (customer wording)", before: src, after: leadOv.text });
    lead = groups.map((gr, i) => ({
      title: groups.length === 1 ? "Before you start: check your car" : `Before you start: check your car (${i + 1} of ${groups.length})`,
      instructions: gr.join(" "),
      ...(i === 0 ? { warning: "⚠ Check each item against your car before buying parts." } : {}),
    }));
  }
  const delta = lead.length - oldLead;

  // 3. every other field
  const ruleUsed = new Set();
  const useRule = (rules, text) => { const r = rules?.find((x) => x.re.test(text)); if (r) ruleUsed.add(r); return r?.forConfig; };
  const procSteps = procedure.map((x, i) => {
    const blocked = x.title.startsWith(BLOCK_PREFIX);
    let instr = x.instructions, warn = x.warning;
    if (!blocked) {
      instr = clean(x.instructions, `step ${oldLead + i + 1}`);
      must(instr.trim(), `step "${x.title}" became empty after removing out-of-build wording`);
      if (warn) { warn = clean(warn, `step ${oldLead + i + 1} warning`); }
    }
    const fc = blocked ? undefined : (cfg.allSteps ?? useRule(cfg.steps, x.title));
    return { ...x, instructions: shiftRefs(instr, oldLead, delta), ...(warn ? { warning: shiftRefs(warn, oldLead, delta) } : {}), ...(fc ? { forConfig: fc } : {}) };
  });
  const rows = (list, textOf, rules, all, field) => {
    const keep = [];
    list.forEach((it, i) => {
      const t = clean(textOf(it), `${field} ${i + 1}`, { row: true });
      if (!t.trim()) { CHANGES.push({ job, field: `${field} ${i + 1}`, kind: "row removed (belongs to a build this guide does not cover)", before: textOf(it) }); return; }
      keep.push({ it, t, fc: all ?? useRule(rules, t) });
    });
    return keep;
  };
  const partRows = rows(out.parts, (x) => x, cfg.parts, cfg.allParts, "part");
  const toolRows = rows(out.tools, (x) => x.name, cfg.tools, undefined, "tool");
  const torqueRows = out.torque.map((x, i) => {
    const f = clean(x.fastener, `torque ${i + 1}`, { row: true });
    if (!f.trim()) { CHANGES.push({ job, field: `torque ${i + 1}`, kind: "row removed (belongs to a build this guide does not cover)", before: x.fastener }); return null; }
    const n = clean(x.notes, `torque ${i + 1} notes`);
    must(n.trim(), `torque "${f}" notes became empty`);
    const fc = cfg.allTorque ?? useRule(cfg.torque, f);
    return { ...x, fastener: f, notes: n, ...(fc ? { forConfig: fc } : {}) };
  }).filter(Boolean);
  const summary = clean(out.summary, "summary"), safety = out.safety.map((x, i) => clean(x, `safety ${i + 1}`)).filter((x) => x.trim());
  must(summary.trim() && safety.length, "summary or safety went empty");
  for (const k of ["parts", "tools", "torque", "steps"]) for (const r of cfg[k] ?? []) must(ruleUsed.has(r), `GUIDE_CONFIG ${num}.${k} rule ${r.re} matched nothing: table is stale`);

  const configParts = partRows.filter((r) => r.fc).map((r) => ({ text: shiftRefs(r.t, oldLead, delta), forConfig: r.fc }));
  return {
    ...out,
    summary: shiftRefs(summary, oldLead, delta),
    safety: safety.map((x) => shiftRefs(x, oldLead, delta)),
    tools: toolRows.map((r) => ({ ...r.it, name: shiftRefs(r.t, oldLead, delta), ...(r.fc ? { forConfig: r.fc } : {}) })),
    parts: partRows.filter((r) => !r.fc).map((r) => shiftRefs(r.t, oldLead, delta)),
    configParts,
    torque: torqueRows.map((x) => ({ ...x, notes: shiftRefs(x.notes, oldLead, delta) })),
    steps: [...lead, ...procSteps],
    evidenceFor: cfg.evidenceFor,
    evidenceNote: cfg.evidenceNote,
    leadCount: lead.length,
  };
}

const CUSTOMER_LEAD = "Incomplete guide: not yet verified against BMW service data. The build checks below were researched on one 2010 328i sedan, so check your own car.";
function customerGuide(g) {
  const blocked = g.steps.filter((x) => x.title.startsWith(BLOCK_PREFIX)).length;
  const safety = [
    "⚠ This guide is not yet verified against BMW repair data. Anything marked ⚠ must be confirmed with your owner's manual or BMW service data before you rely on it.",
    ...(blocked ? [`⛔ ${blocked} step${blocked > 1 ? "s are" : " is"} BLOCKED in this guide. Do not do a blocked step from this guide: have a BMW-qualified shop do it.`] : []),
    ...g.safety,
  ];
  const base = {
    ...g,
    id: `bmw-2010-328i-${g.slug}`,
    title: g.title.replace(" (DRAFT)", ""),
    summary: soft(g.summary.replace(/^Draft for owner testing: not published and not certified\./, CUSTOMER_LEAD)),
    tier: g.job === "oil-change" ? "free" : "premium", // the tier it will have once certified (Get the Keys model); `preview: true` below is what keeps it unsold meanwhile
    safety: safety.map(soft),
    tools: g.tools.map((t) => ({ ...t, name: soft(t.name) })),
    parts: g.parts.map(soft),
    torque: g.torque.map((t) => ({ ...t, fastener: soft(t.fastener), notes: soft(t.notes) })),
    steps: g.steps.map((x) => ({ ...x, instructions: dropOwn(soft0(x.instructions)), ...(x.warning ? { warning: soft(x.warning) } : {}) })),
  };
  const j = g.job, sc = (t, f) => scrubText(t, j, f);
  const out = {
    ...base,
    summary: sc(base.summary, "summary"),
    safety: base.safety.map((x, i) => sc(x, `safety ${i + 1}`)),
    tools: base.tools.map((t, i) => ({ ...t, name: sc(t.name, `tool ${i + 1}`) })),
    parts: base.parts.map((p, i) => sc(p, `part ${i + 1}`)),
    torque: base.torque.map((t, i) => ({ ...t, fastener: sc(t.fastener, `torque ${i + 1}`), notes: sc(t.notes, `torque ${i + 1} notes`) })),
    steps: base.steps.map((x, i) => ({ ...x, instructions: sc(x.instructions, `step ${i + 1}`), ...(x.warning ? { warning: sc(x.warning, `step ${i + 1} warning`) } : {}) })),
  };
  const cfgd = configure(out, g);
  const blank = [cfgd.summary, ...cfgd.safety, ...cfgd.tools.map((t) => t.name), ...cfgd.parts, ...cfgd.configParts.map((p) => p.text), ...cfgd.torque.map((t) => t.fastener), ...cfgd.torque.map((t) => t.notes), ...cfgd.steps.map((x) => x.instructions)].some((x) => !String(x).trim());
  const proc = (arr, lead) => arr.slice(lead);
  if (blank || JSON.stringify(proc(cfgd.steps, cfgd.leadCount).map((x) => x.title)) !== JSON.stringify(proc(g.steps, g.leadCount).map((x) => x.title))) throw new Error(`customer guide ${g.slug}: cleaning lost content (a field went empty or a procedure step vanished)`);
  Object.assign(out, cfgd);
  const all = JSON.stringify(out);
  if (OWN_ID.test(all) || /\b[A-HJ-NPR-Z0-9]{17}\b/.test(all)) throw new Error(`customer guide ${g.slug} still contains a VIN`);
  const fields = [["summary", out.summary], ...out.safety.map((x, i) => [`safety ${i + 1}`, x]), ...out.tools.map((t, i) => [`tool ${i + 1}`, t.name]), ...out.parts.map((x, i) => [`part ${i + 1}`, x]), ...out.configParts.map((x, i) => [`config part ${i + 1}`, x.text]), ...out.torque.flatMap((t, i) => [[`torque ${i + 1}`, t.fastener], [`torque ${i + 1} notes`, t.notes]]), ...out.steps.flatMap((x, i) => [[`step ${i + 1} (${x.title})`, x.instructions], [`step ${i + 1} warning`, x.warning ?? ""]])];
  for (const [f, text] of fields) { const hit = denied(plain(stripUrls(text))); if (hit.length) DENY_HITS.push(`customer guide ${g.slug} ${f} still has ${hit.map((h) => `${h.rule}: "${h.match}" in: ${String(text).slice(0, 200)}`).join("; ")}`); }
  return out;
}
function customerTs() {
  const L = [];
  L.push("// GENERATED by scripts/bmw/build-drafts.mjs from docs/bmw-e90/evidence/*.json. DO NOT EDIT BY HAND.");
  L.push("// PUBLIC catalog guides for the 2010 BMW 328i (E90). INCOMPLETE and NOT certified by a BMW document or a mechanic: every guide says so,");
  L.push("// blocked steps stay blocked, and any torque that is not VERIFIED/VERIFIED_SECONDARY shows the VERIFY warning instead of a number.");
  L.push("// The admin-only review drafts are built from the same evidence by the same script.");
  L.push('import type { RepairGuide } from "@/types/vehicle";');
  L.push("");
  L.push('const VEHICLE_ID = "2010-bmw-328i-3.0l";');
  L.push("");
  L.push("export const bmwE90Guides: RepairGuide[] = [");
  for (const raw of built) {
    const g = customerGuide(raw);
    L.push("  {");
    L.push(`    id: ${q(g.id)},`);
    L.push("    vehicleId: VEHICLE_ID,");
    L.push(`    jobType: ${q(g.job)},`);
    L.push(`    title: ${q(g.title)},`);
    L.push(`    summary: ${q(g.summary)},`);
    L.push(`    difficulty: ${q(g.difficulty)},`);
    L.push(`    estTime: ${q(g.estTime)},`);
    L.push(`    tier: ${q(g.tier)},`);
    L.push("    preview: true,");
    L.push("    wrenchMode: true,");
    if (g.noFasteners) L.push("    noFasteners: true,");
    const fcs = (fc) => `, forConfig: ${JSON.stringify(fc)}`;
    if (g.evidenceFor) { L.push(`    evidenceFor: ${JSON.stringify(g.evidenceFor)},`); L.push(`    evidenceNote: ${q(g.evidenceNote)},`); }
    L.push("    tools: [" + g.tools.map((t) => `{ name: ${q(t.name)}${t.note ? `, note: ${q(t.note)}` : ""}${t.forConfig ? fcs(t.forConfig) : ""} }`).join(", ") + "],");
    L.push("    parts: [" + g.parts.map(q).join(", ") + "],");
    if (g.configParts.length) L.push("    configParts: [" + g.configParts.map((p) => `{ text: ${q(p.text)}${fcs(p.forConfig)} }`).join(", ") + "],");
    L.push("    safety: [" + g.safety.map(q).join(", ") + "],");
    L.push("    torqueSpecs: [" + g.torque.map((t) => `{ fastener: ${q(t.fastener)}, value: ${q(t.value)}, notes: ${q(t.notes)}${t.forConfig ? fcs(t.forConfig) : ""} }`).join(", ") + "],");
    L.push("    steps: [");
    g.steps.forEach((s, i) => L.push(`      { number: ${i + 1}, title: ${q(s.title)}, instructions: ${q(s.instructions)}${s.warning ? `, warning: ${q(s.warning)}` : ""}${s.forConfig ? fcs(s.forConfig) : ""} },`));
    L.push("    ],");
    L.push("  },");
  }
  L.push("];");
  L.push("");
  if (DENY_HITS.length) throw new Error(`customer copy still has owner-specific or internal text:\n${DENY_HITS.join("\n")}`);
  const staleRules = [...SCRUB_PRE, ...SCRUB_REWRITE, ...SCRUB_DROP].filter((r) => !SCRUB_USED.has(r));
  const staleCfg = [...NEUTRAL_REWRITE, ...NEUTRAL_DROP].filter((r) => !NEUTRAL_USED.has(r));
  if (staleCfg.length) throw new Error(`configuration rules matched nothing (table is stale):\n${staleCfg.map((r) => String(Array.isArray(r) ? r[0] : r)).join("\n")}`);
  if (staleRules.length) throw new Error(`customer scrub rules matched nothing (table is stale):\n${staleRules.map((r) => String(Array.isArray(r) ? r[0] : r)).join("\n")}`);
  for (const rule of []) if (!SCRUB_USED.has(rule)) throw new Error(`customer scrub rule ${String(Array.isArray(rule) ? rule[0] : rule)} matched nothing: table is stale. Remove it or update it to the new ledger text.`);
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



function reportMd() {
  const L = ["# Customer copy: what the build removed, rewrote or re-pointed", "",
    "GENERATED by `scripts/bmw/build-drafts.mjs`. Do not edit by hand.", "",
    "The research was done on one owner's car. This file lists every sentence the build changed so a reviewer can check that nothing verified and broadly useful was lost.",
    "- **removed**: only about the owner's VIN decode or internal process (customer copy only).",
    "- **rewritten**: an assertion about the owner's car became the same check for the reader's car (customer copy only). No fact was added.",
    "- **step number re-pointed / dropped**: the ledger's own step and guide numbers were stale once \"Before you start\" steps were added (both copies).", ""];
  const kinds = ["removed", "rewritten", "step number re-pointed"];
  const order = (k) => { const i = kinds.indexOf(k); return i < 0 ? kinds.length : i; };
  const tally = {}; for (const c of CHANGES) tally[c.kind] = (tally[c.kind] ?? 0) + 1;
  L.push("Totals: " + Object.entries(tally).map(([k, v]) => `${v} ${k}`).join(", "), "");
  const jobs = [...new Set(CHANGES.map((c) => c.job))];
  for (const job of jobs) {
    L.push(`## ${job}`, "");
    for (const c of CHANGES.filter((x) => x.job === job).sort((a, b) => order(a.kind) - order(b.kind))) {
      L.push(`- **${c.kind}** (${c.field}): ${JSON.stringify(c.before)}${c.after !== undefined ? `\n  - now: ${JSON.stringify(c.after)}` : ""}`);
    }
    L.push("");
  }
  return L.join("\n");
}
const outputs = [[OUT_TS, ts()], [OUT_CUSTOMER, customerTs()], [OUT_REPORT, reportMd()], [OUT_MD, md()]];
if (process.argv.includes("--check")) {
  let stale = 0;
  for (const [p, content] of outputs) {
    if (!fs.existsSync(p) || fs.readFileSync(p, "utf8") !== content) { console.error("STALE: " + path.relative(ROOT, p)); stale++; }
  }
  process.exit(stale ? 1 : 0);
}
for (const [p, content] of outputs) fs.writeFileSync(p, content);
console.log(`wrote ${built.length} draft guides, ${built.reduce((n, g) => n + g.steps.length, 0)} steps, ${built.reduce((n, g) => n + g.torque.length, 0)} torque rows`);

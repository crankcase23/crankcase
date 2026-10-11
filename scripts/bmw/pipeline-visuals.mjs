#!/usr/bin/env node
// BMW 328i (E90): EVERY proposed instructional visual, from every guide's evidence ledger, driven through the (reconstructed)
// Guide Factory as far as the evidence and the missing generator allow. Replaces the oil-change-only pipeline test.
//
//   node scripts/bmw/pipeline-visuals.mjs [--out DIR]     (default: docs/bmw-e90/image-evidence/output)
//
// What it does per visual (docs/bmw-e90/evidence/guide-NN.json -> visuals[]):
//   1. builds an Evidence Packet from the cited sources. A fact is 'established' by the EVIDENCE RULE below, else it is
//      'not-established' and the picture must omit/simplify it. Nothing is invented: a cited URL must be catalogued in the visual's `sources`.
//   2. renders the generation prompt (Step-10 handoff format) from the structured visual: no free-hand prompt text.
//   3. runs spec intake, EP sufficiency (objective gate), VC compile/lock, generation request.
//   4. stops at generation: no generator is connected (spend needs owner approval). Nothing is certified, no image exists.
// The per-visual result includes the exact evidence deficits, which is the work list for closing the gap.
//
// EVIDENCE RULE (documented, tested):
//   * critical elements:                      >= 2 distinct hosts.
//   * procedure / identification / cosmetic:  >= 2 distinct hosts, OR >= 1 primary-kind source (oem-text, oem-figure, parts-catalog).
//   * a user-supplied-photo of this car counts as primary for every criticality except critical, where it still needs one more host.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const FACT = path.join(ROOT, "scripts/visuals/factory-reconstructed");
const EVID = path.join(ROOT, "docs/bmw-e90/evidence");
const DEFAULT_OUT = path.join(ROOT, "docs/bmw-e90/image-evidence/output");
const { FactoryRun } = await import(path.join(FACT, "src/machine.mjs"));
const { parseVisualSpecPrompt } = await import(path.join(FACT, "src/spec-intake.mjs"));
const { FileDropGenerator, ActorUnavailable } = await import(path.join(FACT, "src/actors.mjs"));
const { verifyRun } = await import(path.join(FACT, "src/verify.mjs"));
const { Refused } = await import(path.join(FACT, "src/store.mjs"));
const { stable } = await import(path.join(FACT, "src/canon.mjs"));
const { STANDARD, TYPES, framingLine, CLEAR_SPACE_LINE, overlaySpec, referenceSha256 } = await import(path.join(ROOT, "scripts/bmw/visual-standard.mjs"));

export const APPLICATION = { year: 2010, make: "BMW", model: "328i", trim: "Sedan (E90)", engine: "3.0L inline-6 (engine code not confirmed)" };
export const VEHICLE_SLUG = "bmw-2010-328i";
const PRIMARY_KINDS = new Set(["oem-text", "oem-figure", "parts-catalog"]);
const host = (u) => new URL(u).hostname.replace(/^www\./, "");

// guide number -> draft slug (same table as build-drafts.mjs META; checked by a test)
export const GUIDE_SLUG = { 1: "front-brake-pads", 2: "fuse-bulb", 3: "key-fob-battery", 4: "oxygen-sensor", 5: "rear-brake-pads", 6: "serpentine-belt", 7: "battery", 8: "coolant", 9: "fluid-checks", 10: "cabin-air-filter", 11: "pcv-valve", 12: "engine-air-filter", 13: "tire-rotation", 14: "wiper-blades", 15: "differential-fluid", 16: "oil-change" };
export const guideIdOf = (no) => `admin-draft-bmw-2010-328i-${GUIDE_SLUG[no]}`;

const VIEWPOINTS = {
  "wheel-well": "View into the wheel well with the wheel removed, from the side at hub height, mild perspective.",
  footwell: "Low view into the driver-side footwell and lower dash, looking up and forward, mild perspective.",
  "engine-bay-top": "High three-quarter view looking down into the open engine bay from the front, mild perspective.",
  "key-fob": "Close top-down view of a key fob on a plain neutral surface.",
  underside: "Low view from beneath the front of the car looking rearward, mild perspective.",
  trunk: "View into the open trunk from behind and slightly above, mild perspective.",
  "exterior-front": "Front three-quarter view of the front end of the car, mild perspective.",
  dashboard: "Driver's-eye view of the instrument cluster and steering column area, mild perspective.",
  "part-end-on": "End-on view straight along the axis of the part, on a small patch of plain simplified surface; no ground, horizon or body edges visible.",
};
const ATTR_PHRASE = {
  existence: "whether it is present", location: "its exact position", orientation: "its orientation", relationship: "how it relates to neighbouring parts",
  "hardware-type": "its hardware type", action: "how it is operated", "fine-detail-geometry": "its fine detail", "release-mechanism-geometry": "the shape of its release mechanism",
  "fastener-position": "where its fasteners sit", "fastener-head-type": "its fastener head shape",
};
const human = (id) => id.replace(/-/g, " ");
const oneLine = (s) => String(s).replace(/\s+/g, " ").trim();
const noComma = (s) => oneLine(s).replace(/,/g, ";").replace(/\.+$/, "");

export function loadVisuals() {
  const out = [];
  for (const f of fs.readdirSync(EVID).filter((x) => /^guide-\d\d\.json$/.test(x)).sort()) {
    const g = JSON.parse(fs.readFileSync(path.join(EVID, f), "utf8"));
    for (const v of g.visuals ?? []) out.push({ ...v, guideNo: g.guide, guideName: g.name, guideTier: g.evidenceTier, guide: g });
  }
  return out;
}

/** The evidence rule. Returns {ok, hosts, primary, need}. */
export function establishes(urls, sources, criticality) {
  const hosts = new Set(urls.map(host));
  const kinds = urls.map((u) => sources[u]?.kind);
  const primary = kinds.some((k) => PRIMARY_KINDS.has(k));
  const ownPhoto = kinds.includes("user-supplied-photo");
  let ok = hosts.size >= 2;
  if (!ok && criticality !== "critical" && (primary || ownPhoto)) ok = true;
  const need = criticality === "critical" ? "2+ distinct hosts" : "2+ distinct hosts, or 1 BMW-document/parts-catalog/own-photo source";
  return { ok, hosts: hosts.size, primary: primary || ownPhoto, need };
}

/** Evidence Packet + the derived exclusions/ledger. Throws on an uncatalogued URL. */
export function buildEP(v) {
  const refIds = new Map();
  const refs = [];
  const refFor = (url) => {
    if (!v.sources[url]) throw new Error(`unknown source cited (not catalogued in visual ${v.id}.sources): ${url}`);
    if (!refIds.has(url)) {
      const k = v.sources[url];
      const id = `ref-${refIds.size + 1}`;
      refIds.set(url, id);
      refs.push({ id, kind: k.kind, source: host(url), sourceRef: url, usage: "reference-only", establishes: [k.establishes], rights: "Text consulted for facts only; no pixels or images from this source are used." });
    }
    return refIds.get(url);
  };
  const critOf = new Map(v.elements.map((e) => [e.id, e.criticality]));
  const ledger = [];
  const deficits = [];
  const seen = new Set();
  const established = new Set();
  for (const f of v.facts) for (const u of f.urls ?? []) if (!v.sources[u]) throw new Error(`unknown source cited (not catalogued in visual ${v.id}.sources): ${u}`);
  for (const f of v.facts) {
    const row = establishes(f.urls ?? [], v.sources, critOf.get(f.element));
    const key = `${f.element}/${f.attribute}`;
    if (seen.has(key)) throw new Error(`duplicate fact ${key} in visual ${v.id}`);
    seen.add(key);
    if (row.ok) {
      ledger.push({ element: f.element, attribute: f.attribute, status: "established", evidence: f.urls.map(refFor), render: "draw", note: `${row.hosts} independent host(s)${row.primary ? ", includes a BMW-document/catalog source" : ""}` });
      established.add(key);
    } else {
      ledger.push({ element: f.element, attribute: f.attribute, status: "not-established", render: "omit", note: f.note ?? `only ${row.hosts} host(s); rule: ${row.need}` });
      if (f.attribute === "existence" || f.attribute === "location") deficits.push({ element: f.element, attribute: f.attribute, role: v.elements.find((e) => e.id === f.element)?.role, criticality: critOf.get(f.element), haveHosts: row.hosts, need: row.need, urlsHave: f.urls ?? [] });
    }
  }
  const elements = v.elements.map((e) => ({ id: e.id, role: e.role, criticality: e.criticality, describe: oneLine(e.describe) }));
  const extraExcl = [];
  for (const e of v.elements) {
    for (const attribute of ["existence", "location"]) {
      const key = `${e.id}/${attribute}`;
      if (seen.has(key)) continue;
      const hero = e.role !== "context";
      if (hero) {
        ledger.push({ element: e.id, attribute, status: "not-established", render: "omit", note: "no source cited for this fact" });
        deficits.push({ element: e.id, attribute, role: e.role, criticality: e.criticality, haveHosts: 0, need: establishes([], {}, e.criticality).need, urlsHave: [] });
      } else if (attribute === "existence") {
        // context element with no fact row at all
        const excluded = v.mustNotDepict.some((m) => m.element === e.id);
        ledger.push({ element: e.id, attribute, status: "not-established", render: excluded || e.criticality !== "cosmetic" ? "omit" : "simplify", note: excluded ? "excluded by the visual's mustNotDepict" : e.criticality === "cosmetic" ? "cosmetic context drawn as a plain generic shape; no specific claim" : "no source cited; left out" });
      }
    }
  }
  // context elements with an existence row that is not established: cosmetic may be simplified, others must be omitted
  for (const row of ledger) {
    const e = v.elements.find((x) => x.id === row.element);
    if (e?.role === "context" && row.attribute === "existence" && row.status === "not-established" && e.criticality === "cosmetic" && !v.mustNotDepict.some((m) => m.element === e.id) && row.render === "omit") row.render = "simplify";
  }
  // Exclusions. An exclusion on an element that IS drawn (hero/target, or established) is an exclusion of its unestablished DETAIL:
  // it becomes a separate context element so the QA contract never asks the reviewer to both show and not show the same thing.
  const mustNotDepict = [];
  const existenceOf = (id) => ledger.find((r) => r.element === id && r.attribute === "existence");
  const grouped = [...v.mustNotDepict.reduce((acc, m) => acc.set(m.element, { element: m.element, reason: acc.has(m.element) ? `${acc.get(m.element).reason} ${m.reason}` : m.reason }), new Map()).values()];
  for (const m of grouped) {
    const el = v.elements.find((e) => e.id === m.element);
    const drawn = el && (el.role !== "context" || existenceOf(el.id)?.status === "established");
    if (drawn) {
      const did = `${m.element}-unestablished-detail`;
      if (!elements.some((e) => e.id === did)) {
        elements.push({ id: did, role: "context", criticality: "procedure", describe: `Unestablished detail of ${human(m.element)}: ${oneLine(m.reason)}` });
        ledger.push({ element: did, attribute: "existence", status: "not-established", render: "omit", note: oneLine(m.reason) });
        extraExcl.push({ id: did, element: m.element, reason: m.reason });
      }
      mustNotDepict.push({ id: `excl-${did}`, element: did, reason: m.reason, trace: { element: did, attribute: "existence" }, of: m.element });
    } else {
      if (!existenceOf(m.element) || existenceOf(m.element).render === "draw") throw new Error(`visual ${v.id}: exclusion ${m.element} has no omit row`);
      ledger.find((r) => r.element === m.element && r.attribute === "existence").render = "omit";
      mustNotDepict.push({ id: `excl-${m.element}`, element: m.element, reason: m.reason, trace: { element: m.element, attribute: "existence" }, of: m.element });
    }
  }
  // context elements that are not established, not cosmetic-simplified and not yet excluded still must not appear
  for (const e of v.elements) {
    if (e.role !== "context") continue;
    const r = existenceOf(e.id);
    if (r?.status === "not-established" && r.render === "omit" && !mustNotDepict.some((m) => m.element === e.id)) {
      mustNotDepict.push({ id: `excl-${e.id}`, element: e.id, reason: "No source establishes this element for the car; it is left out.", trace: { element: e.id, attribute: "existence" }, of: e.id });
    }
  }
  const guide = v.guide;
  const stepTitles = v.evidenceSteps.map((n) => guide.steps.find((s) => s.n === n)?.title).filter(Boolean);
  return {
    ep: {
      canonicalStep: { stepNumber: v.evidenceSteps[0], title: `${v.id} (BMW 328i draft ${guide.name} guide; evidence step ${v.evidenceSteps.join(", ")})`, actions: stepTitles.length ? stepTitles : [v.title] },
      references: refs,
      elements,
      ledger,
      mustNotDepict: mustNotDepict.map((m) => ({ id: m.id, element: m.element, reason: m.reason, trace: m.trace })),
      sufficiencyProposal: { proposedBy: "claude-research", basis: "Built from cited sources only; each established fact meets the documented evidence rule." },
    },
    deficits,
    exclusions: mustNotDepict,
  };
}

/** Deterministic Step-10-format prompt rendered from the structured visual (no free-hand text). */
export function buildPrompt(v, built = buildEP(v)) {
  if (!VIEWPOINTS[v.viewpoint]) throw new Error(`visual ${v.id}: unknown viewpoint ${v.viewpoint}`);
  if (!TYPES[v.imageType]) throw new Error(`visual ${v.id}: imageType must be LOCATE, IDENTIFY or DO (got ${v.imageType})`);
  const { ep } = built;
  const stepTitle = ep.canonicalStep.actions[0];
  const hero = v.elements.filter((e) => e.role === "hero");
  const target = v.elements.filter((e) => e.role === "target");
  const ranked = [...hero, ...target];
  const lines = [];
  lines.push("Create ONE clean, polished, instructional illustration for a DIY car-repair guide. Text-only prompt: do not use, request or trace any reference image.");
  lines.push("");
  lines.push(`SUBJECT: ${oneLine(v.title)}, on a 2010 BMW 328i (E90) with the 3.0L inline-6, shown so a home mechanic can see what the step is about. Step: "${oneLine(stepTitle)}".`);
  lines.push("");
  lines.push(`FRAMING: ${framingLine(v.imageType, VIEWPOINTS[v.viewpoint])}`);
  lines.push("");
  lines.push("MUST SHOW (clearly, in this order of importance):");
  ranked.forEach((e, i) => {
    const unknown = ep.ledger.filter((r) => r.element === e.id && r.status === "not-established" && r.attribute !== "existence" && r.attribute !== "location").map((r) => ATTR_PHRASE[r.attribute] ?? r.attribute);
    const tail = unknown.length ? ` Do NOT depict ${[...new Set(unknown)].join(", ")}: keep it a plain generic shape.` : "";
    lines.push(`${i + 1}. ${e.role === "hero" ? "HERO: " : ""}${oneLine(e.describe)}${tail}`);
  });
  const may = v.elements.filter((e) => {
    if (e.role !== "context") return false;
    const r = ep.ledger.find((x) => x.element === e.id && x.attribute === "existence");
    return r && r.render !== "omit";
  }).map((e) => human(e.id));
  lines.push("");
  lines.push(`MAY SHOW, SIMPLIFIED AND DIM (background only): ${may.length ? may.join(", ") : "a plain light neutral ground plane"}. Keep every one of these generic and low-contrast. Never invent detail on them.`);
  const mustNot = [...built.exclusions.map((m) => `${human(m.of)}${m.of === m.element ? "" : " detail"} (${noComma(m.reason)})`), ...(TYPES[v.imageType].tools ? [] : ["wrench or socket"]), "hands", "people", "engine badges", "logos", "brand marks", "licence plates"];
  lines.push("");
  lines.push(`MUST NOT SHOW (leave these out entirely, do not substitute): ${mustNot.join(", ")}.`);
  lines.push("");
  lines.push("NO TEXT of any kind: no labels, letters, numbers, markings on tools, arrows, callout lines, highlight outlines, banners, watermarks or captions anywhere in the image.");
  lines.push("");
  lines.push(CLEAR_SPACE_LINE);
  lines.push("");
  lines.push("Do not add any part not listed above. If unsure how a real part looks, draw a plain generic shape or leave it out.");
  return lines.join("\n") + "\n";
}

/**
 * COMPACT GENERATION PROMPT (owner-approved 2026-10-11). The full contract, evidence ledger and the long spec prompt stay internal
 * (buildPrompt -> spec-prompt.full.txt, parsed into the locked contract). What is SENT to the generator is this short text, derived from
 * the same locked contract: hero and target descriptions, every "do not depict" for facts the ledger does not establish, the
 * orientation rule, listed tools only, every exclusion, the CG-VS-1.0 look, the 8% margin and the clear space. It is stored as
 * generation-prompt.txt, hashed by the factory, shown in the QA packet, and the claims file must carry its sha256.
 * It deliberately avoids phrases that made ChatGPT's image tool misread a request as an edit ("reference image", "Text-only prompt").
 */
export function buildCompactPrompt(v, built = buildEP(v)) {
  if (!VIEWPOINTS[v.viewpoint]) throw new Error(`visual ${v.id}: unknown viewpoint ${v.viewpoint}`);
  if (!TYPES[v.imageType]) throw new Error(`visual ${v.id}: imageType must be LOCATE, IDENTIFY or DO (got ${v.imageType})`);
  const { ep } = built;
  const stepTitle = ep.canonicalStep.actions[0];
  const ranked = [...v.elements.filter((e) => e.role === "hero"), ...v.elements.filter((e) => e.role === "target")];
  const typeLine = { LOCATE: "Wide enough to find the part: the hero about 15-30% of the frame width, surroundings plain and simplified.", IDENTIFY: "Tight close-up: the hero fills about 40-60% of the frame. The hero and only a small patch of the surface it sits in form one isolated object floating on the plain light background; the patch ends well inside the frame and never reaches the left, right or bottom edge.", DO: "Tight close-up of the hero with the listed tool in working position; no hands." }[v.imageType];
  const notEstablishedOrientation = ranked.some((e) => ep.ledger.some((r) => r.element === e.id && r.attribute === "orientation" && r.status === "not-established"));
  const show = ranked.map((e) => {
    const unknown = ep.ledger.filter((r) => r.element === e.id && r.status === "not-established" && r.attribute !== "existence" && r.attribute !== "location").map((r) => ATTR_PHRASE[r.attribute] ?? r.attribute);
    const tail = unknown.length ? ` Do NOT depict ${[...new Set(unknown)].join(", ")}: keep it a plain generic shape.` : "";
    return `${e.role === "hero" ? "HERO: " : ""}${oneLine(e.describe).replace(/\.+$/, "")}.${tail}`;
  });
  const may = v.elements.filter((e) => { if (e.role !== "context") return false; const r = ep.ledger.find((x) => x.element === e.id && x.attribute === "existence"); return r && r.render !== "omit"; }).map((e) => human(e.id));
  const mustNot = [...built.exclusions.map((m) => `${human(m.of)}${m.of === m.element ? "" : " detail"}`), ...(TYPES[v.imageType].tools ? [] : ["wrench or socket"]), "hands", "people", "engine badges", "logos", "brand marks", "licence plates"];
  const lines = [
    `Generate a landscape 16:10 illustration (1600x1000 px or larger) for a DIY car-repair guide. ${oneLine(v.title)}, on a 2010 BMW 328i (E90), 3.0L inline-6. Step: "${oneLine(stepTitle)}".`,
    `Look: clean realistic 3D technical illustration, light neutral studio background, matte materials, soft light and soft contact shadows, tight framing, minimal detail. Realism is for materials and light only: no invented detail, no orange or other saturated accent colours (copper parts may be copper).`,
    `View: ${VIEWPOINTS[v.viewpoint]} ${typeLine}${notEstablishedOrientation && v.viewpoint !== "part-end-on" ? " Orientation of the hero is not established: view it end-on with no ground, horizon or body-edge cue." : ""}`,
    `Show: ${show.join(" ")}`,
    `Background only, simplified and dim: ${may.length ? may.join(", ") : "a plain light neutral ground plane"}.`,
    `Leave out entirely: ${mustNot.join(", ")}.`,
    `Layout: plain empty light margin of at least 8% of the width on the left and right and 8% of the height at the bottom; nothing touches those edges, the subject floats on the plain ground. Keep the top 3%-17% of the height plain light background.`,
    `No text, letters, numbers, labels, arrows, callout lines or watermarks anywhere. Anything not described above stays a plain generic shape; if unsure how a real part looks, leave it out.`,
  ];
  return lines.join("\n") + "\n";
}

export async function runAll({ out = DEFAULT_OUT, only = null } = {}) {
  fs.mkdirSync(out, { recursive: true });
  // A run that already holds a generation (GEN_SUBMITTED in its event log) is real work: never wipe or rebuild it.
  const inFlight = (id) => { const ev = path.join(out, id, "events.jsonl"); return fs.existsSync(ev) && /"GEN_SUBMITTED"/.test(fs.readFileSync(ev, "utf8")); };
  for (const e of fs.readdirSync(out, { withFileTypes: true })) if (e.isDirectory() && !inFlight(e.name)) fs.rmSync(path.join(out, e.name), { recursive: true, force: true });
  let t = Date.parse("2026-10-10T12:00:00.000Z");
  const clock = () => new Date((t += 1000)).toISOString();
  const visuals = loadVisuals().filter((v) => !only || only.includes(v.id));
  const report = { application: APPLICATION, visualStandard: { id: STANDARD.id, scope: STANDARD.scope, referenceSha256: referenceSha256() }, certified: false, rule: "see header of scripts/bmw/pipeline-visuals.mjs", visuals: [], gaps: [] };
  for (const v of visuals) {
    const guideId = guideIdOf(v.guideNo);
    const stages = [];
    const stage = (name, status, detail, extra = {}) => stages.push({ stage: name, status, detail, ...extra });
    const dir = path.join(out, v.id);
    const built = buildEP(v);
    if (inFlight(v.id)) {
      const { FactoryRun: FR } = await import(path.join(ROOT, "scripts/visuals/factory-reconstructed/src/machine.mjs"));
      const kept = new FR({ dir, visualId: v.id, application: APPLICATION, guideId, registry: { [guideId]: APPLICATION }, clock });
      stage("0 preserved in-flight run", "PASS", `run already holds a generation (phase ${kept.state.phase}); not rebuilt`);
      report.visuals.push({ visualId: v.id, imageType: v.imageType, guide: v.guideNo, guideName: v.guideName, evidenceSteps: v.evidenceSteps, phase: kept.state.phase, stages, certified: kept.state.phase === "APPROVED" ? "factory-approved, owner sign-off per approved artifact" : false, imageProduced: true });
      continue;
    }
    const promptText = buildPrompt(v, built); // full spec prompt: internal, parsed into the locked contract
    const compactText = buildCompactPrompt(v, built); // what is actually submitted to the generator
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "spec-prompt.full.txt"), promptText);
    const parsed = parseVisualSpecPrompt(promptText);
    stage("1 visual spec intake", parsed.ok ? "PASS" : "FAIL", parsed.ok ? `${parsed.spec.mustShow.length} must-show, ${parsed.spec.mustNotShow.length} must-not-show` : JSON.stringify(parsed.problems));
    // Overlay guidance is a real contract callout per hero/target element, so the factory's overlay QA stage (independent review of the
    // overlay on the normalized image) applies and the approved artifact cannot claim verified callouts without it.
    if (parsed.ok) parsed.spec.callouts = [...v.elements.filter((e) => e.role === "hero"), ...v.elements.filter((e) => e.role === "target")].map((e) => ({ label: human(e.id), element: e.id, required: true }));
    const run = new FactoryRun({ dir, visualId: v.id, application: APPLICATION, guideId, registry: { [guideId]: APPLICATION }, clock });
    run.init();
    run.registerEP(built.ep, { role: "evidence-author" });
    const est = built.ep.ledger.filter((r) => r.status === "established").length;
    stage("2-3 reference intake and ledger", "PASS", `${built.ep.references.length} reference(s); ${est} established / ${built.ep.ledger.length - est} not-established ledger rows`);
    const ev = run.evaluateEP();
    stage("3b EP sufficiency (objective gate)", ev.sufficient ? "PASS" : "BLOCKED", ev.sufficient ? "every hero/target has established existence and location" : `EP INSUFFICIENT: ${ev.problems.length} hero/target fact(s) not established`, { problemCodes: [...new Set(ev.problems.map((p) => p.code))] });
    if (ev.sufficient && parsed.ok) {
      try { run.compileContract({ spec: parsed.spec }); stage("4 visual contract compile/lock", "PASS", "visual contract locked"); }
      catch (e) { stage("4 visual contract compile/lock", "FAIL", e instanceof Refused ? `refused ${e.code}: ${e.message} ${JSON.stringify(e.problems ?? [])}` : String(e)); }
      if (run.state.phase === "VC_LOCKED") {
        const prompt = run.requestGeneration({ promptText: compactText }).prompt;
        fs.writeFileSync(path.join(dir, "generation-prompt.txt"), prompt);
        fs.writeFileSync(path.join(dir, "overlay.spec.json"), JSON.stringify(overlaySpec(v, { stepNumber: v.evidenceSteps[0] }), null, 2) + "\n");
        stage("4b generation request", "PASS", `compact prompt built from the locked contract (${prompt.length} chars; full spec prompt ${promptText.length} chars kept internal)`);
        try { await new FileDropGenerator(path.join(out, "drop"), "no-drop-dir").generate({}); stage("5 image generation", "FAIL", "unexpected candidate"); }
        catch (e) { stage("5 image generation", "BLOCKED", e instanceof ActorUnavailable ? "no image generator is connected to this run. Generating costs money (needs owner approval) and the original generator adapters were lost." : String(e)); }
        for (const n of ["6 provenance checks", "7 no-source-pixels attestation", "8 admission gate", "9 normalization", "10 independent QA (Hermes) + overlay QA", "11 owner sign-off and approved artifact"]) stage(n, "BLOCKED", "no generated candidate exists yet");
      }
    } else {
      stage("4 visual contract compile/lock", "BLOCKED", "needs a SUFFICIENT evidence packet");
    }
    const vr = verifyRun(dir);
    stage("12 event log + directory integrity", vr.ok ? "PASS" : "FAIL", `${vr.events} events, ${vr.objects} objects, problems=${vr.problems.length}`);
    if (!ev.sufficient) fs.writeFileSync(path.join(dir, "spec-prompt.PROVISIONAL.txt"), promptText);
    report.visuals.push({ visualId: v.id, imageType: v.imageType, guide: v.guideNo, guideName: v.guideName, evidenceSteps: v.evidenceSteps, phase: run.state.phase, stages, certified: false, imageProduced: false });
    if (built.deficits.length) report.gaps.push({ visualId: v.id, guide: v.guideNo, deficits: built.deficits });
  }
  const by = (p) => report.visuals.filter((x) => x.phase === p).length;
  const typeCount = (t) => visuals.filter((x) => x.imageType === t).length;
  report.summary = { byType: { LOCATE: typeCount("LOCATE"), IDENTIFY: typeCount("IDENTIFY"), DO: typeCount("DO") }, visuals: report.visuals.length, contractLocked: by("GEN_REQUESTED"), evidenceInsufficient: by("EP_INSUFFICIENT"), certified: 0, imagesProduced: report.visuals.filter((x) => x.imageProduced).length };
  fs.writeFileSync(path.join(out, "PIPELINE-REPORT.json"), stable(report));
  const md = ["# BMW 328i (E90) image coverage", "", "GENERATED by `npm run bmw:pipeline`. No image exists and nothing is certified. `contract locked` means the evidence packet passed the evidence rule and the generation prompt is ready; it does not mean an image exists.", "",
    `Visuals: ${report.summary.visuals}. Contract locked: ${report.summary.contractLocked}. Evidence-insufficient: ${report.summary.evidenceInsufficient}. Images produced: 0. Certified: 0.`, "", "| Guide | Visual | Type | Status | Missing hero/target facts |", "|---|---|---|---|---|"];
  for (const v of report.visuals) {
    const gap = report.gaps.find((g) => g.visualId === v.visualId);
    md.push(`| ${v.guide} ${v.guideName} | ${v.visualId} | ${v.imageType} | ${v.phase === "GEN_REQUESTED" ? "contract locked" : "evidence insufficient"} | ${gap ? gap.deficits.map((d) => `${d.element}/${d.attribute}`).join("; ") : ""} |`);
  }
  fs.writeFileSync(path.join(out, "COVERAGE.md"), md.join("\n") + "\n");
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const oi = process.argv.indexOf("--out");
  const r = await runAll({ out: oi > 0 ? path.resolve(process.argv[oi + 1]) : DEFAULT_OUT });
  const perGuide = {};
  for (const v of r.visuals) { const g = (perGuide[v.guide] ??= { name: v.guideName, total: 0, locked: 0 }); g.total++; if (v.phase === "GEN_REQUESTED") g.locked++; }
  console.log(`visuals: ${r.summary.visuals}  contract-locked: ${r.summary.contractLocked}  evidence-insufficient: ${r.summary.evidenceInsufficient}  certified: 0  images: 0`);
  for (const [n, g] of Object.entries(perGuide)) console.log(`  guide ${String(n).padStart(2)} ${g.name.padEnd(34)} ${g.locked}/${g.total} contract-locked`);
  process.exitCode = r.visuals.some((v) => v.stages.some((s) => s.status === "FAIL")) ? 1 : 0;
}

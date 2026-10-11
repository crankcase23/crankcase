#!/usr/bin/env node
// BMW 328i (E90) oil-change visuals driven through the (reconstructed) Guide Factory, as the first real pipeline test.
// Honest by construction: every ledger fact is built from cited sources (docs/bmw-e90/image-evidence); a fact needs 2+
// sources on different hosts to be 'established', otherwise it is 'not-established' and must be omitted from the picture.
// The run stops wherever the evidence or the missing generator stops it; nothing is forged to go green.
//
//   node scripts/bmw/pipeline-oil-change.mjs [--out DIR]     (default: docs/bmw-e90/image-evidence/output)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const FACT = path.join(ROOT, "scripts/visuals/factory-reconstructed");
const EVD = path.join(ROOT, "docs/bmw-e90/image-evidence");
const { FactoryRun } = await import(path.join(FACT, "src/machine.mjs"));
const { parseVisualSpecPrompt } = await import(path.join(FACT, "src/spec-intake.mjs"));
const { FileDropGenerator, ActorUnavailable } = await import(path.join(FACT, "src/actors.mjs"));
const { verifyRun } = await import(path.join(FACT, "src/verify.mjs"));
const { Refused } = await import(path.join(FACT, "src/store.mjs"));
const { stable } = await import(path.join(FACT, "src/canon.mjs"));

const outArg = process.argv.indexOf("--out");
const OUT = outArg > 0 ? path.resolve(process.argv[outArg + 1]) : path.join(EVD, "output");

const cfg = JSON.parse(fs.readFileSync(path.join(EVD, "visuals.json"), "utf8"));
const facts = JSON.parse(fs.readFileSync(path.join(EVD, "oil-change-facts.json"), "utf8"));
const oilGuide = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/bmw-e90/evidence/guide-16.json"), "utf8"));

// URL -> {kind, establishes} from the evidence pull; a cited URL that is not in the pull is a hard error (no invented sources).
const known = new Map();
for (const f of facts.facts) for (const s of f.sources) if (!known.has(s.url)) known.set(s.url, { kind: s.kind, establishes: s.establishes });
const host = (u) => new URL(u).hostname.replace(/^www\./, "");

export function buildEP(v) {
  const refIds = new Map();
  const refs = [];
  const refFor = (url) => {
    if (!known.has(url)) throw new Error(`unknown source cited (not in oil-change-facts.json): ${url}`);
    if (!refIds.has(url)) {
      const k = known.get(url);
      const id = `ref-${refIds.size + 1}`;
      refIds.set(url, id);
      refs.push({ id, kind: k.kind, source: host(url), sourceRef: url, usage: "reference-only", establishes: [k.establishes], rights: "Text consulted for facts only; no pixels or images from this source are used." });
    }
    return refIds.get(url);
  };
  const ledger = [];
  const seen = new Set();
  for (const f of v.facts) {
    const hosts = new Set(f.urls.map(host));
    const ok = hosts.size >= 2;
    const evidence = f.urls.map(refFor);
    ledger.push(ok
      ? { element: f.element, attribute: f.attribute, status: "established", evidence, render: "draw", note: `${hosts.size} independent sources agree` }
      : { element: f.element, attribute: f.attribute, status: "not-established", render: "omit", note: f.note ?? `only ${hosts.size} independent source(s); needs 2+` });
    seen.add(`${f.element}/${f.attribute}`);
  }
  for (const e of v.elements) for (const attribute of ["existence", "location"]) {
    if (!seen.has(`${e.id}/${attribute}`)) ledger.push({ element: e.id, attribute, status: "not-established", render: "omit", note: "no source cited for this fact" });
  }
  const actions = v.evidenceSteps.map((n) => oilGuide.steps.find((s) => s.n === n)?.title).filter(Boolean);
  return {
    canonicalStep: { stepNumber: v.evidenceSteps[0], title: `${v.visualId} (BMW 328i draft oil-change guide; evidence step ${v.evidenceSteps.join(", ")})`, actions },
    references: refs,
    elements: v.elements,
    ledger,
    mustNotDepict: v.mustNotDepict.map((m) => ({ id: `excl-${m.element}`, element: m.element, reason: m.reason, trace: { element: m.element, attribute: "existence" } })),
    sufficiencyProposal: { proposedBy: "claude-research", basis: "Built from cited secondary sources only; 2+ independent hosts required per established fact." },
  };
}

export async function runAll({ out = OUT } = {}) {
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  let t = Date.parse("2026-10-10T12:00:00.000Z");
  const clock = () => new Date((t += 1000)).toISOString();
  const report = { application: cfg.application, certified: false, visuals: [] };
  for (const v of cfg.visuals) {
    const guideId = `admin-draft-bmw-2010-328i-${v.guideSlug}`;
    const stages = [];
    const stage = (name, status, detail, extra = {}) => stages.push({ stage: name, status, detail, ...extra });
    const promptText = fs.readFileSync(path.join(EVD, v.promptFile), "utf8");
    const parsed = parseVisualSpecPrompt(promptText);
    stage("1 visual spec intake", parsed.ok ? "PASS" : "FAIL", parsed.ok ? `${parsed.spec.mustShow.length} must-show, ${parsed.spec.mustNotShow.length} must-not-show` : JSON.stringify(parsed.problems));
    const dir = path.join(out, v.visualId);
    const run = new FactoryRun({ dir, visualId: v.visualId, application: cfg.application, guideId, registry: { [guideId]: cfg.application }, clock });
    run.init();
    const ep = buildEP(v);
    run.registerEP(ep, { role: "evidence-author" });
    const established = ep.ledger.filter((r) => r.status === "established").length;
    stage("2-3 reference intake and ledger", "PASS", `${ep.references.length} reference(s); ${established} established / ${ep.ledger.length - established} not-established ledger rows`);
    const ev = run.evaluateEP();
    const codes = [...new Set(ev.problems.map((p) => p.code))];
    stage("3b EP sufficiency (objective gate)", ev.sufficient ? "PASS" : "BLOCKED", ev.sufficient ? "every hero/target has established existence and location" : `EP INSUFFICIENT: ${ev.problems.map((p) => p.msg ?? p.code).join("; ")}`, { problemCodes: codes });
    let prompt = null;
    if (ev.sufficient && parsed.ok) {
      try { run.compileContract({ spec: parsed.spec }); stage("4 visual contract compile/lock", "PASS", "visual contract locked"); }
      catch (e) { stage("4 visual contract compile/lock", "FAIL", e instanceof Refused ? `refused ${e.code}: ${e.message}` : String(e)); }
      if (run.state.phase === "VC_LOCKED") {
        prompt = run.requestGeneration({ promptText }).prompt;
        fs.writeFileSync(path.join(dir, "generation-prompt.txt"), prompt);
        stage("4b generation request", "PASS", `prompt built from the locked contract (${prompt.length} chars)`);
        try { await new FileDropGenerator(path.join(out, "drop"), "no-drop-dir").generate({}); stage("5 image generation", "FAIL", "unexpected candidate"); }
        catch (e) { stage("5 image generation", "BLOCKED", e instanceof ActorUnavailable ? "no image generator is connected to this run. Generating costs money (needs owner approval) and the original generator adapters were lost." : String(e)); }
        for (const n of ["6 provenance checks", "7 no-source-pixels attestation", "8 admission gate", "9 normalization", "10 independent QA (Hermes) + overlay QA", "11 Andy sign-off and approved artifact"]) stage(n, "BLOCKED", "no generated candidate exists yet");
      }
    } else {
      stage("4 visual contract compile/lock", "BLOCKED", "needs a SUFFICIENT evidence packet");
    }
    const vr = verifyRun(dir);
    stage("12 event log + directory integrity", vr.ok ? "PASS" : "FAIL", `${vr.events} events, ${vr.objects} objects, problems=${vr.problems.length}`);
    report.visuals.push({ visualId: v.visualId, phase: run.state.phase, stages, certified: false, imageProduced: false });
  }
  fs.writeFileSync(path.join(out, "PIPELINE-REPORT.json"), stable(report));
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = await runAll();
  for (const v of r.visuals) {
    console.log(`\n== ${v.visualId}: ${v.phase}`);
    for (const s of v.stages) console.log(`${s.status.padEnd(8)} ${s.stage}${s.status === "BLOCKED" || s.status === "FAIL" ? " | " + s.detail : ""}`);
  }
  process.exitCode = r.visuals.some((v) => v.stages.some((s) => s.status === "FAIL")) ? 1 : 0;
}

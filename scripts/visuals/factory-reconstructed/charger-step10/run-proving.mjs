// RECONSTRUCTED-V1 | NOT the lost original.  CHARGER #001 / STEP 10 PROVING RUN (controlled fixture only; nothing is published).
// Runs the reconstructed factory against the SURVIVING Step 10 materials as far as the evidence permits, and reports honestly
// which stages pass and which are BLOCKED. It does NOT fabricate evidence, ledger facts, artwork or approvals to force green.
// Surviving inputs (all under recovered/): the Step 10 handoff prompt (documentation-derived), the Step 10 manifest (PENDING, empty),
// the Charger guide step text, the recovered visuals data (registry empty + shot-list slots), applications.json.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sha256, stable } from "../src/canon.mjs";
import { parseVisualSpecPrompt, stepTextVsSpec } from "../src/spec-intake.mjs";
import { FactoryRun } from "../src/machine.mjs";
import { FileDropGenerator, ActorUnavailable } from "../src/actors.mjs";
import { verifyRun } from "../src/verify.mjs";
import { Refused } from "../src/store.mjs";
import { RECONSTRUCTION_BANNER } from "../src/enums.mjs";
import { loadRecoveredResolver } from "../integration/recovered-resolver.mjs";
import { CONFLICTS } from "./conflicts.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const rec = (p) => path.join(root, "recovered", p);
const slug = (t) => t.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

export const STEP10_APPLICATION = { year: 2016, make: "Dodge", model: "Charger", trim: "SXT", engine: "3.6L Pentastar V6" };
export const GUIDE_ID = "admin-test-charger-2016-sxt-multi-job";
const STAGES = [];
const stage = (name, status, tag, detail, extra = {}) => { STAGES.push({ stage: name, status, evidenceTag: tag, detail, ...extra }); };

function surviving() {
  const sums = Object.fromEntries(fs.readFileSync(rec("SHA256SUMS.txt"), "utf8").trim().split("\n").map((l) => { const [h, f] = l.split(/\s+/); return [f.replace(/^\.\//, ""), h]; }));
  const files = { prompt: "doc-derived/step-10-handoff-prompt.txt", manifest: "visual-sources/2016-dodge-charger-sxt-36/step-10-intake-duct.manifest.json", guide: "src/data/admin-test-guides/charger-2016-sxt-multi-job.ts", slots: "src/data/guide-visuals/charger-2016-sxt-multi-job.ts", registry: "src/data/guide-visuals/charger-2016-sxt-multi-job.visuals.json", apps: "visual-sources/applications.json" };
  const bad = Object.values(files).filter((f) => sha256(fs.readFileSync(rec(f))) !== sums[f]);
  return { files, bad, text: (k) => fs.readFileSync(rec(files[k]), "utf8") };
}

function stepText(guideSrc, n) { const m = guideSrc.match(new RegExp(`step\\(${n},\\s*P\\d+,\\s*"([^"]+)",\\s*\\n?\\s*"([^"]+)"`)); return m ? { title: m[1], text: m[2] } : null; }
function slotCallouts(slotSrc, n) { const i = slotSrc.indexOf(`step: ${n},`); if (i < 0) return null; const blk = slotSrc.slice(i, slotSrc.indexOf("},", i)); const m = blk.match(/calloutTargets:\s*\[([\s\S]*?)\]/); return m ? [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : null; }

/** Reconstruction-only EP DRAFT derived from the handoff prompt. It contains ZERO reference evidence because none survives. */
export function draftEPFromSpec(spec) {
  const roleFor = (i) => (i === 0 ? "hero" : "target");
  const names = ["intake-hose", "clamp-throttle-body", "clamp-air-box", "iat-connector", "throttle-body", "air-box", "intake-plenum"];
  const must = names; // 6 ranked MUST SHOW items -> 7 elements (item 2 names BOTH clamps). INFERRED mapping.
  const crit = { "intake-hose": "procedure", "clamp-throttle-body": "critical", "clamp-air-box": "critical", "iat-connector": "critical", "throttle-body": "identification", "air-box": "identification", "intake-plenum": "identification" };
  const elements = must.map((id, i) => ({ id, role: roleFor(i), criticality: crit[id] }));
  const ledger = [];
  for (const e of elements) for (const attribute of ["existence", "location"]) ledger.push({ element: e.id, attribute, status: "not-established", render: "omit", note: "RECONSTRUCTION DRAFT: no reference evidence survives for this fact; NOT established" });
  const ctx = spec.maySimplify.map((t) => ({ id: `ctx-${slug(t)}`, role: "context", criticality: "cosmetic" }));
  const mnd = [], excl = [];
  for (const t of spec.mustNotShow) { const id = `excl-${slug(t)}`; excl.push({ id, role: "context", criticality: "cosmetic" }); ledger.push({ element: id, attribute: "existence", status: "not-established", render: "omit", note: "excluded by the Step 10 handoff prompt (documentation), not by an evidence finding" }); mnd.push({ id, element: id, reason: `handoff prompt MUST NOT SHOW: ${t}`, trace: { element: id, attribute: "existence" } }); }
  return {
    canonicalStep: { stepNumber: 10, title: "Remove intake duct (RECONSTRUCTION DRAFT from handoff prompt; no evidence)", actions: ["Disconnect the IAT electrical connector", "Loosen the clamp at the throttle body", "Loosen the clamp at the air-cleaner housing", "Release the intake assembly from its retaining grommet", "Remove the intake hose/resonator assembly"] },
    references: [], elements: [...elements, ...ctx, ...excl], ledger, mustNotDepict: mnd,
    sufficiencyProposal: { proposedBy: "claude-research", basis: "RECONSTRUCTION DRAFT: proposes INSUFFICIENT; the original Step 10 reference list (V3 spec) did not survive" },
  };
}

export async function runStep10Proving({ outDir, clock }) {
  STAGES.length = 0;
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const S = surviving();
  stage("0 recovered inputs intact", S.bad.length ? "FAIL" : "PASS", "RECOVERED", S.bad.length ? `hash mismatch: ${S.bad.join(", ")}` : `${Object.keys(S.files).length} surviving Step 10 inputs match SHA256SUMS`);

  const parsed = parseVisualSpecPrompt(S.text("prompt"));
  stage("1 visual specification intake", parsed.ok ? "PASS" : "FAIL", "RECOVERED-FROM-DOCUMENTATION", parsed.ok ? `parsed handoff prompt: ${parsed.spec.mustShow.length} ranked must-show, ${parsed.spec.maySimplify.length} may-simplify, ${parsed.spec.mustNotShow.length} must-not-show, no-text=${parsed.spec.noText}, clear space ${JSON.stringify(parsed.spec.clearSpace)}, 16:10 >= ${parsed.spec.framing.minPx.join("x")}` : JSON.stringify(parsed.problems));
  const spec = parsed.spec;

  // cross-source consistency (RECONSTRUCTED diagnostic; surfaces conflicts, resolves none)
  const st = stepText(S.text("guide"), 10), slots = slotCallouts(S.text("slots"), 10), man = JSON.parse(S.text("manifest"))._calloutTargetsFromStepText;
  const textConflicts = stepTextVsSpec(st.text, spec);
  const conflicts = [];
  if (textConflicts.length) conflicts.push({ id: "U-10a", what: `Guide step 10 text names ${textConflicts.join(" + ")}, but the Step 10 prompt lists them under MUST NOT SHOW`, sources: ["guide step 10 text (recovered)", "Step 10 handoff prompt (doc)"], status: "UNRESOLVED -> NEEDS_ANDY" });
  if (man.some((x) => /grommet/i.test(x))) conflicts.push({ id: "U-10b", what: "Older Step 10 manifest lists 'Retaining grommet' as a callout target; the handoff prompt excludes the grommet; the shot-list slot has no grommet but adds 'Intake hose'", sources: ["manifest._calloutTargetsFromStepText", "slot calloutTargets", "handoff prompt"], manifestTargets: man, slotTargets: slots, status: "UNRESOLVED -> NEEDS_ANDY" });
  stage("1b cross-source consistency (diagnostic)", conflicts.length ? "PASS_WITH_CONFLICTS" : "PASS", "RECONSTRUCTED diagnostic", `${conflicts.length} headline conflict(s) detected by the diagnostic; the full ${CONFLICTS.length}-row Step 10 source-conflict table (docs/STEP10-CONFLICT-TABLE.md, charger-step10/conflicts.mjs) is OPEN for Andy/Hermes; none resolved here`, { conflicts });

  // evidence intake -> EP DRAFT (zero references) -> objective sufficiency gate
  const workDir = path.join(outDir, "step-10-intake-duct");
  const run = new FactoryRun({ dir: workDir, visualId: "step-10-intake-duct", application: STEP10_APPLICATION, guideId: GUIDE_ID, registry: JSON.parse(S.text("apps")), clock });
  run.init();
  const refsSurviving = 0;
  stage("2 reference evidence intake", "BLOCKED", "UNKNOWN (lost)", `0 reference items survive for Step 10 (the older manifest's raw.source/sourceRef are empty; the V3 spec and its reference list are lost). Nothing was invented.`, { referencesRecovered: refsSurviving });
  const draft = draftEPFromSpec(spec);
  fs.writeFileSync(path.join(outDir, "ledger-candidates.INFERRED.json"), stable({ tag: "INFERRED from the handoff prompt; every fact below is NOT established (no evidence survives)", elements: draft.elements, ledger: draft.ledger }));
  run.registerEP(draft, { role: "reconstruction-draft-from-documentation" });
  const ev = run.evaluateEP();
  stage("3 evidence ledger", "BLOCKED", "INFERRED", `ledger candidates derived from the prompt, all marked not-established (omit); hero/target existence+location are NOT established`);
  stage("3b EP sufficiency (objective gate)", ev.sufficient ? "FAIL" : "BLOCKED", "VERIFIED FROM DOCUMENTATION (rule) + reconstructed code", ev.sufficient ? "UNEXPECTED: EP declared sufficient with no evidence" : `EP INSUFFICIENT: ${[...new Set(ev.problems.map((p) => p.code))].join(", ")} (${ev.problems.length} problems)`, { problemCodes: [...new Set(ev.problems.map((p) => p.code))] });

  let vcStatus = "BLOCKED", vcDetail;
  try { run.compileContract({ spec }); vcStatus = "FAIL"; vcDetail = "UNEXPECTED: contract compiled without sufficient evidence"; } catch (e) { vcDetail = e instanceof Refused ? `refused ${e.code}: ${e.message}` : String(e); }
  stage("4 visual contract compile/lock", vcStatus, "reconstructed code", vcDetail);

  let genDetail;
  try { await new FileDropGenerator(path.join(here, "drop")).generate({}); genDetail = "UNEXPECTED: a candidate exists"; } catch (e) { genDetail = e instanceof ActorUnavailable ? `no generator output: ${e.message}` : String(e); }
  stage("5 generator abstraction / generation capture", "BLOCKED", "UNKNOWN (lost)", `${genDetail}. No generated Step 10 image survives; V3/V4 artwork and the draft PNG are lost. Run is not in a state that allows a generation request.`);
  for (const [n, d] of [["6 provenance checks", "no candidate to check"], ["7 no-source-pixels / generator attestation", "no candidate attestation exists"], ["8 admission/rejection gate", "no candidate to admit"], ["9 normalization", "no admitted candidate"], ["10 QA (CG-QA-v1.0 content + overlay)", "no admitted candidate and no independent QA result"], ["11 final artifact / manifest", "nothing admitted; no AA can exist"]])
    stage(n, "BLOCKED", "n/a", `${d}. Stage logic is exercised on SYNTHETIC fixtures in tests/, never on Step 10.`);

  const v = verifyRun(workDir);
  stage("12 event log + directory integrity", v.ok ? "PASS" : "FAIL", "reconstructed code", `${v.events} events, ${v.objects} objects, problems=${v.problems.length}`);

  const R = await loadRecoveredResolver();
  if (!R.available) stage("13 recovered visual-contract layer integration", "NOT_RUN", "RECOVERED", R.reason);
  else {
    const step10 = R.resolveStepVisuals({ id: GUIDE_ID }, STEP10_APPLICATION, 10);
    stage("13 recovered visual-contract layer integration", step10.length === 0 ? "PASS" : "FAIL", "RECOVERED code (unmodified)", `recovered resolver bundles and runs; recovered registry holds 0 visuals; resolveStepVisuals(step 10) -> ${step10.length} visuals (shows nothing, as the recovered design requires). Accepting a reconstructed record is proven on SYNTHETIC fixtures in tests/recovered-integration.test.mjs.`);
  }

  const verdict = { step10Passes: false, why: "Stages 2-11 are BLOCKED by missing evidence/artwork. The factory correctly refuses to proceed; it was not forced green.", stagesPass: STAGES.filter((s) => s.status === "PASS" || s.status === "PASS_WITH_CONFLICTS").map((s) => s.stage), stagesBlocked: STAGES.filter((s) => s.status === "BLOCKED").map((s) => s.stage), stagesFail: STAGES.filter((s) => s.status === "FAIL").map((s) => s.stage) };
  const report = { banner: RECONSTRUCTION_BANNER, fixture: "Charger #001 Step 10 (proving fixture only; nothing published)", promptSha256: sha256(Buffer.from(S.text("prompt"))), stages: STAGES, conflicts, verdict };
  fs.writeFileSync(path.join(outDir, "PROVING-RUN-REPORT.json"), stable(report));
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let t = Date.parse("2026-10-04T12:00:00.000Z");
  const r = await runStep10Proving({ outDir: path.join(here, "output"), clock: () => new Date((t += 1000)).toISOString() });
  for (const s of r.stages) console.log(`${s.status.padEnd(19)} ${s.stage}`);
  console.log("\nStep 10 passes:", r.verdict.step10Passes, "\n" + r.verdict.why);
  process.exitCode = r.verdict.stagesFail.length ? 1 : 0;
}
